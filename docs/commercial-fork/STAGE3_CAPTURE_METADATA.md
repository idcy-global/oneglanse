# Stage 3B — Provider Capture Metadata

## Goal

Persist how an AI answer was captured without changing its logical provider identity.

Existing analytics continue to use logical fields such as:

- `model = chatgpt`
- `model_provider = chatgpt`

Stage 3B additionally stores:

- `adapter_id`
- `capture_type`
- `capture_model`
- `capture_region`
- `capture_locale`
- `estimated_cost_usd`
- `job_group_id`
- `execution_started_at`
- `execution_completed_at`

This preserves provenance when the same logical provider can later execute through
browser, API, scraper, or mock adapters.

## Compatibility

Historical rows remain valid. Callers without capture metadata default to:

- `capture_type = browser`
- string metadata = empty string
- cost/start/end = null

## Migration

New installations receive the columns through the ClickHouse bootstrap schema.

Existing installations receive an idempotent `clickhouse:migrate` command using
`ADD COLUMN IF NOT EXISTS`. Docker Compose runs this after the PostgreSQL
migration.

Writes also call a defensive idempotent migration before inserting Stage 3B rows.

## Test isolation

The row-mapping unit test imports the pure `buildPromptResponseRows` module rather
than the database-backed persistence module. This prevents unit tests from
requiring `DATABASE_URL` merely to verify capture metadata mapping.

Runtime image tests additionally remove one capture column and verify the
ClickHouse migration restores the complete schema.
