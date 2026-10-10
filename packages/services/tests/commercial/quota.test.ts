import { describe, expect, it } from "vitest";
import {
	buildAiDetectionUsageEvent,
	checkQuota,
	countAiDetections,
} from "../../src/commercial/quota.js";

describe("commercial quota", () => {
	it("allows unlimited plans without manufacturing a remaining balance", () => {
		expect(
			checkQuota({
				limit: null,
				used: 500,
				requested: 100,
			}),
		).toEqual({
			allowed: true,
			limit: null,
			used: 500,
			requested: 100,
			remainingBefore: null,
			remainingAfter: null,
		});
	});

	it("blocks a request that would exceed the plan limit", () => {
		expect(
			checkQuota({
				limit: 100,
				used: 95,
				requested: 6,
			}),
		).toMatchObject({
			allowed: false,
			remainingBefore: 5,
			remainingAfter: 5,
		});
	});

	it("counts one prompt times one provider as one AI detection", () => {
		expect(countAiDetections({ promptCount: 3, providerCount: 4 })).toBe(12);
	});

	it("builds deterministic idempotency keys for prompt-provider usage", () => {
		const event = buildAiDetectionUsageEvent({
			organizationId: "org-1",
			workspaceId: "workspace-1",
			jobGroupId: "job-1",
			provider: "chatgpt",
			promptId: "prompt-1",
			occurredAt: "2026-10-10T00:00:00.000Z",
			estimatedCostUsd: 0.01,
		});

		expect(event).toMatchObject({
			metric: "ai_detection",
			quantity: 1,
			organizationId: "org-1",
			workspaceId: "workspace-1",
			provider: "chatgpt",
			promptId: "prompt-1",
			estimatedCostUsd: 0.01,
			idempotencyKey:
				"ai_detection:org-1:job-1:chatgpt:prompt-1",
		});
	});
});
