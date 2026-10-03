import type {
	AIProviderAdapter,
	ProviderExecutionResult,
} from "@oneglanse/providers";
import { ProviderRegistry, ProviderRouter } from "@oneglanse/providers";
import type { PromptPayload, Provider } from "@oneglanse/types";
import { describe, expect, it } from "vitest";

function adapter(args: {
	adapterId: string;
	provider: Provider;
	captureType: "browser" | "api" | "scraper" | "mock";
	enabled?: boolean;
}): AIProviderAdapter {
	return {
		adapterId: args.adapterId,
		provider: args.provider,
		captureType: args.captureType,
		displayName: args.adapterId,
		enabled: args.enabled ?? true,
		capabilities: {
			citations: true,
			search: true,
			location: false,
			authMode: args.captureType === "browser" ? "browser-session" : "api-key",
		},
		async execute(payload: PromptPayload): Promise<ProviderExecutionResult> {
			const now = new Date().toISOString();
			return {
				adapterId: args.adapterId,
				provider: args.provider,
				captureType: args.captureType,
				model: null,
				region: null,
				locale: null,
				startedAt: now,
				completedAt: now,
				estimatedCostUsd: null,
				results: payload.prompts.map((prompt) => ({
					userId: payload.user_id,
					workspaceId: payload.workspace_id,
					promptId: prompt.id,
					prompt: prompt.prompt,
					response: `${args.adapterId} response`,
					sources: [],
				})),
			};
		},
	};
}

describe("ProviderRouter", () => {
	it("keeps browser as the default compatibility path", () => {
		const registry = new ProviderRegistry();
		registry.register(
			adapter({
				adapterId: "api:chatgpt",
				provider: "chatgpt",
				captureType: "api",
			}),
		);
		registry.register(
			adapter({
				adapterId: "browser:chatgpt",
				provider: "chatgpt",
				captureType: "browser",
			}),
		);

		const router = new ProviderRouter(registry);
		expect(router.resolve({ provider: "chatgpt" }).adapterId).toBe(
			"browser:chatgpt",
		);
	});

	it("can explicitly route the same logical provider through an API adapter", () => {
		const registry = new ProviderRegistry();
		registry.register(
			adapter({
				adapterId: "browser:chatgpt",
				provider: "chatgpt",
				captureType: "browser",
			}),
		);
		registry.register(
			adapter({
				adapterId: "api:chatgpt",
				provider: "chatgpt",
				captureType: "api",
			}),
		);

		const router = new ProviderRouter(registry);
		expect(
			router.resolve({
				provider: "chatgpt",
				preferredCaptureTypes: ["api", "browser"],
			}).adapterId,
		).toBe("api:chatgpt");
	});

	it("does not choose disabled adapters unless explicitly requested", () => {
		const registry = new ProviderRegistry();
		registry.register(
			adapter({
				adapterId: "browser:chatgpt",
				provider: "chatgpt",
				captureType: "browser",
				enabled: false,
			}),
		);

		const router = new ProviderRouter(registry);
		expect(() => router.resolve({ provider: "chatgpt" })).toThrow(
			"No provider adapter available",
		);
		expect(
			router.resolve({
				provider: "chatgpt",
				includeDisabled: true,
			}).adapterId,
		).toBe("browser:chatgpt");
	});
});
