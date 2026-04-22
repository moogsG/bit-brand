import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		all: vi.fn(),
		get: vi.fn(),
	},
}));

describe("prompt research recommendations service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-15T00:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("produces deterministic recommendation ordering for the same inputs", async () => {
		const { db } = await import("@/lib/db");
		const { buildPromptResearchRecommendations } = await import(
			"@/lib/prompt-research/recommendations"
		);
		const dbAny = db as any;

		const prompts = [
			{ id: "p1", text: "same day delivery florist sydney", isActive: true },
			{ id: "p2", text: "affordable wedding florist melbourne", isActive: true },
			{ id: "p3", text: "how to preserve flowers", isActive: true },
			{ id: "p4", text: "best anniversary gifts", isActive: true },
		];
		const keywords = [
			{ id: "k1", keyword: "same day delivery florist sydney", targetUrl: "https://acme.com/sydney" },
			{ id: "k2", keyword: "wedding florist melbourne", targetUrl: "https://acme.com/melbourne" },
		];
		const citations = [
			{ domain: "example.com", freshnessHint: "STALE" },
			{ domain: "example.com", freshnessHint: "STALE" },
			{ domain: "example.com", freshnessHint: "STALE" },
			{ domain: "example.com", freshnessHint: "STALE" },
			{ domain: "example.com", freshnessHint: "STALE" },
			{ domain: "example.com", freshnessHint: "FRESH" },
			{ domain: "example.com", freshnessHint: "FRESH" },
			{ domain: "other.com", freshnessHint: "FRESH" },
			{ domain: "other.com", freshnessHint: "FRESH" },
			{ domain: "other.com", freshnessHint: "FRESH" },
		];

		dbAny.get
			.mockResolvedValueOnce({ domain: "acme.com" })
			.mockResolvedValueOnce({ id: "set-1", name: "Core Prompt Set" })
			.mockResolvedValueOnce({ domain: "acme.com" })
			.mockResolvedValueOnce({ id: "set-1", name: "Core Prompt Set" });

		dbAny.all
			.mockResolvedValueOnce(prompts)
			.mockResolvedValueOnce(keywords)
			.mockResolvedValueOnce(citations)
			.mockResolvedValueOnce(prompts)
			.mockResolvedValueOnce(keywords)
			.mockResolvedValueOnce(citations);

		const first = await buildPromptResearchRecommendations({
			clientId: "client-1",
			windowDays: 90,
			limit: 5,
		});
		const second = await buildPromptResearchRecommendations({
			clientId: "client-1",
			windowDays: 90,
			limit: 5,
		});

		expect(first).toEqual(second);
		expect(first.startDate).toBe("2026-01-15");
		expect(first.totals).toEqual({
			totalPrompts: 4,
			uncoveredPrompts: 2,
			totalCitations: 10,
			uniqueDomains: 2,
		});
		expect(first.recommendations.map((item) => item.id)).toEqual([
			"close-prompt-coverage-gaps",
			"diversify-citation-footprint",
			"refresh-stale-evidence",
			"increase-first-party-presence",
		]);
	});

	it("returns empty recommendations when no active prompt set exists", async () => {
		const { db } = await import("@/lib/db");
		const { buildPromptResearchRecommendations } = await import(
			"@/lib/prompt-research/recommendations"
		);
		const dbAny = db as any;

		dbAny.get
			.mockResolvedValueOnce({ domain: "acme.com" })
			.mockResolvedValueOnce(undefined);

		const result = await buildPromptResearchRecommendations({
			clientId: "client-1",
			windowDays: 30,
			limit: 5,
		});

		expect(result.startDate).toBe("2026-03-16");
		expect(result.promptSet).toBeNull();
		expect(result.totals).toEqual({
			totalPrompts: 0,
			uncoveredPrompts: 0,
			totalCitations: 0,
			uniqueDomains: 0,
		});
		expect(result.recommendations).toEqual([]);
	});
});
