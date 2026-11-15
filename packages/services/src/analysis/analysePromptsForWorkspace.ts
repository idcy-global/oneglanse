import { clickhouse } from "@oneglanse/db";
import { toErrorMessage } from "@oneglanse/errors";
import type {
	BrandAnalysisResult,
	PromptAnalysis,
	PromptResponse,
} from "@oneglanse/types";
import { v4 as uuidv4 } from "uuid";
import { getWorkspaceById } from "../workspace/index.js";
import { getNextAnalysisCursor } from "./analysisCursor.js";
import { runAnalysis } from "./runAnalysis.js";

async function analysePromptResponse(args: {
	brandName: string;
	brandDomain: string;
	response: string;
	prompt: string;
}): Promise<BrandAnalysisResult> {
	const { brandName, brandDomain, response, prompt } = args;

	const result = await runAnalysis({
		brandDomain,
		brandName,
		response,
		prompt,
	});

	result.metadata = { brandName, brandDomain };
	return result;
}

export async function analysePromptsForWorkspace(args: {
	workspaceId: string;
	batchSize?: number;
	analyzeAll?: boolean;
}): Promise<{
	analysedCount: number;
	failedCount: number;
	errors: Array<{ responseId: string; modelProvider: string; error: string }>;
	remainingCount: number;
}> {
	const { workspaceId, batchSize = 50, analyzeAll = false } = args;
	const workspace = await getWorkspaceById({ workspaceId });

	let totalAnalyzed = 0;
	let totalFailed = 0;
	let allErrors: Array<{
		responseId: string;
		modelProvider: string;
		error: string;
	}> = [];
	let cursor: { promptRunAt: string; id: string } | null = null;
	let hasMore = true;

	while (hasMore) {
		const result = await clickhouse.query({
			query: `
                SELECT pr.*
                FROM analytics.prompt_responses AS pr
                LEFT ANTI JOIN analytics.prompt_analysis AS pa
                  ON pr.prompt_id = pa.prompt_id
                  AND pr.prompt_run_at = pa.prompt_run_at
                  AND pr.model_provider = pa.model_provider
                  AND pr.workspace_id = pa.workspace_id
                WHERE pr.workspace_id = {workspaceId:String}
                  AND pr.is_analysed = false
                  AND (
                    {cursorSet:UInt8} = 0
                    OR pr.prompt_run_at > {cursorPromptRunAt:DateTime}
                    OR (
                      pr.prompt_run_at = {cursorPromptRunAt:DateTime}
                      AND pr.id > {cursorId:String}
                    )
                  )
                ORDER BY pr.prompt_run_at ASC, pr.id ASC
                LIMIT {batchSize:UInt32}
            `,
			query_params: {
				workspaceId,
				batchSize,
				cursorSet: cursor ? 1 : 0,
				cursorPromptRunAt: cursor?.promptRunAt ?? "1970-01-01 00:00:00",
				cursorId: cursor?.id ?? "",
			},
			format: "JSONEachRow",
		});

		const responses: PromptResponse[] = await result.json();

		if (responses.length === 0) {
			break;
		}

		const analysisRows: PromptAnalysis[] = [];
		const responseIdsToMark: string[] = [];
		const errors: Array<{
			responseId: string;
			modelProvider: string;
			error: string;
		}> = [];

		for (const resp of responses) {
			try {
				const analysisResult = await analysePromptResponse({
					brandName: workspace.name,
					brandDomain: workspace.domain,
					response: resp.response,
					prompt: resp.prompt,
				});

				analysisRows.push({
					id: uuidv4(),
					prompt_id: resp.prompt_id,
					workspace_id: resp.workspace_id,
					prompt: resp.prompt,
					user_id: resp.user_id,
					model_provider: resp.model_provider,
					brand_analysis: JSON.stringify(analysisResult),
					prompt_run_at: resp.prompt_run_at,
					created_at: resp.created_at,
				});

				responseIdsToMark.push(resp.id);
			} catch (err) {
				const errorMessage = toErrorMessage(err);
				console.error(
					`Failed to analyze response ${resp.id} (${resp.model_provider}):`,
					errorMessage,
				);

				errors.push({
					responseId: resp.id,
					modelProvider: resp.model_provider,
					error: errorMessage,
				});
			}
		}

		if (analysisRows.length > 0) {
			await clickhouse.insert({
				table: "analytics.prompt_analysis",
				values: analysisRows,
				format: "JSONEachRow",
			});
		}

		if (responseIdsToMark.length > 0) {
			await clickhouse.command({
				query: `
                    ALTER TABLE analytics.prompt_responses
                    UPDATE is_analysed = true
                    WHERE id IN ({ids:Array(String)})
                `,
				query_params: { ids: responseIdsToMark },
			});
		}

		totalAnalyzed += analysisRows.length;
		totalFailed += errors.length;
		allErrors = allErrors.concat(errors);

		// A keyset cursor is independent of ClickHouse's asynchronous UPDATE
		// mutation. The anti-join also prevents reprocessing rows whose analysis
		// insert succeeded even if the is_analysed flag has not caught up yet.
		cursor = getNextAnalysisCursor(responses);
		if (!analyzeAll) {
			hasMore = false;
		} else {
			hasMore = responses.length === batchSize && cursor !== null;
		}
	}

	const remainingResult = await clickhouse.query({
		query: `
            SELECT count() AS count
            FROM analytics.prompt_responses AS pr
            LEFT ANTI JOIN analytics.prompt_analysis AS pa
              ON pr.prompt_id = pa.prompt_id
              AND pr.prompt_run_at = pa.prompt_run_at
              AND pr.model_provider = pa.model_provider
              AND pr.workspace_id = pa.workspace_id
            WHERE pr.workspace_id = {workspaceId:String}
              AND pr.is_analysed = false
        `,
		query_params: { workspaceId },
		format: "JSONEachRow",
	});
	const remainingData: Array<{ count: string }> = await remainingResult.json();
	const remainingCount = Number(remainingData[0]?.count || 0);

	return {
		analysedCount: totalAnalyzed,
		failedCount: totalFailed,
		errors: allErrors,
		remainingCount,
	};
}
