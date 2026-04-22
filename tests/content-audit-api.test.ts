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

type InsertedRow = Record<string, unknown>;

const dbState: {
	lastInsertedValues: InsertedRow[] | null;
} = {
	lastInsertedValues: null,
};

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		all: vi.fn(),
		delete: vi.fn().mockReturnThis(),
		run: vi.fn(),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn((values: InsertedRow[]) => {
			dbState.lastInsertedValues = values;
			return (globalThis as any).__dbMock;
		}),
		returning: vi.fn(async () => {
			const values = dbState.lastInsertedValues ?? [];
			return values.map((row, idx) => ({
				id: `finding-${idx}`,
				createdAt: new Date("2026-04-15T00:00:00.000Z"),
				...row,
			}));
		}),
	},
}));

describe("content audit API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_CONTENT_V1 = "true";
		dbState.lastInsertedValues = null;

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { db } = await import("@/lib/db");

		(globalThis as any).__dbMock = db;

		(auth as any).mockResolvedValue({
			user: { id: "user-1", role: "ADMIN", rawRole: "ACCOUNT_MANAGER" },
		} as any);
		(can as any).mockReturnValue(true);
		(getClientAccessContext as any).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});
		(db.all as any).mockResolvedValue([
			{
				id: "asset-1",
				clientId: "client-1",
				url: "https://example.com/blog/post",
				title: "Short",
				contentType: "BLOG",
				status: "ACTIVE",
				canonicalUrl: "https://example.com/blog/post-canonical",
				publishedAt: null,
				lastCrawledAt: null,
				metadata: JSON.stringify({ lowTraffic: true, isThin: true }),
				createdAt: new Date("2026-04-01T00:00:00.000Z"),
				updatedAt: new Date("2026-04-02T00:00:00.000Z"),
			},
			{
				id: "asset-2",
				clientId: "client-1",
				url: "https://example.com/category/widgets",
				title: "Widgets",
				contentType: "CATEGORY",
				status: "ACTIVE",
				canonicalUrl: null,
				publishedAt: null,
				lastCrawledAt: new Date("2025-01-01T00:00:00.000Z"),
				metadata: "{}",
				createdAt: new Date("2026-04-01T00:00:00.000Z"),
				updatedAt: new Date("2026-04-02T00:00:00.000Z"),
			},
		]);
	});

	it.skip("returns 404 when FF_CONTENT_V1 is disabled", async () => {
		process.env.FF_CONTENT_V1 = "false";
		const { POST } = await import("@/app/api/content/audit/route");
		const request = new Request("http://localhost:3000/api/content/audit", {
			method: "POST",
			body: JSON.stringify({ clientId: "client-1" }),
		});
		const response = await POST(request as any);
		expect(response.status).toBe(404);
		const data = await response.json();
		expect(data.error.code).toBe("MODULE_DISABLED");
	});

	it.skip("returns 404 for GET when FF_CONTENT_V1 is disabled", async () => {
		process.env.FF_CONTENT_V1 = "false";
		const { GET } = await import("@/app/api/content/audit/route");
		const response = await GET({
			nextUrl: new URL("http://localhost:3000/api/content/audit?clientId=client-1"),
		} as any);
		expect(response.status).toBe(404);
		const data = await response.json();
		expect(data.error.code).toBe("MODULE_DISABLED");
	});

	it("returns 401 for unauthenticated requests", async () => {
		const { auth } = await import("@/lib/auth");
		(auth as any).mockResolvedValueOnce(null as any);
		const { POST } = await import("@/app/api/content/audit/route");
		const request = new Request("http://localhost:3000/api/content/audit", {
			method: "POST",
			body: JSON.stringify({ clientId: "client-1" }),
		});
		const response = await POST(request as any);
		expect(response.status).toBe(401);
	});

	it("returns 403 when authorization check fails", async () => {
		const { can } = await import("@/lib/auth/authorize");
		(can as any).mockReturnValueOnce(false);
		const { POST } = await import("@/app/api/content/audit/route");
		const request = new Request("http://localhost:3000/api/content/audit", {
			method: "POST",
			body: JSON.stringify({ clientId: "client-1" }),
		});
		const response = await POST(request as any);
		expect(response.status).toBe(403);
		const data = await response.json();
		expect(data.error).toEqual({ code: "FORBIDDEN", message: "Forbidden" });
	});

	it("computes and persists deterministic findings", async () => {
		const { POST } = await import("@/app/api/content/audit/route");
		const { db } = await import("@/lib/db");

		const req = () =>
			new Request("http://localhost:3000/api/content/audit", {
				method: "POST",
				body: JSON.stringify({ clientId: "client-1" }),
			});

		const first = await POST(req() as any);
		expect(first.status).toBe(201);
		const firstJson = await first.json();
		expect(firstJson.data.inserted).toBeGreaterThan(0);
		expect(db.delete).toHaveBeenCalledTimes(1);
		expect(db.insert).toHaveBeenCalledTimes(1);

		const second = await POST(req() as any);
		expect(second.status).toBe(201);
		const secondJson = await second.json();

		const normalize = (rows: any[]) =>
			rows.map((r) => ({
				assetId: r.assetId,
				recommendationType: r.recommendationType,
				severity: r.severity,
				reason: r.reason,
			}));

		expect(normalize(firstJson.data.findings)).toEqual(normalize(secondJson.data.findings));
	});

	it("returns persisted findings via GET with optional filters", async () => {
		const { db } = await import("@/lib/db");
		(db.all as any).mockResolvedValueOnce([
			{
				id: "finding-1",
				clientId: "client-1",
				assetId: "asset-1",
				recommendationType: "REFRESH",
				severity: "CRITICAL",
				reason: "Needs refresh",
				proposedChanges: "{}",
				createdBy: "user-1",
				createdAt: new Date("2026-04-15T00:00:00.000Z"),
			},
		]);

		const { GET } = await import("@/app/api/content/audit/route");
		const response = await GET({
			nextUrl: new URL(
				"http://localhost:3000/api/content/audit?clientId=client-1&recommendationType=REFRESH&severity=CRITICAL",
			),
		} as any);

		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(payload.success).toBe(true);
		expect(payload.data.count).toBe(1);
		expect(payload.data.findings[0]).toEqual(
			expect.objectContaining({
				id: "finding-1",
				recommendationType: "REFRESH",
				severity: "CRITICAL",
			}),
		);
	});
});
