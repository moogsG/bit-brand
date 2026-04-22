import { describe, expect, it } from "vitest";
import {
	CLIENT_CONTEXT_VERSION,
	buildClientContextPayload,
	clientContextPayloadSchema,
} from "@/lib/ai/context-builder";
import { buildEmptyOnboardingProfile } from "@/lib/onboarding";

describe("client context builder", () => {
	it("builds a stable, schema-valid payload", async () => {
		const now = new Date("2026-04-14T12:00:00.000Z");
		const payload = await buildClientContextPayload("client-1", {
			now,
			dependencies: {
				loadClientRecord: async () => ({
					name: "Acme Corp",
					domain: "acme.com",
					slug: "acme-corp",
				}),
				loadOnboardingProfile: async () => ({
					clientId: "client-1",
					profile: {
						id: "profile-1",
						version: 2,
						status: "COMPLETED",
						completedAt: new Date("2026-03-01T00:00:00.000Z"),
						createdAt: new Date("2026-02-01T00:00:00.000Z"),
						updatedAt: new Date("2026-03-02T00:00:00.000Z"),
					},
					businessFundamentals: null,
					northStarGoal: {
						statement: "Grow qualified organic leads",
						metricName: "MQLs",
						currentValue: 120,
						targetValue: 200,
						targetDate: "2026-12-31",
						timeHorizonMonths: 9,
						confidenceNotes: null,
					},
					conversionArchitecture: null,
					strategicLevers: [
						{ lever: "Content refresh", priority: "HIGH", ownerRole: null, notes: null },
					],
					competitors: [],
					currentStateBaseline: null,
				}),
				loadHealthAggregate: async () => ({
					client: {
						id: "client-1",
						name: "Acme Corp",
						domain: "acme.com",
						slug: "acme-corp",
						industry: "SaaS",
						isActive: true,
						createdAt: new Date("2025-01-01T00:00:00.000Z"),
					},
					aggregates: {
						technical: {
							connectedSources: 4,
							totalConfiguredSources: 5,
							staleSources: 1,
							errorSources: 0,
							totalExpectedSources: 5,
						},
						contentFreshness: {
							lastUpdatedAt: new Date("2026-04-01T00:00:00.000Z"),
						},
						activeIssues: {
							blockedTasks: 0,
							urgentTasks: 1,
							pendingApprovals: 1,
							unreadClientMessages: 0,
						},
					},
					health: {
						overallScore: 78,
						status: "WATCH",
						reasons: ["Freshness window exceeded 30 days."],
						breakdown: {
							technical: {
								score: 82,
								weight: 0.45,
								weightedContribution: 36.9,
								factors: {},
							},
							contentFreshness: {
								score: 70,
								weight: 0.25,
								weightedContribution: 17.5,
								factors: {},
							},
							activeIssues: {
								score: 80,
								weight: 0.3,
								weightedContribution: 24,
								factors: {},
							},
						},
					},
				}),
				loadKpiData: async () => ({
					ga4Current: [
						{ date: "2026-04-10", organicSessions: 100 },
						{ date: "2026-04-11", organicSessions: 150 },
					],
					ga4Previous: [
						{ date: "2026-03-10", organicSessions: 80 },
						{ date: "2026-03-11", organicSessions: 120 },
					],
					gscCurrent: [
						{ clicks: 50, avgPosition: 15 },
						{ clicks: 70, avgPosition: 14 },
					],
					gscPrevious: [
						{ clicks: 40, avgPosition: 18 },
						{ clicks: 60, avgPosition: 17 },
					],
					mozLatest: { date: "2026-04-12", domainAuthority: 42 },
					aiVisibilityLatest: { date: "2026-04-13", overallScore: 67 },
				}),
				loadActiveStrategies: async () => [
					{
						id: "strategy-1",
						title: "Q2 Growth Plan",
						status: "PUBLISHED",
						updatedAt: new Date("2026-04-10T00:00:00.000Z"),
						publishedAt: new Date("2026-04-10T00:00:00.000Z"),
						sections: JSON.stringify([
							{ id: "a", title: "A", content: "Some content", order: 1 },
							{ id: "b", title: "B", content: "", order: 2 },
						]),
					},
				],
				loadActiveReports: async () => [
					{
						id: "report-1",
						title: "April 2026 — SEO Report",
						status: "DRAFT",
						month: 4,
						year: 2026,
						updatedAt: new Date("2026-04-12T00:00:00.000Z"),
						publishedAt: null,
						sections: JSON.stringify({
							executiveSummary: { adminNotes: "Strong month" },
							wins: { adminNotes: "", autoData: { items: [1] } },
						}),
					},
				],
				loadKeywordOpportunities: async () => [
					{
						id: "kw-1",
						keyword: "acme platform pricing",
						priority: "HIGH",
						status: "OPPORTUNITY",
					},
				],
			},
		});

		expect(payload.version).toBe(CLIENT_CONTEXT_VERSION);
		expect(payload.generatedAt).toBe("2026-04-14T12:00:00.000Z");
		expect(payload.clientId).toBe("client-1");
		expect(payload.kpis.organicSessions30d.current).toBe(250);
		expect(payload.kpis.organicSessions30d.previous).toBe(200);
		expect(payload.activeArtifacts.strategies[0]?.sectionCount).toBe(2);
		expect(payload.activeArtifacts.strategies[0]?.nonEmptySectionCount).toBe(1);
		expect(payload.activeArtifacts.reports[0]?.filledSectionCount).toBe(2);
		expect(payload.opportunities.items.length).toBeGreaterThan(0);
		expect(clientContextPayloadSchema.safeParse(payload).success).toBe(true);
	});

	it("returns safe defaults when partial data is missing", async () => {
		const now = new Date("2026-04-14T12:00:00.000Z");
		const payload = await buildClientContextPayload("client-2", {
			now,
			dependencies: {
				loadClientRecord: async () => null,
				loadOnboardingProfile: async () => buildEmptyOnboardingProfile("client-2"),
				loadHealthAggregate: async () => null,
				loadKpiData: async () => {
					throw new Error("No metrics available");
				},
				loadActiveStrategies: async () => [
					{
						id: "strategy-bad",
						title: "Malformed strategy",
						status: "DRAFT",
						updatedAt: new Date("2026-04-10T00:00:00.000Z"),
						publishedAt: null,
						sections: "not json",
					},
				],
				loadActiveReports: async () => [
					{
						id: "report-bad",
						title: "Malformed report",
						status: "DRAFT",
						month: 4,
						year: 2026,
						updatedAt: new Date("2026-04-12T00:00:00.000Z"),
						publishedAt: null,
						sections: "not json",
					},
				],
				loadKeywordOpportunities: async () => [],
			},
		});

		expect(payload.client.name).toBeNull();
		expect(payload.onboarding.isOnboarded).toBe(false);
		expect(payload.kpis.organicSessions30d.current).toBeNull();
		expect(payload.kpis.totalClicks30d.current).toBeNull();
		expect(payload.kpis.health.status).toBeNull();
		expect(payload.activeArtifacts.strategies[0]?.sectionCount).toBe(0);
		expect(payload.activeArtifacts.reports[0]?.filledSectionCount).toBe(0);
		expect(payload.opportunities.items).toEqual([]);
		expect(payload.risks.items.length).toBeGreaterThan(0);
		expect(clientContextPayloadSchema.safeParse(payload).success).toBe(true);
	});
});
