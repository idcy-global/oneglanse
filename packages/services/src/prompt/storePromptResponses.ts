import { ensurePromptResponseCaptureColumns } from "@oneglanse/db";
import { toErrorMessage } from "@oneglanse/errors";
import type { StorePromptResponsesArgs } from "@oneglanse/types";
import { buildPromptResponseRows } from "./buildPromptResponseRows.js";
import { insertClickHouseWithFallback } from "./lib/insertClickHouseWithFallback.js";

export async function storePromptResponses(
	args: StorePromptResponsesArgs,
): Promise<void> {
	const values = buildPromptResponseRows(args);

	if (values.length === 0) return;

	await ensurePromptResponseCaptureColumns();

	await insertClickHouseWithFallback("analytics.prompt_responses", values, {
		throwOnAllFailed: true,
		onRecordFailed: (value, err) => {
			console.error(
				`Failed to insert record (prompt: "${value.prompt.slice(0, 50)}..."):`,
				toErrorMessage(err),
			);
			console.error("Problematic data:", {
				id: value.id,
				prompt_id: value.prompt_id,
				prompt: value.prompt.slice(0, 100),
				prompt_run_at: value.prompt_run_at,
				adapter_id: value.adapter_id,
				capture_type: value.capture_type,
				response_length: value.response.length,
				sources_count: value.sources.length,
			});
		},
	});
}

