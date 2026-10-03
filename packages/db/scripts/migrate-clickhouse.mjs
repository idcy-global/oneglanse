import { createClient } from "@clickhouse/client";

const clickhouse = createClient({
	url: process.env.CLICKHOUSE_URL ?? "http://localhost:8123",
	username: process.env.CLICKHOUSE_USER ?? "default",
	password: process.env.CLICKHOUSE_PASSWORD ?? "",
});

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

try {
	for (const column of columns) {
		await clickhouse.command({
			query: `ALTER TABLE analytics.prompt_responses ADD COLUMN IF NOT EXISTS ${column}`,
		});
	}
	console.log("ClickHouse migrations completed.");
} finally {
	await clickhouse.close();
}
