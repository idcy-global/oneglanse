import { describe, expect, it } from "vitest";
import { PROVIDER_LIST } from "@oneglanse/types";
import { providerRegistry, providerRouter } from "../../src/provider-adapters/index.js";

describe("provider layer", () => {
	it("registers one browser adapter for every existing runtime provider", () => {
		const adapters = providerRegistry.list();

		expect(adapters).toHaveLength(PROVIDER_LIST.length);
		expect(new Set(adapters.map((adapter) => adapter.adapterId)).size).toBe(
			PROVIDER_LIST.length,
		);

		for (const provider of PROVIDER_LIST) {
			const adapter = providerRouter.resolve({
				provider,
				includeDisabled: true,
			});

			expect(adapter.adapterId).toBe(`browser:${provider}`);
			expect(adapter.provider).toBe(provider);
			expect(adapter.captureType).toBe("browser");
			expect(adapter.capabilities.authMode).toBe("browser-session");
		}
	});
});
