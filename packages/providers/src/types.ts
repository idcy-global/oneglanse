import type {
	AskPromptResult,
	PromptCaptureMetadata,
	PromptPayload,
	Provider,
	ProviderAuthMode,
	ProviderCaptureType,
} from "@oneglanse/types";

export {
	PROVIDER_AUTH_MODES,
	PROVIDER_CAPTURE_TYPES,
} from "@oneglanse/types";
export type {
	ProviderAuthMode,
	ProviderCaptureType,
} from "@oneglanse/types";

export interface ProviderCapabilities {
	citations: boolean;
	search: boolean;
	location: boolean;
	authMode: ProviderAuthMode;
}

export interface ProviderSelectionRequirements {
	citations?: boolean;
	search?: boolean;
	location?: boolean;
	authModes?: ProviderAuthMode[];
}

export interface ProviderExecutionContext {
	signal?: AbortSignal;
	onPromptProgress?: (current: number, total: number) => Promise<void>;
	registerCancelHandler?: (handler: () => Promise<void>) => void;
	clearCancelHandler?: () => void;
}

export interface ProviderExecutionCostEstimate {
	currency: "USD";
	amount: number | null;
	basis: "provider-api" | "infrastructure" | "unknown";
}

export interface ProviderExecutionResult
	extends Omit<PromptCaptureMetadata, "jobGroupId"> {
	provider: Provider;
	results: AskPromptResult[];
}

export interface ProviderHealthResult {
	ok: boolean;
	message?: string;
}

export interface AIProviderAdapter {
	readonly adapterId: string;
	readonly provider: Provider;
	readonly captureType: ProviderCaptureType;
	readonly displayName: string;
	readonly enabled: boolean;
	readonly capabilities: ProviderCapabilities;

	execute(
		payload: PromptPayload,
		context?: ProviderExecutionContext,
	): Promise<ProviderExecutionResult>;

	estimateCost?(
		payload: PromptPayload,
	): ProviderExecutionCostEstimate | Promise<ProviderExecutionCostEstimate>;

	healthCheck?(): Promise<ProviderHealthResult>;
}

export function providerSatisfiesRequirements(
	adapter: AIProviderAdapter,
	requirements?: ProviderSelectionRequirements,
): boolean {
	if (!requirements) return true;

	if (requirements.citations && !adapter.capabilities.citations) return false;
	if (requirements.search && !adapter.capabilities.search) return false;
	if (requirements.location && !adapter.capabilities.location) return false;
	if (
		requirements.authModes?.length &&
		!requirements.authModes.includes(adapter.capabilities.authMode)
	) {
		return false;
	}

	return true;
}
