export const USAGE_METRICS = ["ai_detection"] as const;

export type UsageMetric = (typeof USAGE_METRICS)[number];

export const SUBSCRIPTION_STATUSES = [
	"trialing",
	"active",
	"past_due",
	"canceled",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export interface PlanEntitlements {
	aiDetectionsPerPeriod: number | null;
	workspaceLimit: number | null;
	seatLimit: number | null;
}

export interface CommercialPlan {
	id: string;
	code: string;
	name: string;
	active: boolean;
	currency: "USD";
	monthlyPriceCents: number;
	entitlements: PlanEntitlements;
}

export interface OrganizationSubscription {
	id: string;
	organizationId: string;
	planId: string;
	status: SubscriptionStatus;
	currentPeriodStart: string;
	currentPeriodEnd: string;
	cancelAtPeriodEnd: boolean;
}

export interface UsageEventInput {
	organizationId: string;
	workspaceId: string | null;
	metric: UsageMetric;
	quantity: number;
	idempotencyKey: string;
	occurredAt: string;
	jobGroupId?: string | null;
	provider?: string | null;
	promptId?: string | null;
	estimatedCostUsd?: number | null;
}

export interface QuotaCheckInput {
	limit: number | null;
	used: number;
	requested: number;
}

export interface QuotaCheckResult {
	allowed: boolean;
	limit: number | null;
	used: number;
	requested: number;
	remainingBefore: number | null;
	remainingAfter: number | null;
}
