import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
	auth: vi.fn(),
}));

vi.mock("@/lib/auth/authorize", () => ({
	can: vi.fn(),
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
		get: vi.fn(),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
		returning: vi.fn(),
		update: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
		delete: vi.fn().mockReturnThis(),
	},
}));

	describe("ai visibility prompt sets API", () => {
		beforeEach(async () => {
			vi.clearAllMocks();
			process.env.FF_AI_VISIBILITY_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { db } = await import("@/lib/db");
		const dbAny = db as any;

			vi.mocked(auth).mockReset();
			vi.mocked(can).mockReset();
			vi.mocked(getClientAccessContext).mockReset();

			vi.mocked(auth).mockResolvedValue({
				user: { id: "user-1", role: "ADMIN", rawRole: "ACCOUNT_MANAGER" },
			} as any);
			vi.mocked(can).mockReturnValue(true);
			vi.mocked(getClientAccessContext).mockResolvedValue({
				isClientMember: false,
				assignedClientIds: ["client-1"],
			});

		vi.mocked(db.get).mockReset();
		vi.mocked(db.all).mockReset();
		vi.mocked(dbAny.returning).mockReset();
	});

	it.skip("returns 404 when FF_AI_VISIBILITY_V1 is disabled", async () => {
		process.env.FF_AI_VISIBILITY_V1 = "false";

		const { GET } = await import("@/app/api/ai/visibility/prompt-sets/route");
		const request = new Request(
			"http://localhost:3000/api/ai/visibility/prompt-sets?clientId=client-1",
		);

		const response = await GET(request as any);
		expect(response.status).toBe(404);
		const data = await response.json();
		expect(data.success).toBe(false);
		expect(data.error.code).toBe("MODULE_DISABLED");
	});

	it("returns 401 when unauthenticated", async () => {
		const { auth } = await import("@/lib/auth");
		vi.mocked(auth).mockResolvedValueOnce(null as any);

		const { GET } = await import("@/app/api/ai/visibility/prompt-sets/route");
		const request = new Request(
			"http://localhost:3000/api/ai/visibility/prompt-sets?clientId=client-1",
		);

		const response = await GET(request as any);
		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data.error).toEqual({ code: "UNAUTHORIZED", message: "Unauthorized" });
	});

	it("returns 403 when RBAC denies access", async () => {
		const { can } = await import("@/lib/auth/authorize");
		vi.mocked(can).mockReturnValueOnce(false);

		const { GET } = await import("@/app/api/ai/visibility/prompt-sets/route");
		const request = new Request(
			"http://localhost:3000/api/ai/visibility/prompt-sets?clientId=client-1",
		);

		const response = await GET(request as any);
		expect(response.status).toBe(403);
		const data = await response.json();
		expect(data.error).toEqual({ code: "FORBIDDEN", message: "Forbidden" });
	});

	it("lists prompt sets for a client (active first, most recently updated)", async () => {
		const { db } = await import("@/lib/db");
		const dbAny = db as any;
		vi.mocked(db.all).mockResolvedValueOnce([
			{
				id: "set-2",
				clientId: "client-1",
				name: "Inactive",
				isActive: false,
				metadata: "{}",
				createdBy: "user-1",
				updatedBy: "user-1",
				createdAt: new Date("2026-04-13T00:00:00.000Z"),
				updatedAt: new Date("2026-04-14T00:00:00.000Z"),
			},
			{
				id: "set-1",
				clientId: "client-1",
				name: "Active",
				isActive: true,
				metadata: "{}",
				createdBy: "user-1",
				updatedBy: "user-1",
				createdAt: new Date("2026-04-12T00:00:00.000Z"),
				updatedAt: new Date("2026-04-13T00:00:00.000Z"),
			},
			{
				id: "set-3",
				clientId: "client-1",
				name: "Active newer",
				isActive: true,
				metadata: "{}",
				createdBy: "user-1",
				updatedBy: "user-1",
				createdAt: new Date("2026-04-12T00:00:00.000Z"),
				updatedAt: new Date("2026-04-14T01:00:00.000Z"),
			},
		] as any);

		const { GET } = await import("@/app/api/ai/visibility/prompt-sets/route");
		const request = new Request(
			"http://localhost:3000/api/ai/visibility/prompt-sets?clientId=client-1",
		);

		const response = await GET(request as any);
		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.success).toBe(true);
		expect(json.data.map((row: any) => row.id)).toEqual(["set-3", "set-1", "set-2"]);
	});

	it("lists prompts in a set and returns 404 when prompt set does not exist", async () => {
		const { db } = await import("@/lib/db");
		const dbAny = db as any;
		vi.mocked(db.get).mockResolvedValueOnce(null as any);

		const { GET } = await import(
			"@/app/api/ai/visibility/prompt-sets/[promptSetId]/prompts/route"
		);
		const request = new Request(
			"http://localhost:3000/api/ai/visibility/prompt-sets/set-1/prompts",
		);

		const response = await GET(request as any, {
			params: Promise.resolve({ promptSetId: "set-1" }),
		});
		expect(response.status).toBe(404);
		const data = await response.json();
		expect(data.error.code).toBe("NOT_FOUND");
	});

	it("creates a prompt in a set", async () => {
		const { db } = await import("@/lib/db");
		const dbAny = db as any;
		vi.mocked(db.get).mockResolvedValueOnce({ id: "set-1", clientId: "client-1" } as any);
		vi.mocked(db.all)
			.mockResolvedValueOnce([] as any) // existing orders
			.mockResolvedValueOnce([
				{ id: "prompt-1", order: 0, createdAt: new Date("2026-04-14T00:00:00.000Z") },
			] as any); // normalize
		vi.mocked(dbAny.returning).mockResolvedValueOnce([
			{
				id: "prompt-1",
				promptSetId: "set-1",
				text: "Find our brand in ChatGPT",
				order: 0,
				isActive: true,
				metadata: "{}",
				createdBy: "user-1",
				updatedBy: "user-1",
				createdAt: new Date("2026-04-14T00:00:00.000Z"),
				updatedAt: new Date("2026-04-14T00:00:00.000Z"),
			},
		] as any);

		const { POST } = await import(
			"@/app/api/ai/visibility/prompt-sets/[promptSetId]/prompts/route"
		);
		const request = new Request(
			"http://localhost:3000/api/ai/visibility/prompt-sets/set-1/prompts",
			{
				method: "POST",
				body: JSON.stringify({ text: "Find our brand in ChatGPT" }),
			},
		);

		const response = await POST(request as any, {
			params: Promise.resolve({ promptSetId: "set-1" }),
		});
		expect(response.status).toBe(201);
		const json = await response.json();
		expect(json.success).toBe(true);
		expect(json.data.id).toBe("prompt-1");
	});
});
