import type {
	QuotaCheckInput,
	QuotaCheckResult,
	UsageEventInput,
} from "@oneglanse/types";

export function checkQuota(input: QuotaCheckInput): QuotaCheckResult {
	const used = Math.max(0, Math.trunc(input.used));
	const requested = Math.max(0, Math.trunc(input.requested));

	if (input.limit === null) {
		return {
			allowed: true,
			limit: null,
			used,
			requested,
			remainingBefore: null,
			remainingAfter: null,
		};
	}

	const limit = Math.max(0, Math.trunc(input.limit));
	const remainingBefore = Math.max(0, limit - used);
	const allowed = requested <= remainingBefore;

	return {
		allowed,
		limit,
		used,
		requested,
		remainingBefore,
		remainingAfter: allowed ? remainingBefore - requested : remainingBefore,
	};
}

export function buildAiDetectionUsageEvent(args: {
	organizationId: string;
	workspaceId: string;
	jobGroupId: string;
	provider: string;
	promptId: string;
	occurredAt: string;
	estimatedCostUsd?: number | null;
}): UsageEventInput {
	return {
		organizationId: args.organizationId,
		workspaceId: args.workspaceId,
		metric: "ai_detection",
		quantity: 1,
		idempotencyKey: [
			"ai_detection",
			args.organizationId,
			args.jobGroupId,
			args.provider,
			args.promptId,
		].join(":"),
		occurredAt: args.occurredAt,
		jobGroupId: args.jobGroupId,
		provider: args.provider,
		promptId: args.promptId,
		estimatedCostUsd: args.estimatedCostUsd ?? null,
	};
}

export function countAiDetections(args: {
	promptCount: number;
	providerCount: number;
}): number {
	return Math.max(0, Math.trunc(args.promptCount)) *
		Math.max(0, Math.trunc(args.providerCount));
}
