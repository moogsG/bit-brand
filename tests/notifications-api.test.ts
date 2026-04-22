import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/authorize", () => ({ can: vi.fn(), resolvePermissionRole: vi.fn() }));
vi.mock("@/lib/auth/client-access", () => ({ getClientAccessContext: vi.fn() }));

const dbState: {
	allResultsQueue: Array<Array<{ id: string }>>;
} = {
	allResultsQueue: [],
};

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		all: vi.fn(async () => dbState.allResultsQueue.shift() ?? []),
		update: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
		run: vi.fn(async () => ({ changes: 1 })),
	},
}));

describe("notifications API PATCH", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		dbState.allResultsQueue = [];

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");

		(auth as any).mockResolvedValue({
			user: { id: "user-1", role: "CLIENT", rawRole: "CLIENT_ADMIN" },
		} as any);
		(can as any).mockReturnValue(true);
		(getClientAccessContext as any).mockResolvedValue({
			isClientMember: true,
			assignedClientIds: ["client-1"],
		});
	});

	it("marks only scoped notification ids as read", async () => {
		dbState.allResultsQueue.push([{ id: "notif-1" }]);

		const { PATCH } = await import("@/app/api/notifications/route");
		const response = await PATCH(
			new Request("http://localhost/api/notifications", {
				method: "PATCH",
				body: JSON.stringify({
					clientId: "client-1",
					notificationIds: ["notif-1", "notif-outside-scope"],
				}),
			}) as any,
		);

		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(payload).toEqual({
			success: true,
			data: { updated: 1 },
			error: null,
		});
	});

	it("marks all unread notifications as read for current scoped user", async () => {
		dbState.allResultsQueue.push([{ id: "notif-1" }, { id: "notif-2" }]);

		const { PATCH } = await import("@/app/api/notifications/route");
		const response = await PATCH(
			new Request("http://localhost/api/notifications", {
				method: "PATCH",
				body: JSON.stringify({ clientId: "client-1", markAllUnread: true }),
			}) as any,
		);

		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(payload.data.updated).toBe(2);
	});

	it("returns 403 when client scope authorization fails", async () => {
		const { can } = await import("@/lib/auth/authorize");
		(can as any).mockReturnValueOnce(false);

		const { PATCH } = await import("@/app/api/notifications/route");
		const response = await PATCH(
			new Request("http://localhost/api/notifications", {
				method: "PATCH",
				body: JSON.stringify({ clientId: "client-1", notificationIds: ["notif-1"] }),
			}) as any,
		);

		expect(response.status).toBe(403);
	});
});
