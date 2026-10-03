# Stage 3B — Provider Capture Metadata

## Goal

Keep the logical AI provider independent from the mechanism used to capture the answer.

Existing analytics and reports continue to use the logical provider:

```text
model = chatgpt
model_provider = chatgpt
```

Stage 3B adds capture metadata beside those existing fields:

```text
adapter_id
capture_type
capture_model
capture_region
capture_locale
estimated_cost_usd
job_group_id
execution_started_at
execution_completed_at
```

This means a future ChatGPT answer captured through Browser, API, scraper, or mock
can still be analyzed as the same logical provider while retaining its execution provenance.

## Capture fields

- `adapter_id`: concrete adapter, for example `browser:chatgpt` or `api:chatgpt`
- `capture_type`: `browser | api | scraper | mock`
- `capture_model`: provider model/version when known
- `capture_region`: execution region when known
- `capture_locale`: locale when known
- `estimated_cost_usd`: adapter-reported estimated execution cost
- `job_group_id`: queue execution group
- `execution_started_at`: adapter execution start
- `execution_completed_at`: adapter execution completion

## Backward compatibility

Historical rows remain valid.

When an old caller writes without capture metadata:

- capture type defaults to `browser`
- adapter/model/region/locale/job group default to empty strings
- cost/start/end default to null
- logical `model` and `model_provider` remain unchanged

The analysis pipeline does not depend on capture metadata.

## Migration strategy

Stage 3B deliberately uses three compatible migration paths.

### New installations

`packages/db/clickhouse-init/schema.sql` creates all capture columns as part of
`analytics.prompt_responses`.

### Existing self-host installations

The existing Docker Compose one-shot `migrate` service now executes:

```text
PostgreSQL Drizzle migrations
  ->
ClickHouse capture migrations
```

The ClickHouse migration uses `ADD COLUMN IF NOT EXISTS`, so repeated startup is safe.

### Defensive write-time migration

Before writing rows with capture metadata,
`ensurePromptResponseCaptureColumns()` performs the same idempotent migration.

This is a fallback for installations that did not pass through the normal Compose
migration path before the first new provider run.

## CI acceptance

The Web Docker runtime test deliberately removes one capture column from ClickHouse,
runs `clickhouse:migrate`, and then verifies that all Stage 3B columns exist.

Stage 3B is accepted only when:

- lint
- typecheck
- unit tests
- dead-code checks
- build
- Web amd64 runtime
- Web arm64 runtime
- Agent amd64 runtime
- Agent arm64 runtime
- Postgres image validation
- PR Gate

all pass.
