import { clickhouse } from "./clickhouse.js";

let promptResponseCaptureMigration: Promise<void> | null = null;

async function migratePromptResponseCaptureColumns(): Promise<void> {
	const columns = [
		"adapter_id LowCardinality(String) DEFAULT ''",
		"capture_type LowCardinality(String) DEFAULT 'browser'",
		"capture_model String DEFAULT ''",
		"capture_region LowCardinality(String) DEFAULT ''",
		"capture_locale LowCardinality(String) DEFAULT ''",
		"estimated_cost_usd Nullable(Float64)",
		"job_group_id String DEFAULT ''",
		"execution_started_at Nullable(DateTime)",
		"execution_completed_at Nullable(DateTime)",
	];

	for (const column of columns) {
		await clickhouse.command({
			query: `ALTER TABLE analytics.prompt_responses ADD COLUMN IF NOT EXISTS ${column}`,
		});
	}
}

export async function ensurePromptResponseCaptureColumns(): Promise<void> {
	if (!promptResponseCaptureMigration) {
		promptResponseCaptureMigration = migratePromptResponseCaptureColumns().catch(
			(error) => {
				promptResponseCaptureMigration = null;
				throw error;
			},
		);
	}

	await promptResponseCaptureMigration;
}
