export type ProviderFinalStatus = "completed" | "failed";

export function resolveProviderOutcome(args: {
	captureSucceeded: boolean;
	persistenceSucceeded: boolean;
	resultCount: number;
}): { status: ProviderFinalStatus; resultCount: number } {
	const completed =
		args.captureSucceeded &&
		args.persistenceSucceeded &&
		Number.isSafeInteger(args.resultCount) &&
		args.resultCount > 0;

	return {
		status: completed ? "completed" : "failed",
		resultCount: completed ? args.resultCount : 0,
	};
}
