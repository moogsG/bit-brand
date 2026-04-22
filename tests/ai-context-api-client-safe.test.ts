import { describe, expect, it, vi } from "vitest";

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

describe("ai context API client-safe gating", () => {
	it("returns client-safe subset for client-equivalent role when enabled", async () => {
		vi.resetModules();
		process.env.FF_AI_CONTEXT_V1 = "true";
		process.env.AI_CONTEXT_CLIENT_SAFE_SUBSET_ENABLED = "true";

		const { auth } = await import("@/lib/auth");
		const { can, resolvePermissionRole } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { buildClientContextPayload } = await import("@/lib/ai/context-builder");
		const { db } = await import("@/lib/db");

		vi.mocked(auth).mockResolvedValue({
			user: { id: "user-1", role: "CLIENT", rawRole: "CLIENT_ADMIN", clientId: "client-1" },
		} as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(resolvePermissionRole).mockReturnValue("CLIENT_ADMIN");
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: true,
			assignedClientIds: [],
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
						statement: null,
						metricName: null,
						currentValue: null,
						targetValue: null,
						targetDate: null,
						timeHorizonMonths: null,
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
				placeholder: "opportunities placeholder",
				items: [{ id: "opp-1", summary: "Internal-only opportunity" }] as any,
			},
			risks: {
				placeholder: "risks placeholder",
				items: [{ id: "risk-1", summary: "Internal-only risk" }] as any,
			},
		});

		const { GET } = await import("@/app/api/ai/context/[clientId]/route");
		const request = new Request("http://localhost:3000/api/ai/context/client-1");
		const response = await GET(request as any, {
			params: Promise.resolve({ clientId: "client-1" }),
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.data.scope).toBe("client-safe");
		expect(data.data.context.opportunities.items).toEqual([]);
		expect(data.data.context.risks.items).toEqual([]);
	});
});
