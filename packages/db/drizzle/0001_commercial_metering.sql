-- Stage 4B: organization-owned commercial metering. Run after baseline 0000.
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_id_tenant_id_unique" ON "public"."workspaces" ("id", "tenant_id");--> statement-breakpoint
CREATE TABLE "commercial_plans" (
 "id" text PRIMARY KEY NOT NULL, "code" text NOT NULL UNIQUE, "name" text NOT NULL,
 "active" boolean DEFAULT true NOT NULL, "currency" text DEFAULT 'USD' NOT NULL,
 "monthly_price_cents" integer NOT NULL, "ai_detections_per_period" integer,
 "workspace_limit" integer, "seat_limit" integer,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "commercial_plans_currency_chk" CHECK ("currency" = 'USD'),
 CONSTRAINT "commercial_plans_price_chk" CHECK ("monthly_price_cents" >= 0),
 CONSTRAINT "commercial_plans_entitlements_chk" CHECK (("ai_detections_per_period" IS NULL OR "ai_detections_per_period" >= 0) AND ("workspace_limit" IS NULL OR "workspace_limit" >= 0) AND ("seat_limit" IS NULL OR "seat_limit" >= 0))
);--> statement-breakpoint
CREATE TABLE "commercial_subscriptions" (
 "id" text PRIMARY KEY NOT NULL, "organization_id" varchar(256) NOT NULL REFERENCES "public"."organization"("id") ON DELETE cascade,
 "plan_id" text NOT NULL REFERENCES "public"."commercial_plans"("id") ON DELETE restrict,
 "status" text NOT NULL, "current_period_start" timestamp with time zone NOT NULL,
 "current_period_end" timestamp with time zone NOT NULL,
 "cancel_at_period_end" boolean DEFAULT false NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "commercial_subscriptions_status_chk" CHECK ("status" IN ('trialing','active','past_due','canceled')),
 CONSTRAINT "commercial_subscriptions_period_chk" CHECK ("current_period_start" < "current_period_end")
);--> statement-breakpoint
CREATE UNIQUE INDEX "commercial_subscriptions_one_current_org_idx" ON "public"."commercial_subscriptions" ("organization_id") WHERE "status" <> 'canceled';--> statement-breakpoint
CREATE INDEX "commercial_subscriptions_org_period_idx" ON "public"."commercial_subscriptions" ("organization_id", "current_period_end");--> statement-breakpoint
CREATE TABLE "commercial_usage_events" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "organization_id" varchar(256) NOT NULL REFERENCES "public"."organization"("id") ON DELETE cascade,
 "workspace_id" varchar(256), "metric" text NOT NULL, "quantity" integer NOT NULL,
 "idempotency_key" text NOT NULL UNIQUE, "occurred_at" timestamp with time zone NOT NULL,
 "job_group_id" text, "provider" text, "prompt_id" text,
 "estimated_cost_usd" numeric(14,6), "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "commercial_usage_events_workspace_org_fk" FOREIGN KEY ("workspace_id", "organization_id") REFERENCES "public"."workspaces" ("id", "tenant_id") ON DELETE restrict,
 CONSTRAINT "commercial_usage_events_unit_chk" CHECK ("metric" = 'ai_detection' AND "quantity" = 1),
 CONSTRAINT "commercial_usage_events_cost_chk" CHECK ("estimated_cost_usd" IS NULL OR "estimated_cost_usd" >= 0),
 CONSTRAINT "commercial_usage_events_key_chk" CHECK (length("idempotency_key") > 0)
);--> statement-breakpoint
CREATE INDEX "commercial_usage_events_org_metric_period_idx" ON "public"."commercial_usage_events" ("organization_id", "metric", "occurred_at");
