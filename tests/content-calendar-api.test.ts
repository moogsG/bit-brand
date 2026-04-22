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
	items: any[];
	pendingInsert: Record<string, unknown> | null;
} = {
	items: [],
	pendingInsert: null,
};

vi.mock("@/lib/db", () => {
	const db: any = {
		select: vi.fn(() => db),
		from: vi.fn(() => db),
		where: vi.fn(() => db),
		orderBy: vi.fn(() => db),
		all: vi.fn(async () => dbState.items),
		insert: vi.fn(() => db),
		values: vi.fn((values: Record<string, unknown>) => {
			dbState.pendingInsert = values;
			return db;
		}),
		returning: vi.fn(async () => {
			if (!dbState.pendingInsert) return [];
			const created = {
				id: `calendar-${dbState.items.length + 1}`,
				...dbState.pendingInsert,
				createdAt: new Date("2026-04-16T00:00:00.000Z"),
				updatedAt: new Date("2026-04-16T00:00:00.000Z"),
			};
			dbState.items = [created, ...dbState.items];
			dbState.pendingInsert = null;
			return [created];
		}),
	};

	return { db };
});

describe("content calendar API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_CONTENT_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");

		dbState.items = [
			{
				id: "calendar-1",
				clientId: "client-1",
				briefId: "brief-1",
				title: "April landing page refresh",
				ownerUserId: "user-2",
				dueDate: "2026-04-20",
				publishDate: "2026-04-25",
				workflowStatus: "SCHEDULED",
				createdAt: new Date("2026-04-10T00:00:00.000Z"),
				updatedAt: new Date("2026-04-12T00:00:00.000Z"),
			},
		];
		dbState.pendingInsert = null;

		vi.mocked(auth).mockResolvedValue({
			user: { id: "user-1", role: "ADMIN", rawRole: "ACCOUNT_MANAGER" },
		} as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});
	});

	it.skip("returns 404 when FF_CONTENT_V1 is disabled", async () => {
		process.env.FF_CONTENT_V1 = "false";
		const { GET } = await import("@/app/api/content/calendar/route");
		const request = new Request(
			"http://localhost:3000/api/content/calendar?clientId=client-1",
		);
		const response = await GET(request as any);

		expect(response.status).toBe(404);
		const data = await response.json();
		expect(data.error.code).toBe("MODULE_DISABLED");
	});

	it("returns 401 for unauthenticated requests", async () => {
		const { auth } = await import("@/lib/auth");
		vi.mocked(auth).mockResolvedValueOnce(null as any);

		const { GET } = await import("@/app/api/content/calendar/route");
		const request = new Request(
			"http://localhost:3000/api/content/calendar?clientId=client-1",
		);
		const response = await GET(request as any);

		expect(response.status).toBe(401);
	});

	it("returns 403 when authorization check fails", async () => {
		const { can } = await import("@/lib/auth/authorize");
		vi.mocked(can).mockReturnValueOnce(false);

		const { GET } = await import("@/app/api/content/calendar/route");
		const request = new Request(
			"http://localhost:3000/api/content/calendar?clientId=client-1",
		);
		const response = await GET(request as any);

		expect(response.status).toBe(403);
		const data = await response.json();
		expect(data.error).toEqual({ code: "FORBIDDEN", message: "Forbidden" });
	});

	it("GET succeeds with status + date window filters", async () => {
		const { GET } = await import("@/app/api/content/calendar/route");
		const request = new Request(
			"http://localhost:3000/api/content/calendar?clientId=client-1&status=SCHEDULED&from=2026-04-01&to=2026-04-30",
		);
		const response = await GET(request as any);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data).toHaveLength(1);
		expect(data.data[0].workflowStatus).toBe("SCHEDULED");
	});

	it("POST creates a content calendar item", async () => {
		const { POST } = await import("@/app/api/content/calendar/route");
		const response = await POST(
			new Request("http://localhost:3000/api/content/calendar", {
				method: "POST",
				body: JSON.stringify({
					clientId: "client-1",
					briefId: "brief-1",
					title: "Publish May comparison guide",
					ownerUserId: "user-2",
					dueDate: "2026-05-10",
					publishDate: "2026-05-15",
					workflowStatus: "IN_PROGRESS",
				}),
			}) as any,
		);

		expect(response.status).toBe(201);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data.title).toBe("Publish May comparison guide");
		expect(data.data.workflowStatus).toBe("IN_PROGRESS");
	});
});
