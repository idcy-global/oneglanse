import type {
	AIProviderAdapter,
	ProviderCapabilities,
	ProviderExecutionContext,
	ProviderExecutionResult,
} from "@oneglanse/providers";
import type { PromptPayload, Provider } from "@oneglanse/types";
import { PROVIDER_CONFIGS } from "../core/providers/index.js";

export class BrowserProviderAdapter implements AIProviderAdapter {
	readonly adapterId: string;
	readonly captureType = "browser" as const;
	readonly displayName: string;
	readonly enabled: boolean;
	readonly capabilities: ProviderCapabilities = {
		citations: true,
		search: true,
		location: false,
		authMode: "browser-session",
	};

	constructor(readonly provider: Provider) {
		const config = PROVIDER_CONFIGS[provider];
		this.adapterId = `browser:${provider}`;
		this.displayName = config.displayName || config.label;
		this.enabled = !config.skip;
	}

	async execute(
		payload: PromptPayload,
		context?: ProviderExecutionContext,
	): Promise<ProviderExecutionResult> {
		const config = PROVIDER_CONFIGS[this.provider];
		const startedAt = new Date().toISOString();

		// Keep registry/router imports lightweight. Browser, Redis, proxy and other
		// worker runtime dependencies are loaded only when this adapter executes.
		const [{ agentHandler }, { createAgent }] = await Promise.all([
			import("../core/agentHandler.js"),
			import("../core/createAgent.js"),
		]);

		try {
			const results = await agentHandler(
				config.label,
				() => createAgent(this.provider),
				payload,
				this.provider,
				{
					signal: context?.signal,
					onAttemptStart: (attempt) => {
						context?.registerCancelHandler?.(async () => {
							await attempt.context.close().catch(() => {});
							await attempt.cleanup?.().catch(() => {});
						});
					},
					onAttemptComplete: () => {
						context?.clearCancelHandler?.();
					},
					onPromptProgress: context?.onPromptProgress,
				},
			);

			return {
				adapterId: this.adapterId,
				provider: this.provider,
				captureType: this.captureType,
				model: null,
				region: null,
				locale: null,
				startedAt,
				completedAt: new Date().toISOString(),
				estimatedCostUsd: null,
				results,
			};
		} finally {
			context?.clearCancelHandler?.();
		}
	}
}
