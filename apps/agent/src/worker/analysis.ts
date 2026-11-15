import { analysePromptsForWorkspace } from "@oneglanse/services";
import { toErrorMessage } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { createProviderLogger } from "@oneglanse/utils";

export async function runAnalysisInBackground(args: {
	workspaceId: string;
	provider: Provider;
	jobGroupId: string;
}): Promise<{
	analysedCount: number;
	failedCount: number;
	remainingCount: number;
}> {
	const { workspaceId, provider, jobGroupId } = args;
	const plog = createProviderLogger(provider);

	try {
		plog.log(
			`all providers finished for job group ${jobGroupId}; starting GEO analysis`,
		);
		const result = await analysePromptsForWorkspace({
			workspaceId,
			analyzeAll: true,
		});
		if (result.failedCount > 0 || result.remainingCount > 0) {
			throw new Error(
				`GEO analysis incomplete: ${result.analysedCount} analyzed, ${result.failedCount} failed, ${result.remainingCount} remaining`,
			);
		}
		plog.success(
			`GEO analysis completed for job group ${jobGroupId}: ${result.analysedCount} responses analyzed`,
		);
		return result;
	} catch (err) {
		plog.error(
			`GEO analysis failed for job group ${jobGroupId}:`,
			toErrorMessage(err),
		);
		throw err;
	}
}
