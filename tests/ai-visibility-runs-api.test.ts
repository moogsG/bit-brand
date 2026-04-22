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

vi.mock("@/lib/ai/visibility-runner", async () => {
	const actual = await vi.importActual<any>("@/lib/ai/visibility-runner");
	return {
		...actual,
		executeAiVisibilityRun: vi.fn(),
		getAiVisibilityRunSummary: vi.fn(),
	};
});

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		all: vi.fn(),
		get: vi.fn(),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
		returning: vi.fn(),
		update: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
		run: vi.fn(),
	},
}));

describe("ai visibility runs API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_AI_VISIBILITY_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { db } = await import("@/lib/db");
		const dbAny = db as any;

		vi.mocked(auth).mockResolvedValue({
			user: { id: "user-1", role: "ADMIN", rawRole: "AGENCY_OWNER" },
		} as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});

		dbAny.all.mockReset();
		dbAny.get.mockReset();
		dbAny.returning.mockReset();
	});

	it.skip("returns 404 when FF_AI_VISIBILITY_V1 is disabled", async () => {
		process.env.FF_AI_VISIBILITY_V1 = "false";
		const { POST } = await import("@/app/api/ai/visibility/runs/route");
		const req = new Request("http://localhost/api/ai/visibility/runs", {
			method: "POST",
			body: JSON.stringify({ clientId: "client-1", promptSetId: "set-1" }),
		});
		const res = await POST(req as any);
		expect(res.status).toBe(404);
		const json = await res.json();
		expect(json.error.code).toBe("MODULE_DISABLED");
	});

	it("creates a run", async () => {
		const { db } = await import("@/lib/db");
		const dbAny = db as any;
		dbAny.returning.mockResolvedValueOnce([
			{
				id: "run-1",
				clientId: "client-1",
				promptSetId: "set-1",
				engines: JSON.stringify(["CHATGPT"]),
				status: "PENDING",
				triggeredBy: "user-1",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		]);

		const { POST } = await import("@/app/api/ai/visibility/runs/route");
		const req = new Request("http://localhost/api/ai/visibility/runs", {
			method: "POST",
			body: JSON.stringify({ clientId: "client-1", promptSetId: "set-1" }),
		});

		const res = await POST(req as any);
		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data.id).toBe("run-1");
	});

	it("executes a run via execute endpoint", async () => {
		const { db } = await import("@/lib/db");
		const dbAny = db as any;
		dbAny.get.mockResolvedValueOnce({ id: "run-1", clientId: "client-1" });

		const { executeAiVisibilityRun } = await import("@/lib/ai/visibility-runner");
		vi.mocked(executeAiVisibilityRun as any).mockResolvedValueOnce({
			status: "SUCCESS",
			insertedResults: 3,
		});

		const { POST } = await import(
			"@/app/api/ai/visibility/runs/[runId]/execute/route"
		);
		const req = new Request(
			"http://localhost/api/ai/visibility/runs/run-1/execute",
			{ method: "POST" },
		);

		const res = await POST(req as any, {
			params: Promise.resolve({ runId: "run-1" }),
		});
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data.status).toBe("SUCCESS");
	});

	it("loads run details and summary", async () => {
		const { db } = await import("@/lib/db");
		const dbAny = db as any;
		dbAny.get.mockResolvedValueOnce({
			id: "run-1",
			clientId: "client-1",
			promptSetId: "set-1",
			engines: "[]",
			status: "PENDING",
			triggeredBy: "user-1",
		});
		dbAny.all.mockResolvedValueOnce([{ id: "res-1", runId: "run-1" }]);

		const { getAiVisibilityRunSummary } = await import("@/lib/ai/visibility-runner");
		vi.mocked(getAiVisibilityRunSummary as any).mockResolvedValueOnce({
			runId: "run-1",
			totalResults: 1,
			visibleResults: 0,
			byEngine: {},
		});

		const { GET } = await import("@/app/api/ai/visibility/runs/[runId]/route");
		const req = new Request("http://localhost/api/ai/visibility/runs/run-1");
		const res = await GET(req as any, { params: Promise.resolve({ runId: "run-1" }) });
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data.summary.totalResults).toBe(1);
	});
});
