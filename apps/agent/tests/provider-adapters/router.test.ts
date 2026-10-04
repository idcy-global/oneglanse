import {
	ProviderRegistry,
	ProviderRouter,
	type AIProviderAdapter,
	type ProviderCapabilities,
	type ProviderCaptureType,
	type ProviderExecutionResult,
} from "@oneglanse/providers";
import {
	PROVIDER_LIST,
	type PromptPayload,
	type Provider,
} from "@oneglanse/types";
import { describe, expect, it } from "vitest";

const provider = PROVIDER_LIST[0] as Provider;

class FakeAdapter implements AIProviderAdapter {
	readonly capabilities: ProviderCapabilities;

	constructor(
		readonly adapterId: string,
		readonly provider: Provider,
		readonly captureType: ProviderCaptureType,
		readonly enabled = true,
		capabilities?: Partial<ProviderCapabilities>,
	) {
		this.capabilities = {
			citations: false,
			search: false,
			location: false,
			authMode: captureType === "browser" ? "browser-session" : "api-key",
			...capabilities,
		};
	}

	readonly displayName = "Fake";

	async execute(payload: PromptPayload): Promise<ProviderExecutionResult> {
		const now = new Date().toISOString();
		return {
			adapterId: this.adapterId,
			provider: this.provider,
			captureType: this.captureType,
			model: null,
			region: null,
			locale: null,
			startedAt: now,
			completedAt: now,
			estimatedCostUsd: null,
			results: payload.prompts.map((item) => ({
				userId: payload.user_id,
				workspaceId: payload.workspace_id,
				promptId: item.id,
				prompt: item.prompt,
				response: "",
				sources: [],
			})),
		};
	}
}

describe("ProviderRouter", () => {
	it("keeps browser capture as the safe default", () => {
		const registry = new ProviderRegistry();
		registry.register(new FakeAdapter("api:test", provider, "api"));

		const router = new ProviderRouter(registry);

		expect(() => router.resolve({ provider })).toThrow(
			/No provider adapter available/,
		);
	});

	it("allows API capture only when explicitly requested", () => {
		const registry = new ProviderRegistry();
		registry.register(new FakeAdapter("api:test", provider, "api"));

		const adapter = new ProviderRouter(registry).resolve({
			provider,
			preferredCaptureTypes: ["api"],
		});

		expect(adapter.adapterId).toBe("api:test");
	});

	it("enforces required provider capabilities", () => {
		const registry = new ProviderRegistry();
		registry.register(
			new FakeAdapter("browser:no-citations", provider, "browser", true, {
				citations: false,
			}),
		);
		registry.register(
			new FakeAdapter("browser:citations", provider, "browser", true, {
				citations: true,
			}),
		);

		const adapter = new ProviderRouter(registry).resolve({
			provider,
			requirements: { citations: true },
		});

		expect(adapter.adapterId).toBe("browser:citations");
	});

	it("honors a preferred adapter when it satisfies the request", () => {
		const registry = new ProviderRegistry();
		registry.register(new FakeAdapter("browser:first", provider, "browser"));
		registry.register(new FakeAdapter("browser:preferred", provider, "browser"));

		const adapter = new ProviderRouter(registry).resolve({
			provider,
			preferredAdapterId: "browser:preferred",
		});

		expect(adapter.adapterId).toBe("browser:preferred");
	});

	it("does not select a disabled adapter unless explicitly allowed", () => {
		const registry = new ProviderRegistry();
		registry.register(
			new FakeAdapter("browser:disabled", provider, "browser", false),
		);

		const router = new ProviderRouter(registry);

		expect(() => router.resolve({ provider })).toThrow();

		expect(
			router.resolve({ provider, includeDisabled: true }).adapterId,
		).toBe("browser:disabled");
	});
});
