import type { Provider } from "@oneglanse/types";
import { analysePromptsForWorkspace } from "../analysis/analysePromptsForWorkspace.js";
import { redis } from "./redis.js";

const AGENT_PROGRESS_TTL_SECONDS = 24 * 60 * 60;

export type ProviderExecutionStatus =
	| "pending"
	| "running"
	| "completed"
	| "failed"
	| "stopped";

export type AgentJobGroupStatus =
	| "pending"
	| "analyzing"
	| "completed"
	| "failed";

export type AgentJobProgress = {
	workspaceId?: string;
	status: AgentJobGroupStatus;
	analysisStatus?: "running" | "completed" | "failed" | "skipped";
	updateId?: number;
	providers?: Record<string, ProviderExecutionStatus>;
	results?: Record<string, number>;
	stats?: {
		totalPrompts?: number;
		expectedResponses?: number;
		actualResponses?: number;
	};
};

const COMPLETED_TTL_SECONDS = 120;

const UPDATE_PROGRESS_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return nil end
local data = cjson.decode(raw)
data['providers'][ARGV[1]] = ARGV[2]
if ARGV[3] ~= '' then
  data['results'][ARGV[1]] = tonumber(ARGV[3])
end
data['updateId'] = (data['updateId'] or 0) + 1
local total = 0
for _, v in pairs(data['results']) do total = total + v end
data['stats']['actualResponses'] = total
local allDone = true
for _, v in pairs(data['providers']) do
  if v ~= 'completed' and v ~= 'failed' and v ~= 'stopped' then allDone = false; break end
end
local ttl = ${AGENT_PROGRESS_TTL_SECONDS}
local shouldStartAnalysis = 0
if allDone and data['status'] ~= 'completed' and data['status'] ~= 'failed' then
  if total > 0 then
    if data['analysisStatus'] ~= 'running' then
      data['status'] = 'analyzing'
      data['analysisStatus'] = 'running'
      shouldStartAnalysis = 1
    end
  else
    data['status'] = 'completed'
    data['analysisStatus'] = 'skipped'
    ttl = ${COMPLETED_TTL_SECONDS}
  end
end
redis.call('SET', KEYS[1], cjson.encode(data), 'EX', ttl)
return {cjson.encode(data), shouldStartAnalysis}
`;

const COMPLETE_ANALYSIS_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return nil end
local data = cjson.decode(raw)
if data['status'] ~= 'analyzing' then return cjson.encode(data) end
data['analysisStatus'] = ARGV[1]
data['status'] = ARGV[1]
data['updateId'] = (data['updateId'] or 0) + 1
local ttl = ARGV[1] == 'completed' and ${COMPLETED_TTL_SECONDS} or ${AGENT_PROGRESS_TTL_SECONDS}
redis.call('SET', KEYS[1], cjson.encode(data), 'EX', ttl)
return cjson.encode(data)
`;

function parseProgress(raw: unknown): AgentJobProgress | null {
	if (typeof raw !== "string") return null;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
			return null;
		}
		return parsed as AgentJobProgress;
	} catch {
		return null;
	}
}

export function buildProgressKey(jobGroupId: string): string {
	return `job:${jobGroupId}:result`;
}

/**
 * Return a job-group progress record only to the workspace that created it.
 * Missing ownership metadata is treated as inaccessible (fail closed).
 */
export async function getJobGroupProgressForWorkspace(args: {
	jobGroupId: string;
	workspaceId: string;
}): Promise<AgentJobProgress | null> {
	const progress = parseProgress(await redis.get(buildProgressKey(args.jobGroupId)));
	if (
		!progress ||
		typeof progress.workspaceId !== "string" ||
		progress.workspaceId !== args.workspaceId
	) {
		return null;
	}
	return progress;
}

export async function updateProviderProgress(args: {
	jobGroupId: string;
	provider: Provider;
	status: ProviderExecutionStatus;
	resultCount?: number | null;
}): Promise<AgentJobProgress | null> {
	const countArg =
		args.resultCount === undefined || args.resultCount === null
			? ""
			: String(args.resultCount);

	const result = await redis.eval(
		UPDATE_PROGRESS_LUA,
		1,
		buildProgressKey(args.jobGroupId),
		args.provider,
		args.status,
		countArg,
	);
	const [rawProgress, shouldStartAnalysis] = Array.isArray(result)
		? result
		: [result, 0];
	let progress = parseProgress(rawProgress);

	if (Number(shouldStartAnalysis) !== 1) return progress;
	if (!progress?.workspaceId) {
		console.error(
			`Cannot start GEO analysis for job group ${args.jobGroupId}: workspaceId missing from progress seed`,
		);
		return (
			(await setJobGroupAnalysisStatus({
				jobGroupId: args.jobGroupId,
				status: "failed",
			})) ?? progress
		);
	}

	try {
		const analysis = await analysePromptsForWorkspace({
			workspaceId: progress.workspaceId,
			analyzeAll: true,
			waitForLock: true,
		});
		if (analysis.failedCount > 0 || analysis.remainingCount > 0) {
			throw new Error(
				`GEO analysis incomplete: ${analysis.analysedCount} analyzed, ${analysis.failedCount} failed, ${analysis.remainingCount} remaining`,
			);
		}
		progress =
			(await setJobGroupAnalysisStatus({
				jobGroupId: args.jobGroupId,
				status: "completed",
			})) ?? progress;
	} catch (err) {
		console.error(
			`GEO analysis failed for job group ${args.jobGroupId}:`,
			err instanceof Error ? err.message : String(err),
		);
		progress =
			(await setJobGroupAnalysisStatus({
				jobGroupId: args.jobGroupId,
				status: "failed",
			})) ?? progress;
	}

	return progress;
}

export async function setJobGroupAnalysisStatus(args: {
	jobGroupId: string;
	status: "completed" | "failed";
}): Promise<AgentJobProgress | null> {
	const result = await redis.eval(
		COMPLETE_ANALYSIS_LUA,
		1,
		buildProgressKey(args.jobGroupId),
		args.status,
	);
	return parseProgress(result);
}
