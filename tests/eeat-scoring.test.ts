import { describe, expect, it } from "vitest";
import {
	computeEeatScore,
	EEAT_SCORE_VERSION,
	parseEeatRecommendationsJson,
} from "@/lib/eeat/scoring";

describe("eeat scoring", () => {
	it("computes deterministic factor scores and overall score", () => {
		const questionnaireSchema = {
			sections: [
				{
					questions: [
						{ id: "q1", required: true, weight: 2 },
						{ id: "q2", required: false, weight: 1 },
						{ id: "q3", required: true, weight: 3 },
					],
				},
			],
		};

		const responsePayload = {
			q1: "Detailed evidence-backed response that is intentionally longer than eighty characters to max quality.",
			q2: "",
			q3: 5,
		};

		const result = computeEeatScore({ questionnaireSchema, responsePayload });

		expect(result.scoreVersion).toBe(EEAT_SCORE_VERSION);
		expect(result.overallScore).toBe(87.5);
		expect(result.factorBreakdown).toEqual([
			{ key: "coverage", label: "Coverage", score: 66.67, weight: 0.2 },
			{
				key: "requiredCompleteness",
				label: "Required Completeness",
				score: 100,
				weight: 0.3,
			},
			{
				key: "responseQuality",
				label: "Response Quality",
				score: 100,
				weight: 0.15,
			},
			{
				key: "weightedAlignment",
				label: "Weighted Alignment",
				score: 83.33,
				weight: 0.35,
			},
		]);
		expect(result.recommendations).toMatchObject([
			{
				title: "Increase optional answer coverage",
				impact: "MEDIUM",
				effort: "LOW",
				moduleHint: "onboarding",
			},
		]);
	});

	it("keeps all factor and overall scores within [0, 100] bounds", () => {
		const questionnaireSchema = {
			questions: [
				{ id: "huge", required: true, weight: 999 },
				{ id: "negative", required: false, weight: 1 },
				{ id: "bool", required: false, weight: 1 },
			],
		};

		const responsePayload = {
			huge: 99_999,
			negative: -50,
			bool: false,
		};

		const result = computeEeatScore({ questionnaireSchema, responsePayload });

		expect(result.overallScore).toBeGreaterThanOrEqual(0);
		expect(result.overallScore).toBeLessThanOrEqual(100);
		for (const factor of result.factorBreakdown) {
			expect(factor.score).toBeGreaterThanOrEqual(0);
			expect(factor.score).toBeLessThanOrEqual(100);
		}
	});

	it("returns required-question recommendation when required answers are missing", () => {
		const questionnaireSchema = {
			questions: [
				{ id: "r1", required: true },
				{ id: "r2", required: true },
				{ id: "r3", required: true },
				{ id: "r4", required: true },
				{ id: "r5", required: true },
				{ id: "r6", required: true },
			],
		};

		const result = computeEeatScore({
			questionnaireSchema,
			responsePayload: {},
		});

		expect(result.recommendations.length).toBeGreaterThan(0);
		const firstRecommendation = result.recommendations[0];
		if (!firstRecommendation) {
			throw new Error("Expected at least one recommendation");
		}
		expect(firstRecommendation.title).toContain(
			"Answer required questions first: r1, r2, r3, r4, r5",
		);
		expect(firstRecommendation.title).toContain("...");
	});

	it("returns strong-baseline recommendation for high-quality complete responses", () => {
		const questionnaireSchema = {
			questions: [
				{ id: "exp", required: true, weight: 1 },
				{ id: "expertise", required: true, weight: 1 },
				{ id: "trust", required: true, weight: 1 },
			],
		};

		const responsePayload = {
			exp: "Extensive first-hand implementation details with measurable outcomes and lessons learned.",
			expertise:
				"Team bios include credentials, publications, and domain-specific certifications.",
			trust:
				"Independent references, verified testimonials, transparent methodology, and clear sourcing.",
		};

		const result = computeEeatScore({ questionnaireSchema, responsePayload });

		expect(result.overallScore).toBeGreaterThanOrEqual(80);
		expect(result.recommendations).toMatchObject([
			{
				title: "Maintain EEAT baseline with periodic refreshes",
				impact: "MEDIUM",
				effort: "LOW",
			},
		]);
	});

	it("parses legacy string recommendations with backward-compatible structure", () => {
		const parsed = parseEeatRecommendationsJson(
			JSON.stringify([
				"Legacy recommendation text",
				{
					title: "Structured recommendation",
					rationale: "Detailed why",
					impact: "HIGH",
					effort: "LOW",
					moduleHint: "content",
				},
			]),
		);

		expect(parsed).toEqual([
			{
				title: "Legacy recommendation text",
				rationale:
					"Legacy recommendation preserved from prior EEAT scoring format.",
				impact: "MEDIUM",
				effort: "MEDIUM",
			},
			{
				title: "Structured recommendation",
				rationale: "Detailed why",
				impact: "HIGH",
				effort: "LOW",
				moduleHint: "content",
			},
		]);
	});
});
