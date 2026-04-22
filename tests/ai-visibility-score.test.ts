import { describe, expect, it } from "vitest";
import { computeAiVisibilityScore } from "@/lib/ai/visibility-score";

describe("computeAiVisibilityScore", () => {
	it("is deterministic and bounded 0-100", () => {
		const input = [
			{ engine: "CHATGPT" as const, isVisible: true, position: 1 },
			{ engine: "CHATGPT" as const, isVisible: false, position: null },
			{ engine: "PERPLEXITY" as const, isVisible: true, position: 3 },
			{ engine: "GEMINI" as const, isVisible: false, position: null },
		];
		const a = computeAiVisibilityScore(input);
		const b = computeAiVisibilityScore(input);
		expect(a.overallScore).toBeGreaterThanOrEqual(0);
		expect(a.overallScore).toBeLessThanOrEqual(100);
		expect(a).toEqual(b);
	});

	it("returns 0 with clear reason when no results", () => {
		const score = computeAiVisibilityScore([]);
		expect(score.overallScore).toBe(0);
		expect(score.reasons.join(" ")).toContain("No run results");
	});
});
