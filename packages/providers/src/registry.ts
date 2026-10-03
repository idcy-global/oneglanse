import type {
	AIProviderAdapter,
	ProviderCaptureType,
} from "./types.js";
import type { Provider } from "@oneglanse/types";

export class ProviderRegistry {
	private readonly adapters = new Map<string, AIProviderAdapter>();

	register(adapter: AIProviderAdapter): void {
		if (this.adapters.has(adapter.adapterId)) {
			throw new Error(`Provider adapter already registered: ${adapter.adapterId}`);
		}
		this.adapters.set(adapter.adapterId, adapter);
	}

	get(adapterId: string): AIProviderAdapter | null {
		return this.adapters.get(adapterId) ?? null;
	}

	list(): AIProviderAdapter[] {
		return [...this.adapters.values()];
	}

	listForProvider(
		provider: Provider,
		options?: {
			captureTypes?: ProviderCaptureType[];
			includeDisabled?: boolean;
		},
	): AIProviderAdapter[] {
		const captureTypes = options?.captureTypes;
		return this.list().filter((adapter) => {
			if (adapter.provider !== provider) return false;
			if (!options?.includeDisabled && !adapter.enabled) return false;
			if (captureTypes && !captureTypes.includes(adapter.captureType)) return false;
			return true;
		});
	}
}
