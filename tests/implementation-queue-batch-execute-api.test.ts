import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/authorize", () => ({ can: vi.fn() }));
vi.mock("@/lib/auth/client-access", () => ({ getClientAccessContext: vi.fn() }));
vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		all: vi.fn(),
	},
}));
vi.mock("@/lib/implementation-agent", () => ({
	executeImplementationProposalsBatch: vi.fn(),
}));

describe("implementation queue batch execute API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_TECHNICAL_AGENT_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { db } = await import("@/lib/db");
		const { executeImplementationProposalsBatch } = await import(
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
		dbAny.all.mockResolvedValue([
			{ id: "proposal-1" },
			{ id: "proposal-2" },
			{ id: "proposal-3" },
		]);

		vi.mocked(executeImplementationProposalsBatch).mockResolvedValue({
			summary: { total: 3, succeeded: 1, failed: 2 },
			results: [
				{
					proposalId: "proposal-1",
					status: "SUCCEEDED",
					message: "Executed successfully",
					executionId: "exec-1",
					provider: "noop",
					effectiveDryRun: false,
				},
				{
					proposalId: "proposal-2",
					status: "FAILED",
					message: "Proposal approval is required before execution",
					errorCode: "APPROVAL_REQUIRED",
					provider: "wordpress",
					effectiveDryRun: true,
				},
				{
					proposalId: "proposal-3",
					status: "FAILED",
					message: "Proposal not found for this client",
					errorCode: "NOT_FOUND",
				},
			],
		} as any);
	});

	it("returns mixed-outcome summary for batch execution", async () => {
		const { executeImplementationProposalsBatch } = await import(
			"@/lib/implementation-agent"
		);
		const { POST } = await import(
			"@/app/api/implementation-queue/proposals/execute/route"
		);

		const request = new Request(
			"http://localhost/api/implementation-queue/proposals/execute",
			{
				method: "POST",
				body: JSON.stringify({
					clientId: "client-1",
					proposalIds: ["proposal-1", "proposal-2", "proposal-3"],
				}),
			},
		);

		const response = await POST(request as any);
		expect(response.status).toBe(200);
		expect(vi.mocked(executeImplementationProposalsBatch)).toHaveBeenCalledWith({
			clientId: "client-1",
			proposalIds: ["proposal-1", "proposal-2", "proposal-3"],
			startedBy: "user-1",
			rerun: undefined,
			dryRun: undefined,
		});

		const json = await response.json();
		expect(json).toEqual(
			expect.objectContaining({
				version: "1.0.0",
				success: true,
				error: null,
				data: expect.objectContaining({
					clientId: "client-1",
					rerun: false,
					dryRunReflection: {
						requested: null,
						mixedDefaults: true,
					},
					summary: { total: 3, succeeded: 1, failed: 2 },
					results: expect.any(Array),
				}),
			}),
		);
		expect(json.data.results[1].dryRunReflection).toEqual({
			requested: null,
			effective: true,
			provider: "wordpress",
			defaulted: true,
			defaultedByWordpress: true,
		});
	});

	it("passes dryRun flag through batch execute payload", async () => {
		const { executeImplementationProposalsBatch } = await import(
			"@/lib/implementation-agent"
		);
		const { POST } = await import(
			"@/app/api/implementation-queue/proposals/execute/route"
		);

		const request = new Request(
			"http://localhost/api/implementation-queue/proposals/execute",
			{
				method: "POST",
				body: JSON.stringify({
					clientId: "client-1",
					proposalIds: ["proposal-1"],
					dryRun: true,
				}),
			},
		);

		const response = await POST(request as any);
		expect(response.status).toBe(200);
		expect(vi.mocked(executeImplementationProposalsBatch)).toHaveBeenCalledWith({
			clientId: "client-1",
			proposalIds: ["proposal-1"],
			startedBy: "user-1",
			rerun: undefined,
			dryRun: true,
		});

		const json = await response.json();
		expect(json.data.dryRun).toBe(true);
		expect(json.data.dryRunReflection).toEqual({
			requested: true,
			mixedDefaults: false,
		});
	});
});
