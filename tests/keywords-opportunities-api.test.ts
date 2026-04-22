import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
	auth: vi.fn(),
}));

vi.mock("@/lib/auth/authorize", () => ({
	can: vi.fn(),
}));

vi.mock("@/lib/auth/client-access", () => ({
	getClientAccessContext: vi.fn(),
}));

vi.mock("@/lib/keywords/opportunities", () => ({
	scoreKeywordOpportunities: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		get: vi.fn(),
		all: vi.fn(),
	},
}));

describe("keywords opportunities API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_TECHNICAL_BASELINE_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { scoreKeywordOpportunities } = await import("@/lib/keywords/opportunities");
		const { db } = await import("@/lib/db");

		vi.mocked(auth).mockResolvedValue({
			user: { id: "user-1", role: "ADMIN", rawRole: "ACCOUNT_MANAGER" },
		} as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});
		vi.mocked(db.get).mockResolvedValue({ id: "client-1" } as any);
		vi.mocked(db.all).mockResolvedValue([{ id: "kw-1", keyword: "running shoes" }] as any);
		vi.mocked(scoreKeywordOpportunities).mockReturnValue({
			opportunities: [
				{
					id: "kw-1",
					keyword: "running shoes",
					opportunityScore: 84,
					clusterKey: "runn sho",
					scoreBreakdown: {
						volume: 30,
						difficulty: 20,
						rankGap: 15,
						status: 10,
						priority: 5,
						intent: 4,
					},
					monthlyVolume: 1000,
					difficulty: 20,
					currentPosition: 15,
					targetPosition: 5,
					status: "OPPORTUNITY",
					priority: "HIGH",
					intent: "TRANSACTIONAL",
				},
			],
			clusters: [
				{
					clusterKey: "runn sho",
					label: "Runn Sho",
					size: 1,
					avgOpportunityScore: 84,
					topKeywords: ["running shoes"],
					keywordIds: ["kw-1"],
				},
			],
			meta: {
				totalKeywords: 1,
				returnedKeywords: 1,
				totalClusters: 1,
			},
		});
	});

	it("returns 401 when unauthenticated", async () => {
		const { auth } = await import("@/lib/auth");
		vi.mocked(auth).mockResolvedValueOnce(null as any);

		const { GET } = await import("@/app/api/keywords/opportunities/route");
		const request = new NextRequest(
			"http://localhost:3000/api/keywords/opportunities?clientId=client-1",
		);

		const response = await GET(request as any);
		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.error).toEqual({ code: "UNAUTHORIZED", message: "Unauthorized" });
	});

	it.skip("returns 404 when feature flag is disabled", async () => {
		process.env.FF_TECHNICAL_BASELINE_V1 = "false";

		const { GET } = await import("@/app/api/keywords/opportunities/route");
		const request = new NextRequest(
			"http://localhost:3000/api/keywords/opportunities?clientId=client-1",
		);

		const response = await GET(request as any);
		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.error.code).toBe("FEATURE_DISABLED");
	});

	it("returns 403 when authorization check fails", async () => {
		const { can } = await import("@/lib/auth/authorize");
		vi.mocked(can).mockReturnValueOnce(false);

		const { GET } = await import("@/app/api/keywords/opportunities/route");
		const request = new NextRequest(
			"http://localhost:3000/api/keywords/opportunities?clientId=client-1",
		);

		const response = await GET(request as any);
		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.error).toEqual({ code: "FORBIDDEN", message: "Forbidden" });
	});

	it("returns success envelope with expected shape", async () => {
		const { GET } = await import("@/app/api/keywords/opportunities/route");
		const request = new NextRequest(
			"http://localhost:3000/api/keywords/opportunities?clientId=client-1&limit=25",
		);

		const response = await GET(request as any);
		expect(response.status).toBe(200);
		const body = await response.json();

		expect(body).toEqual(
			expect.objectContaining({
				version: "1.0.0",
				success: true,
				error: null,
				data: expect.objectContaining({
					clientId: "client-1",
					opportunities: expect.any(Array),
					clusters: expect.any(Array),
					meta: expect.objectContaining({
						totalKeywords: expect.any(Number),
						returnedKeywords: expect.any(Number),
						totalClusters: expect.any(Number),
					}),
				}),
			}),
		);
	});
});
