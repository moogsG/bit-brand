import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/authorize", () => ({ can: vi.fn() }));
vi.mock("@/lib/auth/client-access", () => ({ getClientAccessContext: vi.fn() }));

vi.mock("@/lib/db", () => ({
		db: {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			orderBy: vi.fn().mockReturnThis(),
			all: vi.fn(),
		get: vi.fn(),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
		returning: vi.fn(),
		update: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
		delete: vi.fn().mockReturnThis(),
	},
}));

describe("links prospects APIs", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_LINKS_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");

		vi.mocked(auth).mockResolvedValue({
			user: { id: "user-1", role: "ADMIN", rawRole: "ACCOUNT_MANAGER" },
		} as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});
	});

	it("GET lists prospects with scoped client access", async () => {
		const { db } = await import("@/lib/db");
		(db as any).all.mockResolvedValueOnce([
			{ id: "prospect-1", clientId: "client-1", domain: "example.com" },
		]);

		const { GET } = await import("@/app/api/links/prospects/route");
		const request = new Request(
			"http://localhost:3000/api/links/prospects?clientId=client-1",
		);
		const response = await GET(request as any);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.success).toBe(true);
		expect(json.data).toHaveLength(1);
	});

	it("POST validates payload and computes deterministic score fields", async () => {
		const { db } = await import("@/lib/db");
		(db as any).returning.mockResolvedValueOnce([
			{
				id: "prospect-1",
				clientId: "client-1",
				domain: "example.com",
				relevanceScore: 80,
				authorityScore: 60,
				trafficScore: 0,
				relationshipScore: 0,
				deterministicScore: 57,
			},
		]);

		const { POST } = await import("@/app/api/links/prospects/route");
		const request = new Request("http://localhost:3000/api/links/prospects", {
			method: "POST",
			body: JSON.stringify({
				clientId: "client-1",
				domain: "example.com",
				relevanceScore: 80,
				authorityScore: 60,
			}),
		});

		const response = await POST(request as any);
		expect(response.status).toBe(201);

		const json = await response.json();
		expect(json.success).toBe(true);
		expect(json.data.deterministicScore).toBeGreaterThan(0);
	});

	it("POST returns 400 for invalid payload", async () => {
		const { POST } = await import("@/app/api/links/prospects/route");
		const request = new Request("http://localhost:3000/api/links/prospects", {
			method: "POST",
			body: JSON.stringify({ clientId: "client-1" }),
		});

		const response = await POST(request as any);
		expect(response.status).toBe(400);
	});

	it("PATCH enforces scoped authorization", async () => {
		const { db } = await import("@/lib/db");
		const { can } = await import("@/lib/auth/authorize");

		(db as any).get.mockResolvedValueOnce({
			id: "prospect-1",
			clientId: "client-1",
			relevanceScore: 70,
			authorityScore: 70,
			trafficScore: 30,
			relationshipScore: 20,
		});
		vi.mocked(can).mockReturnValueOnce(false);

		const { PATCH } = await import("@/app/api/links/prospects/[id]/route");
		const request = new Request("http://localhost:3000/api/links/prospects/prospect-1", {
			method: "PATCH",
			body: JSON.stringify({ domain: "new-example.com" }),
		});

		const response = await PATCH(request as any, {
			params: Promise.resolve({ id: "prospect-1" }),
		});

		expect(response.status).toBe(403);
	});

	it("DELETE blocks prospects linked to outreach drafts", async () => {
		const { db } = await import("@/lib/db");

		(db as any).get
			.mockResolvedValueOnce({
				id: "prospect-1",
				clientId: "client-1",
				relevanceScore: 70,
				authorityScore: 70,
				trafficScore: 30,
				relationshipScore: 20,
			})
			.mockResolvedValueOnce({ id: "draft-1" });

		const { DELETE } = await import("@/app/api/links/prospects/[id]/route");
		const response = await DELETE({} as any, {
			params: Promise.resolve({ id: "prospect-1" }),
		});

		expect(response.status).toBe(409);
		const json = await response.json();
		expect(json.error.code).toBe("CONFLICT");
	});
});
