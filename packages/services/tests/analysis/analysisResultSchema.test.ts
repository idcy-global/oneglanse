import { describe, expect, it } from "vitest";
import { parseBrandAnalysisResult } from "../../src/analysis/analysisResultSchema.js";

const absent = {
	geoScore: { overall: 0 },
	presence: { mentioned: false, visibility: 0 },
	position: { rankPosition: null },
	sentiment: { score: 0 },
	recommendation: { type: "not_mentioned" },
	competitors: [],
	perception: {
		coreClaims: [],
		differentiators: [],
		bestKnownFor: null,
		pricingPerception: "not_mentioned",
	},
	risks: { items: [] },
};

const mentioned = {
	geoScore: { overall: 86 },
	presence: { mentioned: true, visibility: 65 },
	position: { rankPosition: 1 },
	sentiment: { score: 80 },
	recommendation: { type: "top_pick" },
	competitors: [
		{
			name: "Competitor A",
			domain: null,
			visibility: 35,
			sentiment: 55,
			rankPosition: 2,
			isRecommended: false,
		},
	],
	perception: {
		coreClaims: ["Reliable platform"],
		differentiators: ["Strong support"],
		bestKnownFor: "Managed hosting",
		pricingPerception: "mid_range",
	},
	risks: { items: [{ severity: "info" }] },
};

describe("parseBrandAnalysisResult", () => {
	it("accepts the exact absent-brand defaults", () => {
		expect(parseBrandAnalysisResult(absent, "Target Brand", "target.example")).toMatchObject({
			presence: { mentioned: false, visibility: 0 },
			sentiment: { score: 0 },
			recommendation: { type: "not_mentioned" },
		});
	});

	it("accepts valid analysis and normalizes a null competitor domain", () => {
		const result = parseBrandAnalysisResult(
			mentioned,
			"Target Brand",
			"target.example",
		);
		expect(result.competitors[0]?.domain).toBe("");
	});

	it("rejects a GEO score that does not match the weighted component formula", () => {
		expect(() =>
			parseBrandAnalysisResult(
				{ ...mentioned, geoScore: { overall: 50 } },
				"Target Brand",
				"target.example",
			),
		).toThrow("GEO result contract");
	});

	it("rejects scores outside the documented 0–100 range", () => {
		expect(() =>
			parseBrandAnalysisResult(
				{ ...mentioned, geoScore: { overall: 101 } },
				"Target Brand",
				"target.example",
			),
		).toThrow("GEO result contract");
	});

	it("rejects inconsistent absent-brand metrics", () => {
		expect(() =>
			parseBrandAnalysisResult(
				{ ...absent, sentiment: { score: 50 } },
				"Target Brand",
				"target.example",
			),
		).toThrow("GEO result contract");
	});

	it("rejects a top pick that is not absolute rank one", () => {
		expect(() =>
			parseBrandAnalysisResult(
				{ ...mentioned, position: { rankPosition: 2 } },
				"Target Brand",
				"target.example",
			),
		).toThrow("GEO result contract");
	});

	it("rejects the target brand and duplicate brands in competitor output", () => {
		expect(() =>
			parseBrandAnalysisResult(
				{
					...mentioned,
					competitors: [
						...mentioned.competitors,
						{
							name: "Target Brand",
							domain: "other.example",
							visibility: 20,
							sentiment: 50,
							rankPosition: 3,
							isRecommended: false,
						},
					],
				},
				"Target Brand",
				"target.example",
			),
		).toThrow("target brand as a competitor");

		expect(() =>
			parseBrandAnalysisResult(
				{
					...mentioned,
					competitors: [
						...mentioned.competitors,
						{
							...mentioned.competitors[0],
							name: "competitor a",
						},
					],
				},
				"Target Brand",
				"target.example",
			),
		).toThrow("duplicate competitor");
	});
});
