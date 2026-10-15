import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	foreignKey,
	index,
	integer,
	numeric,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { organization } from "./auth.js";
import { workspaces } from "./workspace.js";

// Organization is the tenant and billing owner; Workspace is attribution only.
export const commercialPlans = pgTable("commercial_plans", {
	id: text("id").primaryKey(),
	code: text("code").notNull().unique(),
	name: text("name").notNull(),
	active: boolean("active").default(true).notNull(),
	currency: text("currency").default("USD").notNull(),
	monthlyPriceCents: integer("monthly_price_cents").notNull(),
	aiDetectionsPerPeriod: integer("ai_detections_per_period"),
	workspaceLimit: integer("workspace_limit"),
	seatLimit: integer("seat_limit"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
	check("commercial_plans_currency_chk", sql`${t.currency} = 'USD'`),
	check("commercial_plans_price_chk", sql`${t.monthlyPriceCents} >= 0`),
	check("commercial_plans_entitlements_chk", sql`
		(${t.aiDetectionsPerPeriod} IS NULL OR ${t.aiDetectionsPerPeriod} >= 0)
		AND (${t.workspaceLimit} IS NULL OR ${t.workspaceLimit} >= 0)
		AND (${t.seatLimit} IS NULL OR ${t.seatLimit} >= 0)`),
]);

export const commercialSubscriptions = pgTable("commercial_subscriptions", {
	id: text("id").primaryKey(),
	organizationId: varchar("organization_id", { length: 256 }).notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	planId: text("plan_id").notNull()
		.references(() => commercialPlans.id, { onDelete: "restrict" }),
	status: text("status").notNull(),
	currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
	currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
	cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
	uniqueIndex("commercial_subscriptions_one_current_org_idx").on(t.organizationId)
		.where(sql`${t.status} <> 'canceled'`),
	index("commercial_subscriptions_org_period_idx").on(t.organizationId, t.currentPeriodEnd),
	check("commercial_subscriptions_status_chk", sql`${t.status} IN ('trialing', 'active', 'past_due', 'canceled')`),
	check("commercial_subscriptions_period_chk", sql`${t.currentPeriodStart} < ${t.currentPeriodEnd}`),
]);

export const commercialUsageEvents = pgTable("commercial_usage_events", {
	id: uuid("id").defaultRandom().primaryKey(),
	organizationId: varchar("organization_id", { length: 256 }).notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	workspaceId: varchar("workspace_id", { length: 256 }),
	metric: text("metric").notNull(),
	quantity: integer("quantity").notNull(),
	idempotencyKey: text("idempotency_key").notNull().unique(),
	occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
	jobGroupId: text("job_group_id"),
	provider: text("provider"),
	promptId: text("prompt_id"),
	estimatedCostUsd: numeric("estimated_cost_usd", { precision: 14, scale: 6 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
	foreignKey({
		name: "commercial_usage_events_workspace_org_fk",
		columns: [t.workspaceId, t.organizationId],
		foreignColumns: [workspaces.id, workspaces.tenantId],
	}).onDelete("restrict"),
	index("commercial_usage_events_org_metric_period_idx").on(t.organizationId, t.metric, t.occurredAt),
	check("commercial_usage_events_unit_chk", sql`${t.metric} = 'ai_detection' AND ${t.quantity} = 1`),
	check("commercial_usage_events_cost_chk", sql`${t.estimatedCostUsd} IS NULL OR ${t.estimatedCostUsd} >= 0`),
	check("commercial_usage_events_key_chk", sql`length(${t.idempotencyKey}) > 0`),
]);
