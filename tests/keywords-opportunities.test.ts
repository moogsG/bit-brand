import { describe, expect, it } from "vitest";
import { scoreKeywordOpportunities } from "@/lib/keywords/opportunities";
import type { KeywordResearch } from "@/lib/db/schema";

function makeKeyword(
	id: string,
	keyword: string,
	overrides: Partial<KeywordResearch> = {},
): KeywordResearch {
	return {
		id,
		clientId: "client-1",
		keyword,
		monthlyVolume: 100,
		difficulty: 50,
		intent: "INFORMATIONAL",
		priority: "MEDIUM",
		currentPosition: 20,
		targetPosition: 10,
		targetUrl: null,
		notes: null,
		tags: null,
		lastEnrichedAt: null,
		status: "OPPORTUNITY",
		createdBy: "user-1",
		createdAt: new Date("2026-04-17T00:00:00.000Z"),
		updatedAt: new Date("2026-04-17T00:00:00.000Z"),
		...overrides,
	};
}

describe("scoreKeywordOpportunities", () => {
	it("scores stronger signals higher with deterministic ordering", () => {
		const high = makeKeyword("k-high", "running shoes", {
			monthlyVolume: 5000,
			difficulty: 10,
			currentPosition: 30,
			targetPosition: 3,
			status: "OPPORTUNITY",
			priority: "HIGH",
			intent: "TRANSACTIONAL",
		});

		const low = makeKeyword("k-low", "running socks", {
			monthlyVolume: 10,
			difficulty: 90,
			currentPosition: 5,
			targetPosition: 5,
			status: "WON",
			priority: "LOW",
			intent: "NAVIGATIONAL",
		});

		const { opportunities } = scoreKeywordOpportunities([low, high]);

		expect(opportunities[0]?.id).toBe("k-high");
		expect(opportunities[1]?.id).toBe("k-low");
		expect(opportunities[0]?.opportunityScore).toBeGreaterThan(
			opportunities[1]?.opportunityScore ?? 0,
		);
		expect(opportunities[0]?.opportunityScore).toBeLessThanOrEqual(100);
		expect(opportunities[1]?.opportunityScore).toBeGreaterThanOrEqual(0);
	});

	it("clusters keywords using normalized first-two-token keys", () => {
		const k1 = makeKeyword("k1", "Running shoes for women", {
			monthlyVolume: 1200,
		});
		const k2 = makeKeyword("k2", "Running shoes sale", {
			monthlyVolume: 900,
		});
		const k3 = makeKeyword("k3", "the and or", {
			monthlyVolume: 50,
		});

		const { clusters } = scoreKeywordOpportunities([k1, k2, k3]);

		const runningCluster = clusters.find((cluster) => cluster.clusterKey === "runn sho");
		expect(runningCluster).toBeDefined();
		expect(runningCluster).toEqual(
			expect.objectContaining({
				size: 2,
				label: "Runn Sho",
				keywordIds: expect.arrayContaining(["k1", "k2"]),
			}),
		);

		const uncategorized = clusters.find(
			(cluster) => cluster.clusterKey === "uncategorized",
		);
		expect(uncategorized?.label).toBe("Uncategorized");
		expect(uncategorized?.keywordIds).toEqual(["k3"]);
	});

	it("enforces limit bounds and reports meta counts", () => {
		const keywords = Array.from({ length: 250 }, (_, index) =>
			makeKeyword(`k-${index + 1}`, `keyword ${index + 1}`, {
				monthlyVolume: 1000 - index,
			}),
		);

		const minLimited = scoreKeywordOpportunities(keywords, 0);
		expect(minLimited.meta.returnedKeywords).toBe(1);

		const maxLimited = scoreKeywordOpportunities(keywords, 999);
		expect(maxLimited.meta.totalKeywords).toBe(250);
		expect(maxLimited.meta.returnedKeywords).toBe(200);
		expect(maxLimited.opportunities).toHaveLength(200);
	});
});
