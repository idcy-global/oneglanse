-- Stage 4B PostgreSQL migration for organization-owned usage.
-- Pending review and CI validation.
CREATE UNIQUE INDEX "workspaces_id_tenant_unique" ON "public"."workspaces" ("id", "tenant_id");
