import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/visibility-runner", () => ({
	executeAiVisibilityRun: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		all: vi.fn(),
		get: vi.fn(),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
		returning: vi.fn(),
	},
}));

describe("POST /api/cron/ai-visibility-runs", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.CRON_SECRET = "cron-test-secret";
		process.env.FF_AI_VISIBILITY_V1 = "true";
		process.env.FF_AI_VISIBILITY_CRON_V1 = "true";

		const { db } = await import("@/lib/db");
		const dbAny = db as any;
		dbAny.all.mockReset();
		dbAny.get.mockReset();
		dbAny.returning.mockReset();
	});

	it.skip("returns 404 when cron flag is disabled", async () => {
		process.env.FF_AI_VISIBILITY_CRON_V1 = "false";
		const { POST } = await import("@/app/api/cron/ai-visibility-runs/route");
		const req = new Request("http://localhost/api/cron/ai-visibility-runs", {
			method: "POST",
			headers: { authorization: "Bearer cron-test-secret" },
		});

		const res = await POST(req as any);
		expect(res.status).toBe(404);
		const json = await res.json();
		expect(json.error.code).toBe("MODULE_DISABLED");
	});

	it("returns 401 when CRON_SECRET is invalid", async () => {
		const { POST } = await import("@/app/api/cron/ai-visibility-runs/route");
		const req = new Request("http://localhost/api/cron/ai-visibility-runs", {
			method: "POST",
			headers: { authorization: "Bearer wrong" },
		});

		const res = await POST(req as any);
		expect(res.status).toBe(401);
	});

	it("supports dry-run and returns counts without creating runs", async () => {
		const { db } = await import("@/lib/db");
		const dbAny = db as any;
		dbAny.all
			.mockResolvedValueOnce([{ id: "client-1" }])
			.mockResolvedValueOnce([
				{ id: "set-1", clientId: "client-1", updatedBy: "user-1" },
			]);
		dbAny.get.mockResolvedValueOnce({ id: "prompt-1" });

		const { POST } = await import("@/app/api/cron/ai-visibility-runs/route");
		const req = new Request(
			"http://localhost/api/cron/ai-visibility-runs?dryRun=1&maxClients=5&maxPromptSets=5&maxRuns=5",
			{
				method: "POST",
				headers: { authorization: "Bearer cron-test-secret" },
			},
		);

		const res = await POST(req as any);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data.dryRun).toBe(true);
		expect(json.data.counts.createdRuns).toBe(1);
		expect(dbAny.insert).not.toHaveBeenCalled();
	});

	it("creates and executes runs when not dry-run", async () => {
		const { db } = await import("@/lib/db");
		const dbAny = db as any;
		dbAny.all
			.mockResolvedValueOnce([{ id: "client-1" }])
			.mockResolvedValueOnce([
				{ id: "set-1", clientId: "client-1", updatedBy: "user-1" },
			]);
		dbAny.get.mockResolvedValueOnce({ id: "prompt-1" });
		dbAny.returning.mockResolvedValueOnce([{ id: "run-1" }]);

		const { executeAiVisibilityRun } = await import("@/lib/ai/visibility-runner");
		vi.mocked(executeAiVisibilityRun).mockResolvedValueOnce({
			status: "SUCCESS",
			insertedResults: 3,
			executor: {
				requestedModes: ["placeholder"],
				effectiveModes: ["placeholder"],
				sources: ["placeholder-deterministic"],
				fallbackCount: 0,
			},
		});

		const { POST } = await import("@/app/api/cron/ai-visibility-runs/route");
		const req = new Request("http://localhost/api/cron/ai-visibility-runs", {
			method: "POST",
			headers: { authorization: "Bearer cron-test-secret" },
			body: JSON.stringify({ maxClients: 1, maxPromptSets: 1, maxRuns: 1 }),
		});

		const res = await POST(req as any);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data.counts.createdRuns).toBe(1);
		expect(json.data.counts.executedRuns).toBe(1);
		expect(json.data.counts.succeededRuns).toBe(1);
		expect(json.data.counts.failedRuns).toBe(0);
		expect(executeAiVisibilityRun).toHaveBeenCalledWith("run-1");
	});
});
