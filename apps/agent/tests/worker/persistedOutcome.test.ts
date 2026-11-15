import { describe, expect, it } from "vitest";
import { resolveProviderOutcome } from "../../src/worker/jobOutcome.js";

describe("resolveProviderOutcome", () => {
	it("marks a provider complete only after captured results are persisted", () => {
		expect(
			resolveProviderOutcome({
				captureSucceeded: true,
				persistenceSucceeded: true,
				resultCount: 2,
			}),
		).toEqual({ status: "completed", resultCount: 2 });
	});

	it("marks storage failures as failed instead of reporting unsaved results as complete", () => {
		expect(
			resolveProviderOutcome({
				captureSucceeded: true,
				persistenceSucceeded: false,
				resultCount: 2,
			}),
		).toEqual({ status: "failed", resultCount: 0 });
	});

	it("marks empty or failed captures as failed", () => {
		expect(
			resolveProviderOutcome({
				captureSucceeded: false,
				persistenceSucceeded: true,
				resultCount: 0,
			}),
		).toEqual({ status: "failed", resultCount: 0 });
	});
});
