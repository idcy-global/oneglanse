import type { Provider } from "@oneglanse/types";
import type { ProviderRegistry } from "./registry.js";
import type {
	AIProviderAdapter,
	ProviderCaptureType,
} from "./types.js";

const DEFAULT_CAPTURE_ORDER: ProviderCaptureType[] = [
	"browser",
	"api",
	"scraper",
	"mock",
];

export class ProviderRouter {
	constructor(private readonly registry: ProviderRegistry) {}

	resolve(args: {
		provider: Provider;
		preferredCaptureTypes?: ProviderCaptureType[];
		includeDisabled?: boolean;
	}): AIProviderAdapter {
		const captureOrder =
			args.preferredCaptureTypes?.length
				? args.preferredCaptureTypes
				: DEFAULT_CAPTURE_ORDER;

		const candidates = this.registry.listForProvider(args.provider, {
			captureTypes: captureOrder,
			includeDisabled: args.includeDisabled,
		});

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
