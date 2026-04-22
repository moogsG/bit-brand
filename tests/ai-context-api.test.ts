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

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		get: vi.fn(),
	},
}));

	describe("ai context API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_AI_CONTEXT_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can, resolvePermissionRole } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { buildClientContextPayload } = await import("@/lib/ai/context-builder");
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
					statement: "Grow",
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
	});

	it.skip("returns 404 envelope when ai context flag is disabled", async () => {
		process.env.FF_AI_CONTEXT_V1 = "false";

		const { GET } = await import("@/app/api/ai/context/[clientId]/route");
		const request = new Request("http://localhost:3000/api/ai/context/client-1");
		const response = await GET(request as any, {
			params: Promise.resolve({ clientId: "client-1" }),
		});

		expect(response.status).toBe(404);
		const data = await response.json();
		expect(data.error).toEqual(
			expect.objectContaining({
				code: "FEATURE_DISABLED",
			}),
		);

		process.env.FF_AI_CONTEXT_V1 = "true";
	});

	it("returns 401 envelope when unauthenticated", async () => {
		const { auth } = await import("@/lib/auth");
		vi.mocked(auth as any).mockResolvedValueOnce(null);

		const { GET } = await import("@/app/api/ai/context/[clientId]/route");
		const request = new Request("http://localhost:3000/api/ai/context/client-1");
		const response = await GET(request as any, {
			params: Promise.resolve({ clientId: "client-1" }),
		});

		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data).toEqual(
			expect.objectContaining({
				version: "1.0.0",
				success: false,
				data: null,
				error: {
					code: "UNAUTHORIZED",
					message: "Unauthorized",
				},
			}),
		);
	});

	it("returns 403 when authorization check fails", async () => {
		const { can } = await import("@/lib/auth/authorize");
		vi.mocked(can).mockReturnValueOnce(false);

		const { GET } = await import("@/app/api/ai/context/[clientId]/route");
		const request = new Request("http://localhost:3000/api/ai/context/client-1");
		const response = await GET(request as any, {
			params: Promise.resolve({ clientId: "client-1" }),
		});

		expect(response.status).toBe(403);
		const data = await response.json();
		expect(data.error).toEqual({ code: "FORBIDDEN", message: "Forbidden" });
	});

	it("returns client-safe subset response for client-equivalent role", async () => {
		const { resolvePermissionRole } = await import("@/lib/auth/authorize");
		const { buildClientContextPayload } = await import("@/lib/ai/context-builder");
		vi.mocked(resolvePermissionRole).mockReturnValueOnce("CLIENT_ADMIN");
		vi.mocked(buildClientContextPayload).mockResolvedValueOnce({
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
					statement: "Grow",
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
				items: [{ title: "Potential growth page" }],
			},
			risks: {
				placeholder: "Module assistants can append risks and mitigations after analysis.",
				items: [{ title: "Ranking volatility" }],
			},
		});

		const { GET } = await import("@/app/api/ai/context/[clientId]/route");
		const request = new Request("http://localhost:3000/api/ai/context/client-1");
		const response = await GET(request as any, {
			params: Promise.resolve({ clientId: "client-1" }),
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data).toEqual(
			expect.objectContaining({
				version: "1.0.0",
				success: true,
				error: null,
				data: expect.objectContaining({
					clientId: "client-1",
					scope: "client-safe",
					context: expect.objectContaining({
						opportunities: expect.objectContaining({ items: [] }),
						risks: expect.objectContaining({ items: [] }),
					}),
				}),
			}),
		);
	});

	it("returns 404 envelope when target client is missing", async () => {
		const { db } = await import("@/lib/db");
		vi.mocked(db.get).mockReturnValueOnce(undefined);

		const { GET } = await import("@/app/api/ai/context/[clientId]/route");
		const request = new Request("http://localhost:3000/api/ai/context/client-missing");
		const response = await GET(request as any, {
			params: Promise.resolve({ clientId: "client-missing" }),
		});

		expect(response.status).toBe(404);
		const data = await response.json();
		expect(data.error).toEqual({ code: "CLIENT_NOT_FOUND", message: "Client not found" });
	});

	it("returns 500 envelope when context building fails", async () => {
		const { buildClientContextPayload } = await import("@/lib/ai/context-builder");
		vi.mocked(buildClientContextPayload).mockRejectedValueOnce(
			new Error("context build failed"),
		);

		const { GET } = await import("@/app/api/ai/context/[clientId]/route");
		const request = new Request("http://localhost:3000/api/ai/context/client-1");
		const response = await GET(request as any, {
			params: Promise.resolve({ clientId: "client-1" }),
		});

		expect(response.status).toBe(500);
		const data = await response.json();
		expect(data.error).toEqual({
			code: "INTERNAL_ERROR",
			message: "Failed to build AI context payload",
		});
	});

	it("returns stable success envelope and full context for authorized agency users", async () => {
		const { GET } = await import("@/app/api/ai/context/[clientId]/route");
		const request = new Request("http://localhost:3000/api/ai/context/client-1");
		const response = await GET(request as any, {
			params: Promise.resolve({ clientId: "client-1" }),
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data).toEqual(
			expect.objectContaining({
				version: "1.0.0",
				success: true,
				error: null,
				data: expect.objectContaining({
					clientId: "client-1",
					scope: "agency-full",
					context: expect.objectContaining({
						clientId: "client-1",
						version: "1.0.0",
					}),
				}),
			}),
		);
	});
});
