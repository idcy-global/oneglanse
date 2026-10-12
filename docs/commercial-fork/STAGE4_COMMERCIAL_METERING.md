# Stage 4 — Commercial Plans, Quota and Usage

## Ownership

Organization is the tenant and billing owner.

Workspace is only the project attribution scope. Usage must never be billed to a
user identity or trusted from a client-supplied organization id.

## Metering unit

The v1 commercial usage metric is:

`1 prompt × 1 provider = 1 ai_detection`

Examples:

- 1 prompt × ChatGPT = 1 detection
- 10 prompts × 3 providers = 30 detections

## Idempotency

Every committed usage event must have a unique deterministic idempotency key.

For AI detection usage, the base key is:

`ai_detection:{organizationId}:{jobGroupId}:{provider}:{promptId}`

Retries must not create a second billable event for the same logical detection.

## Quota

Plan limits are Organization-level. A null limit means unlimited.

Quota checks must happen server-side. Client values, workspace URLs and local
storage are never trusted as billing authority.

## Provider cost vs customer usage

Provider execution cost and customer quota are separate dimensions.

- customer usage: integer ai_detection units
- provider cost: estimated USD provenance from the Stage 3 capture metadata

A pricing decision can later map those two dimensions without changing historical
execution provenance.

## Stage 4 slices

1. Contract + pure quota/idempotency rules
2. PostgreSQL Plan/Subscription/Usage persistence
3. Atomic usage reservation/commit and quota enforcement
4. Organization usage read APIs and admin visibility
5. Final multi-arch CI and Stage 4 seal

Real payment gateways are explicitly outside the first Stage 4 implementation.
