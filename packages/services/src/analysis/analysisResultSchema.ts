import { ValidationError } from "@oneglanse/errors";
import type { BrandAnalysisResult } from "@oneglanse/types";
import { z } from "zod";

const scoreSchema = z.number().finite().min(0).max(100);
const rankSchema = z.number().int().positive().nullable();

const brandAnalysisSchema = z
	.object({
		geoScore: z.object({ overall: scoreSchema }).strict(),
		presence: z
			.object({
				mentioned: z.boolean(),
				visibility: scoreSchema,
			})
			.strict(),
		position: z.object({ rankPosition: rankSchema }).strict(),
		sentiment: z.object({ score: scoreSchema }).strict(),
		recommendation: z
			.object({
				type: z.enum([
					"top_pick",
					"strong_alternative",
					"conditional",
					"mentioned_only",
					"discouraged",
					"not_mentioned",
				]),
			})
			.strict(),
		competitors: z
			.array(
				z
					.object({
						name: z.string().trim().min(1),
						domain: z
							.union([z.string(), z.null()])
							.transform((value) => value?.trim() ?? ""),
						visibility: scoreSchema,
						sentiment: scoreSchema,
						rankPosition: rankSchema,
						isRecommended: z.boolean(),
					})
					.strict(),
			)
			.default([]),
		perception: z
			.object({
				coreClaims: z.array(z.string().trim().min(1)).max(5).default([]),
				differentiators: z.array(z.string().trim().min(1)).max(5).default([]),
				bestKnownFor: z.string().trim().nullable().default(null),
				pricingPerception: z
					.enum(["premium", "mid_range", "budget", "free", "not_mentioned"])
					.default("not_mentioned"),
			})
			.strict(),
		risks: z
			.object({
				items: z
					.array(
						z
							.object({
								severity: z.enum(["critical", "warning", "info"]),
							})
							.strict(),
					)
					.default([]),
			})
			.strict(),
	})
	.strict()
	.superRefine((value, ctx) => {
		if (!value.presence.mentioned) {
			const absentDefaultsAreValid =
				value.geoScore.overall === 0 &&
				value.presence.visibility === 0 &&
				value.position.rankPosition === null &&
				value.sentiment.score === 0 &&
				value.recommendation.type === "not_mentioned" &&
				value.perception.coreClaims.length === 0 &&
				value.perception.differentiators.length === 0 &&
				value.perception.bestKnownFor === null &&
				value.perception.pricingPerception === "not_mentioned" &&
				value.risks.items.length === 0;

			if (!absentDefaultsAreValid) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["presence", "mentioned"],
					message: "Absent brands must use the zeroed-out default metrics.",
				});
			}
		} else {
			if (value.presence.visibility < 1) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["presence", "visibility"],
					message: "A mentioned brand must have visibility of at least 1.",
				});
			}
			if (value.recommendation.type === "not_mentioned") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["recommendation", "type"],
					message: "A mentioned brand cannot use not_mentioned recommendation.",
				});
			}
		}

		if (
			value.recommendation.type === "top_pick" &&
			value.position.rankPosition !== 1
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["position", "rankPosition"],
				message: "top_pick requires absolute rank position 1.",
			});
		}

		if (value.presence.mentioned) {
			const rankValue =
				value.position.rankPosition === null
					? 15
					: ({
							1: 100,
							2: 80,
							3: 65,
							4: 50,
							5: 40,
						}[value.position.rankPosition] ??
							30);
			const recommendationValue = {
				top_pick: 100,
				strong_alternative: 80,
				conditional: 60,
				mentioned_only: 30,
				discouraged: 10,
				not_mentioned: 0,
			}[value.recommendation.type];
			const expectedGeoScore = Math.round(
				(value.presence.visibility +
					rankValue +
					value.sentiment.score +
					recommendationValue) /
					4,
			);

			if (Math.abs(value.geoScore.overall - expectedGeoScore) > 3) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["geoScore", "overall"],
					message: "GEO score must match the documented weighted formula within 3 points.",
				});
			}
			if (value.sentiment.score <= 20 && value.geoScore.overall > 25) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["geoScore", "overall"],
					message: "A sentiment score at or below 20 caps GEO score at 25.",
				});
			}
			if (
				(value.presence.visibility <= 15 && value.geoScore.overall > 45) ||
				(value.presence.visibility < 20 && value.geoScore.overall > 40)
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["geoScore", "overall"],
					message: "Low visibility must apply the documented GEO score cap.",
				});
			}
			if (
				value.recommendation.type === "discouraged" &&
				value.geoScore.overall > 30
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["geoScore", "overall"],
					message: "A discouraged recommendation caps GEO score at 30.",
				});
			}
			if (
				value.recommendation.type === "mentioned_only" &&
				value.geoScore.overall > 35
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["geoScore", "overall"],
					message: "A mentioned-only recommendation caps GEO score at 35.",
				});
			}
		}
	});

function normalizeDomain(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/^https?:\/\//, "")
		.replace(/^www\./, "")
		.split(/[/?#]/, 1)[0]
		.replace(/\.$/, "");
}

export function parseBrandAnalysisResult(
	input: unknown,
	brandName: string,
	brandDomain: string,
): BrandAnalysisResult {
	const parsed = brandAnalysisSchema.safeParse(input);
	if (!parsed.success) {
		throw new ValidationError("LLM analysis does not match the GEO result contract.", {
			issues: parsed.error.issues.map((issue) => ({
				path: issue.path.join("."),
				message: issue.message,
			})),
		});
	}

	const targetName = brandName.trim().toLowerCase();
	const targetDomain = normalizeDomain(brandDomain);
	const competitorNames = new Set<string>();

	for (const [index, competitor] of parsed.data.competitors.entries()) {
		const normalizedName = competitor.name.trim().toLowerCase();
		const normalizedDomain = normalizeDomain(competitor.domain);

		if (
			normalizedName === targetName ||
			(normalizedDomain !== "" && normalizedDomain === targetDomain)
		) {
			throw new ValidationError(
				"LLM analysis incorrectly included the target brand as a competitor.",
				{ competitorIndex: index, competitorName: competitor.name },
			);
		}

		if (competitorNames.has(normalizedName)) {
			throw new ValidationError(
				"LLM analysis contains duplicate competitor brands.",
				{ competitorIndex: index, competitorName: competitor.name },
			);
		}
		competitorNames.add(normalizedName);
	}

	return parsed.data;
}
