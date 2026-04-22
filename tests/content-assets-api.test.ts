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

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		all: vi.fn(),
	},
}));

describe("content assets API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_CONTENT_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can, resolvePermissionRole } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { db } = await import("@/lib/db");

		vi.mocked(auth).mockResolvedValue({
			user: { id: "user-1", role: "ADMIN", rawRole: "ACCOUNT_MANAGER" },
		} as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(resolvePermissionRole).mockReturnValue("ACCOUNT_MANAGER" as any);
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});
		vi.mocked(db.all).mockResolvedValue([
			{
				id: "asset-1",
				clientId: "client-1",
				url: "https://example.com/post",
				title: "Post",
				contentType: "BLOG",
				status: "ACTIVE",
				canonicalUrl: "https://example.com/post",
				publishedAt: null,
				lastCrawledAt: null,
				metadata: JSON.stringify({ internal: true, note: "secret" }),
				createdAt: new Date("2026-04-01T00:00:00.000Z"),
				updatedAt: new Date("2026-04-02T00:00:00.000Z"),
			},
		]);
	});

	it.skip("returns 404 when FF_CONTENT_V1 is disabled", async () => {
		process.env.FF_CONTENT_V1 = "false";
		const { GET } = await import("@/app/api/content/assets/route");
		const request = new Request("http://localhost:3000/api/content/assets?clientId=client-1");
		const response = await GET(request as any);
		expect(response.status).toBe(404);
		const data = await response.json();
		expect(data.error.code).toBe("MODULE_DISABLED");
	});

	it("returns 401 for unauthenticated requests", async () => {
		const { auth } = await import("@/lib/auth");
		vi.mocked(auth).mockResolvedValueOnce(null as any);
		const { GET } = await import("@/app/api/content/assets/route");
		const request = new Request("http://localhost:3000/api/content/assets?clientId=client-1");
		const response = await GET(request as any);
		expect(response.status).toBe(401);
	});

	it("returns 403 when authorization check fails", async () => {
		const { can } = await import("@/lib/auth/authorize");
		vi.mocked(can).mockReturnValueOnce(false);
		const { GET } = await import("@/app/api/content/assets/route");
		const request = new Request("http://localhost:3000/api/content/assets?clientId=client-1");
		const response = await GET(request as any);
		expect(response.status).toBe(403);
		const data = await response.json();
		expect(data.error).toEqual({ code: "FORBIDDEN", message: "Forbidden" });
	});

	it("returns rows for agency roles", async () => {
		const { GET } = await import("@/app/api/content/assets/route");
		const request = new Request("http://localhost:3000/api/content/assets?clientId=client-1");
		const response = await GET(request as any);
		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data[0]).toHaveProperty("metadata");
	});

	it("omits metadata for client-equivalent roles", async () => {
		const { resolvePermissionRole } = await import("@/lib/auth/authorize");
		vi.mocked(resolvePermissionRole).mockReturnValueOnce("CLIENT_ADMIN" as any);

		const { GET } = await import("@/app/api/content/assets/route");
		const request = new Request("http://localhost:3000/api/content/assets?clientId=client-1");
		const response = await GET(request as any);
		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.data[0]).not.toHaveProperty("metadata");
	});
});
