import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
	auth: vi.fn(),
}));

vi.mock("@/lib/auth/authorize", () => ({
	can: vi.fn(),
	resolvePermissionRole: vi.fn(),
}));

vi.mock("@/lib/auth/client-access", () => ({
	getClientAccessContext: vi.fn(),
}));

vi.mock("@/lib/ai/context-builder", () => ({
	buildClientContextPayload: vi.fn(),
}));

vi.mock("@/lib/prompt-research/recommendations", () => ({
	buildPromptResearchRecommendations: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		get: vi.fn(),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
	},
}));

describe("ai lens recommend API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_AI_VISIBILITY_V1 = "true";
		process.env.FF_PROMPT_RESEARCH_V1 = "true";
		process.env.FF_LENS_ROUTER_V2 = "false";
		process.env.FF_AI_INTERACTIONS_V1 = "false";

		const { auth } = await import("@/lib/auth");
		const { can, resolvePermissionRole } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { buildClientContextPayload } = await import("@/lib/ai/context-builder");
		const { buildPromptResearchRecommendations } = await import(
			"@/lib/prompt-research/recommendations"
		);
		const { db } = await import("@/lib/db");

		vi.mocked(auth).mockResolvedValue({
			user: { id: "user-1", role: "ADMIN", rawRole: "ACCOUNT_MANAGER" },
		} as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(resolvePermissionRole).mockReturnValue("ACCOUNT_MANAGER");
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});
		vi.mocked(db.get).mockReturnValue({ id: "client-1" });
		vi.mocked(buildClientContextPayload).mockResolvedValue({
			version: "1.0.0",
			generatedAt: "2026-04-14T12:00:00.000Z",
			clientId: "client-1",
			client: { name: "Acme", domain: "acme.com", slug: "acme" },
			onboarding: {
				isOnboarded: true,
				profileVersion: 1,
				status: "COMPLETED",
				completedAt: "2026-04-01T00:00:00.000Z",
				northStar: {
					statement: "Grow qualified leads",
					metricName: "Leads",
					currentValue: 10,
					targetValue: 20,
					targetDate: "2026-12-31",
					timeHorizonMonths: 9,
				},
				strategicLeversCount: 2,
				competitorsCount: 1,
			},
			kpis: {
				organicSessions30d: {
					current: 100,
					previous: 80,
					changePct: 25,
					asOfDate: "2026-04-14",
				},
				totalClicks30d: {
					current: 50,
					previous: 40,
					changePct: 25,
					asOfDate: "2026-04-14",
				},
				averagePosition30d: {
					current: 14,
					previous: 16,
					changePct: -12.5,
					asOfDate: "2026-04-14",
				},
				domainAuthority: { current: 42, asOfDate: "2026-04-13" },
				aiVisibilityOverall: { current: 67, asOfDate: "2026-04-13" },
				health: { overallScore: 79, status: "WATCH", reasons: [] },
			},
			activeArtifacts: { strategies: [], reports: [] },
			opportunities: {
				placeholder: "Module assistants can append prioritized opportunities after analysis.",
				items: [],
			},
			risks: {
				placeholder: "Module assistants can append risks and mitigations after analysis.",
				items: [],
			},
		});
		vi.mocked(buildPromptResearchRecommendations).mockResolvedValue({
			version: "1.0.0",
			clientId: "client-1",
			windowDays: 90,
			startDate: "2026-01-15",
			promptSet: { id: "set-1", name: "Core Prompt Set" },
			totals: {
				totalPrompts: 12,
				uncoveredPrompts: 4,
				totalCitations: 40,
				uniqueDomains: 15,
			},
			recommendations: [
				{
					id: "close-prompt-coverage-gaps",
					title: "Close uncovered prompt intent gaps",
					priority: "HIGH",
					rationale: "4 of 12 prompts are currently uncovered.",
					action: "Map prompts to keyword targets.",
					evidence: {
						uncoveredPrompts: 4,
						uncoveredRate: 0.3333,
					},
				},
			],
		} as any);
	});

	it.skip("returns 404 when ai-visibility module is feature-flagged off", async () => {
		process.env.FF_AI_VISIBILITY_V1 = "false";

		const { POST } = await import("@/app/api/ai/lens/recommend/route");
		const request = new Request("http://localhost:3000/api/ai/lens/recommend", {
			method: "POST",
			body: JSON.stringify({
				module: "ai-visibility",
				clientId: "client-1",
				question: "How do we improve AI visibility this month?",
			}),
		});

		const response = await POST(request as any);

		expect(response.status).toBe(404);
		const data = await response.json();
		expect(data.error).toEqual({
			code: "MODULE_DISABLED",
			message: "AI visibility lens recommendations are disabled in this environment",
		});
	});

	it("returns 400 for invalid payload", async () => {
		const { POST } = await import("@/app/api/ai/lens/recommend/route");
		const request = new Request("http://localhost:3000/api/ai/lens/recommend", {
			method: "POST",
			body: JSON.stringify({ clientId: "client-1", question: "What next?" }),
		});

		const response = await POST(request as any);

		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error.code).toBe("VALIDATION_ERROR");
	});

	it("returns 403 when authorization check fails", async () => {
		const { can } = await import("@/lib/auth/authorize");
		vi.mocked(can).mockReturnValueOnce(false);

		const { POST } = await import("@/app/api/ai/lens/recommend/route");
		const request = new Request("http://localhost:3000/api/ai/lens/recommend", {
			method: "POST",
			body: JSON.stringify({
				module: "reports",
				clientId: "client-1",
				question: "What should we do this month?",
			}),
		});

		const response = await POST(request as any);

		expect(response.status).toBe(403);
		const data = await response.json();
		expect(data.error).toEqual({ code: "FORBIDDEN", message: "Forbidden" });
	});

	it("returns recommendation envelope and records interaction audit", async () => {
		const { POST } = await import("@/app/api/ai/lens/recommend/route");
		const { db } = await import("@/lib/db");

		const request = new Request("http://localhost:3000/api/ai/lens/recommend", {
			method: "POST",
			body: JSON.stringify({
				module: "keywords",
				clientId: "client-1",
				question: "What quick wins can we prioritize?",
			}),
		});

		const response = await POST(request as any);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data).toEqual(
			expect.objectContaining({
				version: "1.0.0",
				success: true,
				error: null,
				data: expect.objectContaining({
					clientId: "client-1",
					module: "keywords",
					lens: expect.objectContaining({
						key: "keywords",
						displayName: expect.any(String),
					}),
					scope: "agency-full",
					contextVersion: "1.0.0",
					recommendation: expect.objectContaining({
						type: "LENS_ROUTER_V2_RULE_BASED",
						lensKey: "keywords",
						lensDisplayName: expect.any(String),
						safePreviewOnly: true,
						signals: expect.any(Array),
						suggestedActions: expect.any(Array),
					}),
				}),
			}),
		);
		expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1);
	});

	it("records an interaction audit row when the audit flag is enabled", async () => {
		process.env.FF_AI_INTERACTIONS_V1 = "true";

		const { POST } = await import("@/app/api/ai/lens/recommend/route");
		const { db } = await import("@/lib/db");

		const request = new Request("http://localhost:3000/api/ai/lens/recommend", {
			method: "POST",
			body: JSON.stringify({
				module: "keywords",
				clientId: "client-1",
				question: "What quick wins can we prioritize?",
			}),
		});

		const response = await POST(request as any);
		expect(response.status).toBe(200);

		expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1);
		expect(vi.mocked(db.values)).toHaveBeenCalledTimes(1);
		const [auditValues] = vi.mocked(db.values).mock.calls[0] ?? [];
		expect(auditValues).toEqual(
			expect.objectContaining({
				routeKey: "ai.lens.recommend",
				clientId: "client-1",
				success: true,
				httpStatus: 200,
			}),
		);
		// Ensure no raw question content is persisted.
		expect(String(JSON.stringify(auditValues))).not.toContain("What quick wins");
	});

	it("uses lens router v2 behavior when flag is enabled", async () => {
		process.env.FF_LENS_ROUTER_V2 = "true";

		const { POST } = await import("@/app/api/ai/lens/recommend/route");
		const request = new Request("http://localhost:3000/api/ai/lens/recommend", {
			method: "POST",
			body: JSON.stringify({
				module: "keywords",
				clientId: "client-1",
				question: "What quick wins can we prioritize?",
			}),
		});

		const response = await POST(request as any);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.data.recommendation.type).toBe("LENS_ROUTER_V2_RULE_BASED");
		expect(data.data.recommendation.summary).toContain("Lens Router v2");
		expect(data.data.recommendation.details).toBeTruthy();
	});

	it("returns module-specific v2 details for different lenses", async () => {
		process.env.FF_LENS_ROUTER_V2 = "true";

		const { POST } = await import("@/app/api/ai/lens/recommend/route");

		const technicalReq = new Request("http://localhost:3000/api/ai/lens/recommend", {
			method: "POST",
			body: JSON.stringify({
				module: "technical",
				clientId: "client-1",
				question: "What should we fix first?",
			}),
		});

		const reportingReq = new Request("http://localhost:3000/api/ai/lens/recommend", {
			method: "POST",
			body: JSON.stringify({
				module: "reporting",
				clientId: "client-1",
				question: "Draft a narrative outline",
			}),
		});

		const [technicalRes, reportingRes] = await Promise.all([
			POST(technicalReq as any),
			POST(reportingReq as any),
		]);

		expect(technicalRes.status).toBe(200);
		expect(reportingRes.status).toBe(200);
		const technicalJson = await technicalRes.json();
		const reportingJson = await reportingRes.json();

		expect(technicalJson.data.lens.key).toBe("technical");
		expect(technicalJson.data.recommendation.details.auditCategories).toBeTruthy();

		expect(reportingJson.data.lens.key).toBe("reporting");
		expect(reportingJson.data.recommendation.details.narrativeOutline).toBeTruthy();
	});

	it("includes prompt-research service recommendations in v2 details when available", async () => {
		process.env.FF_LENS_ROUTER_V2 = "true";

		const { buildPromptResearchRecommendations } = await import(
			"@/lib/prompt-research/recommendations"
		);
		const { POST } = await import("@/app/api/ai/lens/recommend/route");
		const request = new Request("http://localhost:3000/api/ai/lens/recommend", {
			method: "POST",
			body: JSON.stringify({
				module: "prompt-research",
				clientId: "client-1",
				question: "What prompt research actions should we take next?",
			}),
		});

		const response = await POST(request as any);

		expect(response.status).toBe(200);
		expect(vi.mocked(buildPromptResearchRecommendations)).toHaveBeenCalledWith({
			clientId: "client-1",
			windowDays: 90,
			limit: 3,
		});

		const data = await response.json();
		expect(data.data.module).toBe("prompt-research");
		expect(data.data.recommendation.type).toBe("LENS_ROUTER_V2_RULE_BASED");
		expect(data.data.recommendation.details.recommendationSource).toBe(
			"prompt-research-service-v1",
		);
		expect(data.data.recommendation.details.promptResearch).toEqual(
			expect.objectContaining({
				windowDays: 90,
				promptSet: { id: "set-1", name: "Core Prompt Set" },
				totals: expect.objectContaining({
					totalPrompts: 12,
					uncoveredPrompts: 4,
				}),
				recommendations: [
					expect.objectContaining({
						id: "close-prompt-coverage-gaps",
						priority: "HIGH",
					}),
				],
			}),
		);
	});
});
