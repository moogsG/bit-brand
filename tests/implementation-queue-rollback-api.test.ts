import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/authorize", () => ({ can: vi.fn() }));
vi.mock("@/lib/auth/client-access", () => ({ getClientAccessContext: vi.fn() }));
vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		get: vi.fn(),
	},
}));
vi.mock("@/lib/implementation-agent", () => {
	class MockImplementationAgentError extends Error {
		constructor(
			public readonly code:
				| "NOT_FOUND"
				| "APPROVAL_REQUIRED"
				| "INVALID_STATE"
				| "VALIDATION_ERROR",
			message: string,
		) {
			super(message);
			this.name = "ImplementationAgentError";
		}
	}

	return {
		rollbackImplementationExecution: vi.fn(),
		ImplementationAgentError: MockImplementationAgentError,
	};
});

describe("implementation queue rollback API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_TECHNICAL_AGENT_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { db } = await import("@/lib/db");
		const { rollbackImplementationExecution } = await import(
			"@/lib/implementation-agent"
		);

		vi.mocked(auth).mockResolvedValue({
			user: { id: "user-1", role: "ADMIN", rawRole: "AGENCY_OWNER" },
		} as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});

		const dbAny = db as any;
		dbAny.get.mockResolvedValue({ id: "exec-1", clientId: "client-1" });

		vi.mocked(rollbackImplementationExecution).mockResolvedValue({
			rollback: {
				id: "rb-1",
				status: "SUCCEEDED",
				error: null,
			},
		} as any);
	});

	it("returns 403 when user cannot rollback execution for client", async () => {
		const { can } = await import("@/lib/auth/authorize");
		vi.mocked(can).mockReturnValueOnce(false);

		const { POST } = await import(
			"@/app/api/implementation-queue/executions/[executionId]/rollback/route"
		);
		const request = new Request(
			"http://localhost/api/implementation-queue/executions/exec-1/rollback",
			{ method: "POST", body: JSON.stringify({ reason: "not needed" }) },
		);

		const response = await POST(request as any, {
			params: Promise.resolve({ executionId: "exec-1" }),
		});
		expect(response.status).toBe(403);
		const json = await response.json();
		expect(json.error).toEqual({ code: "FORBIDDEN", message: "Forbidden" });
	});

	it("returns 200 for successful rollback", async () => {
		const { rollbackImplementationExecution } = await import(
			"@/lib/implementation-agent"
		);
		const { POST } = await import(
			"@/app/api/implementation-queue/executions/[executionId]/rollback/route"
		);

		const request = new Request(
			"http://localhost/api/implementation-queue/executions/exec-1/rollback",
			{ method: "POST", body: JSON.stringify({ reason: "safe revert" }) },
		);

		const response = await POST(request as any, {
			params: Promise.resolve({ executionId: "exec-1" }),
		});

		expect(response.status).toBe(200);
		expect(vi.mocked(rollbackImplementationExecution)).toHaveBeenCalledWith({
			executionId: "exec-1",
			requestedBy: "user-1",
			reason: "safe revert",
		});

		const json = await response.json();
		expect(json).toEqual(
			expect.objectContaining({
				version: "1.0.0",
				success: true,
				error: null,
				data: expect.objectContaining({
					rollback: expect.objectContaining({ id: "rb-1", status: "SUCCEEDED" }),
				}),
			}),
		);
	});
});
