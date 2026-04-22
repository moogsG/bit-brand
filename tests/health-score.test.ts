import { describe, expect, it } from "vitest";
import {
	computeHealthScore,
	healthScoreConstants,
} from "@/lib/health/score";

describe("health score model", () => {
	it("is deterministic for the same inputs and asOf date", () => {
		const input = {
			technical: {
				connectedSources: 4,
				totalExpectedSources: 5,
				staleSources: 1,
				errorSources: 0,
			},
			contentFreshness: {
				lastUpdatedAt: new Date("2026-04-10T00:00:00.000Z"),
			},
			activeIssues: {
				blockedTasks: 1,
				urgentTasks: 2,
				pendingApprovals: 1,
				unreadClientMessages: 3,
			},
		};

		const asOf = new Date("2026-04-14T00:00:00.000Z");
		const first = computeHealthScore(input, { asOf });
		const second = computeHealthScore(input, { asOf });

		expect(first).toEqual(second);
	});

	it("keeps overall and component scores bounded to 0-100", () => {
		const result = computeHealthScore(
			{
				technical: {
					connectedSources: 999,
					totalExpectedSources: 5,
					staleSources: 999,
					errorSources: 999,
				},
				contentFreshness: {
					lastUpdatedAt: new Date("2018-01-01T00:00:00.000Z"),
				},
				activeIssues: {
					blockedTasks: 999,
					urgentTasks: 999,
					pendingApprovals: 999,
					unreadClientMessages: 999,
				},
			},
			{ asOf: new Date("2026-04-14T00:00:00.000Z") },
		);

		expect(result.overallScore).toBeGreaterThanOrEqual(0);
		expect(result.overallScore).toBeLessThanOrEqual(100);
		expect(result.breakdown.technical.score).toBeGreaterThanOrEqual(0);
		expect(result.breakdown.technical.score).toBeLessThanOrEqual(100);
		expect(result.breakdown.contentFreshness.score).toBeGreaterThanOrEqual(0);
		expect(result.breakdown.contentFreshness.score).toBeLessThanOrEqual(100);
		expect(result.breakdown.activeIssues.score).toBeGreaterThanOrEqual(0);
		expect(result.breakdown.activeIssues.score).toBeLessThanOrEqual(100);
	});

	it("applies explicit defaults for missing data", () => {
		const result = computeHealthScore({}, { asOf: new Date("2026-04-14T00:00:00.000Z") });

		expect(result.breakdown.technical.factors.totalExpectedSources).toBe(
			healthScoreConstants.DEFAULT_TOTAL_EXPECTED_SOURCES,
		);
		expect(result.breakdown.contentFreshness.score).toBe(
			healthScoreConstants.DEFAULT_CONTENT_FRESHNESS_SCORE,
		);
		expect(result.breakdown.contentFreshness.factors.defaultApplied).toBe(true);
		expect(result.breakdown.activeIssues.factors.totalActiveIssues).toBe(0);
		expect(result.reasons.length).toBeGreaterThan(0);
	});

	it("penalizes active issues in a transparent weighted way", () => {
		const lowIssueResult = computeHealthScore(
			{
				activeIssues: {
					blockedTasks: 0,
					urgentTasks: 0,
					pendingApprovals: 0,
					unreadClientMessages: 0,
				},
			},
			{ asOf: new Date("2026-04-14T00:00:00.000Z") },
		);

		const highIssueResult = computeHealthScore(
			{
				activeIssues: {
					blockedTasks: 4,
					urgentTasks: 3,
					pendingApprovals: 2,
					unreadClientMessages: 6,
				},
			},
			{ asOf: new Date("2026-04-14T00:00:00.000Z") },
		);

		expect(highIssueResult.breakdown.activeIssues.score).toBeLessThan(
			lowIssueResult.breakdown.activeIssues.score,
		);
		expect(highIssueResult.breakdown.activeIssues.factors.issueLoadPoints).toBeGreaterThan(
			lowIssueResult.breakdown.activeIssues.factors.issueLoadPoints as number,
		);
	});

	it("treats future content updates as current-day freshness", () => {
		const asOf = new Date("2026-04-14T00:00:00.000Z");
		const result = computeHealthScore(
			{
				contentFreshness: {
					lastUpdatedAt: new Date("2026-04-18T00:00:00.000Z"),
				},
			},
			{ asOf },
		);

		expect(result.breakdown.contentFreshness.factors.daysSinceUpdate).toBe(0);
		expect(result.breakdown.contentFreshness.factors.freshnessBand).toBe("VERY_FRESH");
		expect(result.breakdown.contentFreshness.score).toBe(100);
	});

	it("normalizes invalid count inputs to stable non-negative factors", () => {
		const result = computeHealthScore(
			{
				technical: {
					connectedSources: Number.NaN,
					totalExpectedSources: Number.POSITIVE_INFINITY,
					staleSources: -5,
					errorSources: Number.NEGATIVE_INFINITY,
				},
				activeIssues: {
					blockedTasks: -1,
					urgentTasks: Number.NaN,
					pendingApprovals: Number.NEGATIVE_INFINITY,
					unreadClientMessages: Number.POSITIVE_INFINITY,
				},
			},
			{ asOf: new Date("2026-04-14T00:00:00.000Z") },
		);

		expect(result.breakdown.technical.factors.connectedSources).toBe(0);
		expect(result.breakdown.technical.factors.totalExpectedSources).toBe(
			healthScoreConstants.DEFAULT_TOTAL_EXPECTED_SOURCES,
		);
		expect(result.breakdown.technical.factors.staleSources).toBe(0);
		expect(result.breakdown.technical.factors.errorSources).toBe(0);
		expect(result.breakdown.activeIssues.factors.blockedTasks).toBe(0);
		expect(result.breakdown.activeIssues.factors.urgentTasks).toBe(0);
		expect(result.breakdown.activeIssues.factors.pendingApprovals).toBe(0);
		expect(result.breakdown.activeIssues.factors.unreadClientMessages).toBe(0);
	});
});
