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

const dbState: {
	backlinks: any[];
	whereHint: string;
} = {
	backlinks: [],
	whereHint: "",
};

function countToken(haystack: string, token: string) {
	return haystack.split(token).length - 1;
}

function collectPrimitiveHints(value: unknown, out: string[], seen = new WeakSet<object>()) {
	if (value == null) return;
	if (value instanceof Date) {
		out.push(value.toISOString());
		return;
	}
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		out.push(String(value));
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) collectPrimitiveHints(item, out, seen);
		return;
	}
	if (typeof value === "object") {
		if (seen.has(value as object)) return;
		seen.add(value as object);
		for (const v of Object.values(value as Record<string, unknown>)) {
			collectPrimitiveHints(v, out, seen);
		}
	}
}

vi.mock("@/lib/db", () => {
	const db: any = {
		select: vi.fn(() => db),
		from: vi.fn(() => db),
		where: vi.fn((condition: unknown) => {
			const hints: string[] = [];
			collectPrimitiveHints(condition, hints);
			dbState.whereHint = hints.join(" ");
			return db;
		}),
		orderBy: vi.fn(() => db),
		all: vi.fn(async () => {
			let rows = [...dbState.backlinks];

			if (dbState.whereHint.includes("client-1")) {
				rows = rows.filter((row) => row.clientId === "client-1");
			}

			const activeCount = countToken(dbState.whereHint, "ACTIVE");
			const lostCount = countToken(dbState.whereHint, "LOST");
			if (activeCount > lostCount) {
				rows = rows.filter((row) => row.status === "ACTIVE");
			} else if (lostCount > activeCount) {
				rows = rows.filter((row) => row.status === "LOST");
			}
			if (dbState.whereHint.includes("example.com")) {
				rows = rows.filter((row) => row.sourceDomain === "example.com");
			}
			if (dbState.whereHint.includes("2026-04-01")) {
				rows = rows.filter(
					(row) => new Date(row.lastSeenAt).getTime() >= new Date("2026-04-01T00:00:00.000Z").getTime(),
				);
			}
			if (dbState.whereHint.includes("2026-04-10")) {
				rows = rows.filter(
					(row) => new Date(row.lastSeenAt).getTime() <= new Date("2026-04-10T00:00:00.000Z").getTime(),
				);
			}

			return rows.sort((a, b) => {
				const aLastSeen = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
				const bLastSeen = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
				if (aLastSeen !== bLastSeen) return bLastSeen - aLastSeen;
				const aUpdated = new Date(a.updatedAt).getTime();
				const bUpdated = new Date(b.updatedAt).getTime();
				return bUpdated - aUpdated;
			});
		}),
	};

	return { db };
});

describe("links backlinks API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_LINKS_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");

		dbState.backlinks = [
			{
				id: "backlink-1",
				clientId: "client-1",
				sourceUrl: "https://example.com/post-a",
				sourceDomain: "example.com",
				targetUrl: "https://client.com/page-a",
				anchorText: "anchor a",
				firstSeenAt: new Date("2026-04-01T00:00:00.000Z"),
				lastSeenAt: new Date("2026-04-10T00:00:00.000Z"),
				status: "ACTIVE",
				metrics: "{}",
				createdAt: new Date("2026-04-01T00:00:00.000Z"),
				updatedAt: new Date("2026-04-11T00:00:00.000Z"),
			},
			{
				id: "backlink-2",
				clientId: "client-1",
				sourceUrl: "https://othersite.com/post-b",
				sourceDomain: "othersite.com",
				targetUrl: "https://client.com/page-b",
				anchorText: "anchor b",
				firstSeenAt: new Date("2026-03-01T00:00:00.000Z"),
				lastSeenAt: new Date("2026-03-20T00:00:00.000Z"),
				status: "LOST",
				metrics: "{}",
				createdAt: new Date("2026-03-01T00:00:00.000Z"),
				updatedAt: new Date("2026-03-21T00:00:00.000Z"),
			},
		];
		dbState.whereHint = "";

		(auth as any).mockResolvedValue({
			user: { id: "user-1", role: "ADMIN", rawRole: "ACCOUNT_MANAGER" },
		} as any);
		(can as any).mockReturnValue(true);
		(getClientAccessContext as any).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});
	});

	it.skip("returns 404 when FF_LINKS_V1 is disabled", async () => {
		process.env.FF_LINKS_V1 = "false";

		const { GET } = await import("@/app/api/links/backlinks/route");
		const request = new Request(
			"http://localhost:3000/api/links/backlinks?clientId=client-1",
		);
		const response = await GET(request as any);

		expect(response.status).toBe(404);
		const data = await response.json();
		expect(data.error.code).toBe("MODULE_DISABLED");
	});

	it("returns 401 for unauthenticated requests", async () => {
		const { auth } = await import("@/lib/auth");
		(auth as any).mockResolvedValueOnce(null as any);

		const { GET } = await import("@/app/api/links/backlinks/route");
		const request = new Request(
			"http://localhost:3000/api/links/backlinks?clientId=client-1",
		);
		const response = await GET(request as any);

		expect(response.status).toBe(401);
	});

	it("returns 403 when authorization check fails", async () => {
		const { can } = await import("@/lib/auth/authorize");
		(can as any).mockReturnValueOnce(false);

		const { GET } = await import("@/app/api/links/backlinks/route");
		const request = new Request(
			"http://localhost:3000/api/links/backlinks?clientId=client-1",
		);
		const response = await GET(request as any);

		expect(response.status).toBe(403);
	});

	it("GET succeeds with status + domain filters", async () => {
		const { GET } = await import("@/app/api/links/backlinks/route");
		const request = new Request(
			"http://localhost:3000/api/links/backlinks?clientId=client-1&status=ACTIVE&domain=example.com",
		);
		const response = await GET(request as any);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data).toHaveLength(1);
		expect(data.data[0].status).toBe("ACTIVE");
		expect(data.data[0].sourceDomain).toBe("example.com");
	});

	it("GET supports lastSeenAt date-window filters", async () => {
		const { GET } = await import("@/app/api/links/backlinks/route");
		const request = new Request(
			"http://localhost:3000/api/links/backlinks?clientId=client-1&from=2026-04-01T00:00:00.000Z&to=2026-04-10T00:00:00.000Z",
		);
		const response = await GET(request as any);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data).toHaveLength(1);
		expect(data.data[0].id).toBe("backlink-1");
	});

	it("POST returns placeholder import response for scoped links editors", async () => {
		const { POST } = await import("@/app/api/links/backlinks/route");
		const response = await POST(
			new Request("http://localhost:3000/api/links/backlinks", {
				method: "POST",
				body: JSON.stringify({
					clientId: "client-1",
					source: "manual-upload",
					notes: "Initial import placeholder",
				}),
			}) as any,
		);

		expect(response.status).toBe(202);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data).toEqual(
			expect.objectContaining({
				status: "placeholder",
				accepted: true,
				clientId: "client-1",
				source: "manual-upload",
			}),
		);
	});

	it("POST enforces links edit permissions", async () => {
		const { can } = await import("@/lib/auth/authorize");
		(can as any).mockReturnValueOnce(false);

		const { POST } = await import("@/app/api/links/backlinks/route");
		const response = await POST(
			new Request("http://localhost:3000/api/links/backlinks", {
				method: "POST",
				body: JSON.stringify({ clientId: "client-1" }),
			}) as any,
		);

		expect(response.status).toBe(403);
		const data = await response.json();
		expect(data.error.code).toBe("FORBIDDEN");
	});
});
