import { describe, expect, it } from "vitest";
import { getNextAnalysisCursor } from "../../src/analysis/analysisCursor.js";

describe("getNextAnalysisCursor", () => {
	it("uses the last row as a stable keyset cursor", () => {
		expect(
			getNextAnalysisCursor([
				{ prompt_run_at: "2026-11-15 10:00:00", id: "a" },
				{ prompt_run_at: "2026-11-15 10:00:00", id: "b" },
			]),
		).toEqual({
			promptRunAt: "2026-11-15 10:00:00",
			id: "b",
		});
	});

	it("returns null for an empty or invalid page", () => {
		expect(getNextAnalysisCursor([])).toBeNull();
		expect(
			getNextAnalysisCursor([{ prompt_run_at: "", id: "a" }]),
		).toBeNull();
	});
});
