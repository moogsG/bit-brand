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
		get: vi.fn(),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
		returning: vi.fn(),
		update: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
	},
}));

describe("tasks API linked resource label", () => {
	beforeEach(async () => {
		vi.clearAllMocks();

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");

		vi.mocked(auth).mockResolvedValue({
			user: { id: "user-1", role: "ADMIN", rawRole: "AGENCY_OWNER" },
		} as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});
	});

	it("accepts linkedResourceLabel on create", async () => {
		const { db } = await import("@/lib/db");
		const dbAny = db as any;

		dbAny.returning.mockResolvedValueOnce([
			{
				id: "task-1",
				clientId: "client-1",
				title: "Follow up",
				linkedResourceType: "REPORT",
				linkedResourceId: "report-1",
				linkedResourceLabel: "April Performance Report",
			},
		]);

		const { POST } = await import("@/app/api/tasks/route");
		const res = await POST(
			new Request("http://localhost/api/tasks", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					clientId: "client-1",
					title: "Follow up",
					linkedResourceType: "REPORT",
					linkedResourceId: "report-1",
					linkedResourceLabel: "April Performance Report",
				}),
			}),
		);

		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.linkedResourceLabel).toBe("April Performance Report");
		expect(dbAny.values).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				linkedResourceLabel: "April Performance Report",
			}),
		);
	});

	it("updates linkedResourceLabel on patch", async () => {
		const { db } = await import("@/lib/db");
		const dbAny = db as any;

		dbAny.get.mockResolvedValueOnce({
			id: "task-1",
			clientId: "client-1",
			status: "TODO",
			completedAt: null,
		});
		dbAny.returning.mockResolvedValueOnce([
			{
				id: "task-1",
				linkedResourceLabel: "Q2 Strategy Draft",
			},
		]);

		const { PATCH } = await import("@/app/api/tasks/[id]/route");
		const res = await PATCH(
			new Request("http://localhost/api/tasks/task-1", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					linkedResourceLabel: "Q2 Strategy Draft",
				}),
			}),
			{ params: Promise.resolve({ id: "task-1" }) },
		);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.linkedResourceLabel).toBe("Q2 Strategy Draft");
		expect(dbAny.set).toHaveBeenCalledWith(
			expect.objectContaining({
				linkedResourceLabel: "Q2 Strategy Draft",
			}),
		);
	});
});
