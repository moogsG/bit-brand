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
		update: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
	},
}));
vi.mock("@/lib/implementation-agent", () => {
	class MockImplementationAgentError extends Error {
		constructor(
			public readonly code:
				| "NOT_FOUND"
				| "APPROVAL_REQUIRED"
				| "ALREADY_EXECUTED"
				| "INVALID_STATE"
				| "VALIDATION_ERROR",
			message: string,
		) {
			super(message);
			this.name = "ImplementationAgentError";
		}
	}

	return {
		executeImplementationProposal: vi.fn(),
		ImplementationAgentError: MockImplementationAgentError,
	};
});

describe("implementation queue execute API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_TECHNICAL_AGENT_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { db } = await import("@/lib/db");

		vi.mocked(auth).mockResolvedValue({
			user: { id: "user-1", role: "ADMIN", rawRole: "AGENCY_OWNER" },
		} as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});

		const dbAny = db as any;
		dbAny.get.mockResolvedValue({
			id: "proposal-1",
			clientId: "client-1",
			provider: "noop",
		});
	});

	it("returns 409 APPROVAL_REQUIRED when proposal is not approved", async () => {
		const { executeImplementationProposal, ImplementationAgentError } = await import(
			"@/lib/implementation-agent"
		);
		vi.mocked(executeImplementationProposal).mockRejectedValueOnce(
			new (ImplementationAgentError as any)(
				"APPROVAL_REQUIRED",
				"Proposal approval is required before execution",
			),
		);

		const { POST } = await import(
			"@/app/api/implementation-queue/proposals/[id]/execute/route"
		);
		const request = new Request(
			"http://localhost/api/implementation-queue/proposals/proposal-1/execute",
			{ method: "POST" },
		);

		const response = await POST(request as any, {
			params: Promise.resolve({ id: "proposal-1" }),
		});

		expect(response.status).toBe(409);
		expect(vi.mocked(executeImplementationProposal)).toHaveBeenCalledWith({
			proposalId: "proposal-1",
			startedBy: "user-1",
			dryRun: undefined,
		});

		const json = await response.json();
		expect(json.error).toEqual({
			code: "APPROVAL_REQUIRED",
			message: "Proposal approval is required before execution",
		});
	});

	it("returns 409 CONFLICT for already-executed proposal when rerun is not requested", async () => {
		const { executeImplementationProposal, ImplementationAgentError } = await import(
			"@/lib/implementation-agent"
		);
		vi.mocked(executeImplementationProposal).mockRejectedValueOnce(
			new (ImplementationAgentError as any)(
				"ALREADY_EXECUTED",
				"Proposal was already executed. Re-run requires explicit rerun=true intent.",
			),
		);

		const { POST } = await import(
			"@/app/api/implementation-queue/proposals/[id]/execute/route"
		);
		const request = new Request(
			"http://localhost/api/implementation-queue/proposals/proposal-1/execute",
			{ method: "POST" },
		);

		const response = await POST(request as any, {
			params: Promise.resolve({ id: "proposal-1" }),
		});

		expect(response.status).toBe(409);

		const json = await response.json();
		expect(json.error).toEqual({
			code: "CONFLICT",
			message:
				"Proposal was already executed. Re-run requires explicit rerun=true intent.",
			details: { conflict: "ALREADY_EXECUTED" },
		});
	});

	it("allows rerun=true and passes rerun intent to execution service", async () => {
		const { executeImplementationProposal } = await import(
			"@/lib/implementation-agent"
		);
		vi.mocked(executeImplementationProposal).mockResolvedValueOnce({
			proposalId: "proposal-1",
			clientId: "client-1",
			provider: "wordpress",
			effectiveDryRun: true,
			execution: {
				id: "exec-1",
				status: "SUCCEEDED",
				error: null,
			},
		} as any);

		const { POST } = await import(
			"@/app/api/implementation-queue/proposals/[id]/execute/route"
		);
		const request = new Request(
			"http://localhost/api/implementation-queue/proposals/proposal-1/execute",
			{ method: "POST", body: JSON.stringify({ rerun: true }) },
		);

		const response = await POST(request as any, {
			params: Promise.resolve({ id: "proposal-1" }),
		});

		expect(response.status).toBe(200);
		expect(vi.mocked(executeImplementationProposal)).toHaveBeenCalledWith({
			proposalId: "proposal-1",
			startedBy: "user-1",
			rerun: true,
			dryRun: undefined,
		});

		const json = await response.json();
		expect(json.success).toBe(true);
		expect(json.error).toBeNull();
		expect(json.data.execution.id).toBe("exec-1");
	});

	it("defaults dryRun=true for wordpress provider when omitted", async () => {
		const { db } = await import("@/lib/db");
		const { executeImplementationProposal } = await import(
			"@/lib/implementation-agent"
		);

		const dbAny = db as any;
		dbAny.get.mockResolvedValueOnce({
			id: "proposal-1",
			clientId: "client-1",
			provider: "wordpress",
		});

		vi.mocked(executeImplementationProposal).mockResolvedValueOnce({
			proposalId: "proposal-1",
			clientId: "client-1",
			provider: "wordpress",
			effectiveDryRun: true,
			execution: {
				id: "exec-1",
				status: "SUCCEEDED",
				error: null,
			},
		} as any);

		const { POST } = await import(
			"@/app/api/implementation-queue/proposals/[id]/execute/route"
		);
		const request = new Request(
			"http://localhost/api/implementation-queue/proposals/proposal-1/execute",
			{ method: "POST" },
		);

		const response = await POST(request as any, {
			params: Promise.resolve({ id: "proposal-1" }),
		});

		expect(response.status).toBe(200);
		expect(vi.mocked(executeImplementationProposal)).toHaveBeenCalledWith({
			proposalId: "proposal-1",
			startedBy: "user-1",
			rerun: undefined,
			dryRun: true,
		});

		const json = await response.json();
		expect(json.data.dryRunReflection).toEqual({
			requested: null,
			effective: true,
			provider: "wordpress",
			defaulted: true,
			defaultedByWordpress: true,
		});
	});

	it("returns 400 VALIDATION_ERROR when execution service rejects unsupported provider", async () => {
		const { executeImplementationProposal, ImplementationAgentError } = await import(
			"@/lib/implementation-agent"
		);

		vi.mocked(executeImplementationProposal).mockRejectedValueOnce(
			new (ImplementationAgentError as any)(
				"VALIDATION_ERROR",
				"Unsupported implementation provider: legacy-provider",
			),
		);

		const { POST } = await import(
			"@/app/api/implementation-queue/proposals/[id]/execute/route"
		);
		const request = new Request(
			"http://localhost/api/implementation-queue/proposals/proposal-1/execute",
			{ method: "POST" },
		);

		const response = await POST(request as any, {
			params: Promise.resolve({ id: "proposal-1" }),
		});

		expect(response.status).toBe(400);
		const json = await response.json();
		expect(json.error).toEqual({
			code: "VALIDATION_ERROR",
			message: "Unsupported implementation provider: legacy-provider",
		});
	});

	it("rejects unsupported provider override values", async () => {
		const { executeImplementationProposal } = await import(
			"@/lib/implementation-agent"
		);
		const { POST } = await import(
			"@/app/api/implementation-queue/proposals/[id]/execute/route"
		);

		const request = new Request(
			"http://localhost/api/implementation-queue/proposals/proposal-1/execute",
			{
				method: "POST",
				body: JSON.stringify({ provider: "custom-provider" }),
			},
		);

		const response = await POST(request as any, {
			params: Promise.resolve({ id: "proposal-1" }),
		});

		expect(response.status).toBe(400);
		expect(vi.mocked(executeImplementationProposal)).not.toHaveBeenCalled();

		const json = await response.json();
		expect(json.error.code).toBe("VALIDATION_ERROR");
	});
});
