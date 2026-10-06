import type {
	ModelResult,
	Provider,
	Source,
	StorePromptResponsesArgs,
} from "@oneglanse/types";
import { formatDateToClickHouse } from "@oneglanse/utils";
import { v4 as uuidv4 } from "uuid";

export type PromptResponseInsertRow = {
	id: string;
	prompt_id: string;
	prompt: string;
	user_id: string;
	workspace_id: string;
	model: string;
	model_provider: string;
	adapter_id: string;
	capture_type: string;
	capture_model: string;
	capture_region: string;
	capture_locale: string;
	estimated_cost_usd: number | null;
	job_group_id: string;
	execution_started_at: string | null;
	execution_completed_at: string | null;
	response: string;
	sources: Source[];
	prompt_run_at: string;
};

function formatOptionalClickHouseDate(value?: string | null): string | null {
	if (!value) return null;
	return formatDateToClickHouse(new Date(value));
}

export function buildPromptResponseRows(
	args: StorePromptResponsesArgs,
): PromptResponseInsertRow[] {
	const {
		results,
		userId,
		workspaceId,
		promptRunAt,
		captureMetadata,
	} = args;

	const values: PromptResponseInsertRow[] = [];

	for (const [provider, result] of Object.entries(results) as [
		Provider,
		ModelResult[Provider],
	][]) {
		if (result.status !== "fulfilled") continue;

		const metadata = captureMetadata?.[provider];

		for (const item of result.data) {
			values.push({
				id: uuidv4(),
				prompt_id: item.promptId,
				prompt: item.prompt,
				user_id: userId,
				workspace_id: workspaceId,
				model: provider,
				model_provider: provider,
				adapter_id: metadata?.adapterId ?? "",
				capture_type: metadata?.captureType ?? "browser",
				capture_model: metadata?.model ?? "",
				capture_region: metadata?.region ?? "",
				capture_locale: metadata?.locale ?? "",
				estimated_cost_usd: metadata?.estimatedCostUsd ?? null,
				job_group_id: metadata?.jobGroupId ?? "",
				execution_started_at: formatOptionalClickHouseDate(
					metadata?.startedAt,
				),
				execution_completed_at: formatOptionalClickHouseDate(
					metadata?.completedAt,
				),
				response: item.response,
				sources: item.sources.map((source) => ({
					title: source.title ?? "",
					cited_text: source.cited_text ?? "",
					url: source.url ?? "",
					domain: source.domain ?? null,
					favicon: source.favicon ?? null,
				})),
				prompt_run_at: formatDateToClickHouse(new Date(promptRunAt)),
			});
		}
	}

	return values;
}
