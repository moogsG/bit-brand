import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		all: vi.fn(),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
	},
}));

describe("POST /api/cron/tasks-alerts", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.CRON_SECRET = "cron-test-secret";

		const { db } = await import("@/lib/db");
		const dbAny = db as any;
		dbAny.all.mockReset();
		dbAny.values.mockReset();
	});

	it("returns 401 when CRON_SECRET is invalid", async () => {
		const { POST } = await import("@/app/api/cron/tasks-alerts/route");
		const req = new Request("http://localhost/api/cron/tasks-alerts", {
			method: "POST",
			headers: { authorization: "Bearer wrong" },
		});

		const res = await POST(req as any);
		expect(res.status).toBe(401);
		const json = await res.json();
		expect(json.success).toBe(false);
		expect(json.error.code).toBe("UNAUTHORIZED");
	});

	it("generates overdue and blocked alerts with dedupe summary", async () => {
		const { db } = await import("@/lib/db");
		const dbAny = db as any;

		const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

		dbAny.all
			.mockResolvedValueOnce([
				{
					id: "task-overdue",
					clientId: "client-1",
					title: "Fix title tags",
					status: "IN_PROGRESS",
					dueDate: yesterday,
					assignedTo: "user-1",
					createdBy: "user-2",
				},
				{
					id: "task-blocked",
					clientId: "client-1",
					title: "Publish strategy",
					status: "BLOCKED",
					dueDate: null,
					assignedTo: "user-1",
					createdBy: "user-2",
				},
			])
			.mockResolvedValueOnce([
				{
					recipientUserId: "user-1",
					type: "TASK_BLOCKED",
					taskId: "task-blocked",
				},
			]);

		const { POST } = await import("@/app/api/cron/tasks-alerts/route");
		const req = new Request(
			"http://localhost/api/cron/tasks-alerts?maxTasks=10&dedupeWindowHours=24",
			{
				method: "POST",
				headers: { authorization: "Bearer cron-test-secret" },
			},
		);

		const res = await POST(req as any);
		expect(res.status).toBe(200);
		const json = await res.json();

		expect(json.success).toBe(true);
		expect(json.data.counts).toMatchObject({
			scannedTasks: 2,
			overdueCandidates: 1,
			blockedCandidates: 1,
			createdAlerts: 1,
			skippedDuplicates: 1,
		});
		expect(dbAny.values).toHaveBeenCalledTimes(1);
		expect(dbAny.values).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "TASK_OVERDUE",
				taskId: "task-overdue",
				recipientUserId: "user-1",
			}),
		);
	});
});
