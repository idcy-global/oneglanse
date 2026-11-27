type ProviderFinalStatus = "completed" | "failed";

export function resolveProviderOutcome(args: {
	captureSucceeded: boolean;
	capturedResultCount: number;
	expectedResultCount: number;
	persistenceSucceeded: boolean;
	persistedResultCount: number;
}): { status: ProviderFinalStatus; resultCount: number } {
	const persistedResultCount =
		Number.isSafeInteger(args.persistedResultCount) &&
		args.persistedResultCount >= 0
			? args.persistedResultCount
			: 0;
	const completed =
		args.captureSucceeded &&
		args.expectedResultCount > 0 &&
		args.capturedResultCount === args.expectedResultCount &&
		args.persistenceSucceeded &&
		persistedResultCount === args.expectedResultCount;

	return {
		status: completed ? "completed" : "failed",
		// Keep the count of rows that really reached ClickHouse. A partial
		// provider run still needs those saved answers analyzed and reported.
		resultCount: persistedResultCount,
	};
}
