import { ProviderRegistry, ProviderRouter } from "@oneglanse/providers";
import { PROVIDER_LIST } from "@oneglanse/types";
import { BrowserProviderAdapter } from "./browserProviderAdapter.js";

export const providerRegistry = new ProviderRegistry();

for (const provider of PROVIDER_LIST) {
	providerRegistry.register(new BrowserProviderAdapter(provider));
}

export const providerRouter = new ProviderRouter(providerRegistry);
