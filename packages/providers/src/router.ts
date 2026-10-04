import type { Provider } from "@oneglanse/types";
import type { ProviderRegistry } from "./registry.js";
import {
	providerSatisfiesRequirements,
	type AIProviderAdapter,
	type ProviderCaptureType,
	type ProviderSelectionRequirements,
} from "./types.js";

// Browser capture remains the default because product-UI measurement and raw API
// output are different GEO measurement surfaces. API/scraper execution must be
// explicitly requested by the caller; never silently change methodology.
const DEFAULT_CAPTURE_ORDER: ProviderCaptureType[] = ["browser"];

export interface ProviderRouteRequest {
	provider: Provider;
	preferredAdapterId?: string;
	preferredCaptureTypes?: ProviderCaptureType[];
	requirements?: ProviderSelectionRequirements;
	includeDisabled?: boolean;
}

export class ProviderRouter {
	constructor(private readonly registry: ProviderRegistry) {}

	resolve(args: ProviderRouteRequest): AIProviderAdapter {
		const captureOrder =
			args.preferredCaptureTypes?.length
				? args.preferredCaptureTypes
				: DEFAULT_CAPTURE_ORDER;

		if (args.preferredAdapterId) {
			const preferred = this.registry.get(args.preferredAdapterId);
			if (
				preferred &&
				preferred.provider === args.provider &&
				captureOrder.includes(preferred.captureType) &&
				(args.includeDisabled || preferred.enabled) &&
				providerSatisfiesRequirements(preferred, args.requirements)
			) {
				return preferred;
			}
		}

		const candidates = this.registry
			.listForProvider(args.provider, {
				captureTypes: captureOrder,
				includeDisabled: args.includeDisabled,
			})
			.filter((candidate) =>
				providerSatisfiesRequirements(candidate, args.requirements),
			);

		for (const captureType of captureOrder) {
			const match = candidates.find(
				(candidate) => candidate.captureType === captureType,
			);
			if (match) return match;
		}

		throw new Error(
			`No provider adapter available for ${args.provider} (${captureOrder.join(", ")})`,
		);
	}
}
