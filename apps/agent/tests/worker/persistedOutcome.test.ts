import { describe, expect, it } from "vitest";
import { resolveProviderOutcome } from "../../src/worker/jobOutcome.js";

describe("resolveProviderOutcome", () => {
	const complete = {
		captureSucceeded: true,
		capturedResultCount: 2,
		expectedResultCount: 2,
		persistenceSucceeded: true,
		persistedResultCount: 2,
	};

	it("marks a provider complete only when every expected response is persisted", () => {
		expect(resolveProviderOutcome(complete)).toEqual({
			status: "completed",
			resultCount: 2,
		});
	});

	it("marks storage failures as failed and reports only rows actually saved", () => {
		expect(
			resolveProviderOutcome({
				...complete,
				persistenceSucceeded: false,
				persistedResultCount: 0,
			}),
		).toEqual({ status: "failed", resultCount: 0 });
	});

	it("keeps partial saved rows available for analysis but does not call the provider complete", () => {
		expect(
			resolveProviderOutcome({
				...complete,
				persistenceSucceeded: false,
				persistedResultCount: 1,
			}),
		).toEqual({ status: "failed", resultCount: 1 });
	});

	it("marks partial capture as failed even if all captured rows were saved", () => {
		expect(
			resolveProviderOutcome({
				...complete,
				capturedResultCount: 1,
				persistedResultCount: 1,
			}),
		).toEqual({ status: "failed", resultCount: 1 });
	});

	it("marks empty captures as failed", () => {
		expect(
			resolveProviderOutcome({
				...complete,
				captureSucceeded: false,
				capturedResultCount: 0,
				persistedResultCount: 0,
			}),
		).toEqual({ status: "failed", resultCount: 0 });
	});
});
