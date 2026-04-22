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

const dbState: {
	brief: any;
	versions: any[];
	pendingInsert: Record<string, unknown> | null;
} = {
	brief: null,
	versions: [],
	pendingInsert: null,
};

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		all: vi.fn(async () => dbState.versions),
		get: vi.fn(async () => dbState.brief),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn((values: Record<string, unknown>) => {
			dbState.pendingInsert = values;
			return (globalThis as any).__dbMock;
		}),
		returning: vi.fn(async () => {
			if (!dbState.pendingInsert) return [];
			const inserted = {
				id: `version-${dbState.versions.length + 1}`,
				...dbState.pendingInsert,
			};
			dbState.versions = [inserted, ...dbState.versions];
			dbState.pendingInsert = null;
			return [inserted];
		}),
	},
}));

describe("content brief versions API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_CONTENT_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can, resolvePermissionRole } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { db } = await import("@/lib/db");

		(globalThis as any).__dbMock = db;

		dbState.brief = {
			id: "brief-1",
			clientId: "client-1",
		};
		dbState.versions = [
			{
				id: "v2",
				briefId: "brief-1",
				version: 2,
				body: "Updated body",
				diffSummary: "Expanded section",
				createdBy: "user-1",
				createdAt: new Date("2026-04-15T00:00:00.000Z"),
			},
			{
				id: "v1",
				briefId: "brief-1",
				version: 1,
				body: "Initial body",
				diffSummary: null,
				createdBy: "user-1",
				createdAt: new Date("2026-04-14T00:00:00.000Z"),
			},
		];
		dbState.pendingInsert = null;

		vi.mocked(auth).mockResolvedValue({
			user: { id: "user-1", role: "ADMIN", rawRole: "ACCOUNT_MANAGER" },
		} as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(resolvePermissionRole).mockReturnValue("ACCOUNT_MANAGER" as any);
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});
	});

	it.skip("returns 404 when FF_CONTENT_V1 is disabled", async () => {
		process.env.FF_CONTENT_V1 = "false";
		const { GET } = await import(
			"@/app/api/content/briefs/[briefId]/versions/route"
		);
		const response = await GET(new Request("http://localhost:3000") as any, {
			params: Promise.resolve({ briefId: "brief-1" }),
		});

		expect(response.status).toBe(404);
		const data = await response.json();
		expect(data.error.code).toBe("MODULE_DISABLED");
	});

	it("returns 401 for unauthenticated requests", async () => {
		const { auth } = await import("@/lib/auth");
		vi.mocked(auth).mockResolvedValueOnce(null as any);

		const { GET } = await import(
			"@/app/api/content/briefs/[briefId]/versions/route"
		);
		const response = await GET(new Request("http://localhost:3000") as any, {
			params: Promise.resolve({ briefId: "brief-1" }),
		});

		expect(response.status).toBe(401);
	});

	it("returns 403 when authorization check fails", async () => {
		const { can } = await import("@/lib/auth/authorize");
		vi.mocked(can).mockReturnValueOnce(false);

		const { GET } = await import(
			"@/app/api/content/briefs/[briefId]/versions/route"
		);
		const response = await GET(new Request("http://localhost:3000") as any, {
			params: Promise.resolve({ briefId: "brief-1" }),
		});

		expect(response.status).toBe(403);
		const data = await response.json();
		expect(data.error).toEqual({ code: "FORBIDDEN", message: "Forbidden" });
	});

	it("GET returns versions ordered newest-first", async () => {
		const { GET } = await import(
			"@/app/api/content/briefs/[briefId]/versions/route"
		);
		const response = await GET(new Request("http://localhost:3000") as any, {
			params: Promise.resolve({ briefId: "brief-1" }),
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data.map((row: any) => row.version)).toEqual([2, 1]);
	});

	it("POST appends a new incremented version", async () => {
		const { POST } = await import(
			"@/app/api/content/briefs/[briefId]/versions/route"
		);
		const response = await POST(
			new Request("http://localhost:3000", {
				method: "POST",
				body: JSON.stringify({
					body: "Third revision",
					diffSummary: "Added FAQ",
				}),
			}) as any,
			{ params: Promise.resolve({ briefId: "brief-1" }) },
		);

		expect(response.status).toBe(201);
		const data = await response.json();
		expect(data.data.version).toBe(3);
		expect(dbState.versions[0].version).toBe(3);
		expect(dbState.versions).toHaveLength(3);
	});
});
