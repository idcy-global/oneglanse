import { ProviderRegistry, ProviderRouter } from "@oneglanse/providers";
import { PROVIDER_LIST } from "@oneglanse/types";
import { BrowserProviderAdapter } from "./browserProviderAdapter.js";

export const providerRegistry = new ProviderRegistry();

for (const provider of PROVIDER_LIST) {
	providerRegistry.register(new BrowserProviderAdapter(provider));
}

export const providerRouter = new ProviderRouter(providerRegistry);


export async function readProviderAdapterHealth() {
	return Promise.all(
		providerRegistry.list().map(async (adapter) => {
			const health = adapter.healthCheck
				? await adapter.healthCheck()
				: { ok: adapter.enabled, message: "No adapter health check implemented." };

			return {
				adapterId: adapter.adapterId,
				provider: adapter.provider,
				captureType: adapter.captureType,
				enabled: adapter.enabled,
				capabilities: adapter.capabilities,
				health,
			};
		}),
	);
}
