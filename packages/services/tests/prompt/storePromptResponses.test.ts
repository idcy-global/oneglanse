import type { ModelResult, PromptCaptureMetadata } from "@oneglanse/types";
import { PROVIDER_LIST } from "@oneglanse/types";
import { describe, expect, it } from "vitest";
import { buildPromptResponseRows } from "../../src/prompt/storePromptResponses.js";

function resultsWithChatGptResponse(): ModelResult {
	const results = Object.fromEntries(
		PROVIDER_LIST.map((provider) => [
			provider,
			{ status: "rejected" as const, data: [] },
		]),
	) as ModelResult;

	results.chatgpt = {
		status: "fulfilled",
		data: [
			{
				userId: "user-1",
				workspaceId: "workspace-1",
				promptId: "prompt-1",
				prompt: "Which brand is best?",
				response: "Example response",
				sources: [
					{
						title: "Example",
						url: "https://example.com/source",
						domain: "example.com",
					},
				],
			},
		],
	};

	return results;
}

describe("buildPromptResponseRows", () => {
	it("persists normalized capture metadata without changing logical provider fields", () => {
		const metadata: PromptCaptureMetadata = {
			adapterId: "api:chatgpt",
			captureType: "api",
			model: "gpt-example",
			region: "us",
			locale: "en-US",
			startedAt: "2026-10-04T01:02:03.000Z",
			completedAt: "2026-10-04T01:02:05.000Z",
			estimatedCostUsd: 0.0123,
			jobGroupId: "job-group-1",
		};

		const [row] = buildPromptResponseRows({
			results: resultsWithChatGptResponse(),
			userId: "user-1",
			workspaceId: "workspace-1",
			promptRunAt: "2026-10-04T01:02:03.000Z",
			captureMetadata: { chatgpt: metadata },
		});

		expect(row).toMatchObject({
			model: "chatgpt",
			model_provider: "chatgpt",
			adapter_id: "api:chatgpt",
			capture_type: "api",
			capture_model: "gpt-example",
			capture_region: "us",
			capture_locale: "en-US",
			estimated_cost_usd: 0.0123,
			job_group_id: "job-group-1",
			response: "Example response",
		});
		expect(row?.execution_started_at).not.toBeNull();
		expect(row?.execution_completed_at).not.toBeNull();
	});

	it("keeps legacy callers compatible by defaulting capture type to browser", () => {
		const [row] = buildPromptResponseRows({
			results: resultsWithChatGptResponse(),
			userId: "user-1",
			workspaceId: "workspace-1",
			promptRunAt: "2026-10-04T01:02:03.000Z",
		});

		expect(row).toMatchObject({
			adapter_id: "",
			capture_type: "browser",
			capture_model: "",
			capture_region: "",
			capture_locale: "",
			estimated_cost_usd: null,
			job_group_id: "",
			execution_started_at: null,
			execution_completed_at: null,
		});
	});
});
