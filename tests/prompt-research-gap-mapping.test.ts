import { describe, expect, it } from "vitest";
import { mapPromptsToKeywordCoverage } from "@/lib/prompt-research/gap-mapping";

describe("prompt research gap mapping", () => {
	it("is deterministic and splits covered vs uncovered", () => {
		const result = mapPromptsToKeywordCoverage({
			prompts: [
				{ id: "p1", text: "best same day delivery florist in sydney" },
				{ id: "p2", text: "how to choose a florist" },
			],
			keywords: [
				{ id: "k1", keyword: "same day delivery florist sydney", targetUrl: "https://x/y" },
				{ id: "k2", keyword: "florist near me" },
			],
		});

		expect(result.covered.some((p) => p.promptId === "p1")).toBe(true);
		expect(result.uncovered.some((p) => p.promptId === "p2")).toBe(true);
		// Determinism
		expect(mapPromptsToKeywordCoverage({
			prompts: [
				{ id: "p1", text: "best same day delivery florist in sydney" },
				{ id: "p2", text: "how to choose a florist" },
			],
			keywords: [
				{ id: "k1", keyword: "same day delivery florist sydney", targetUrl: "https://x/y" },
				{ id: "k2", keyword: "florist near me" },
			],
		})).toEqual(result);
	});
});
