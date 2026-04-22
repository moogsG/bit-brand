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
	requestImplementationProposalApprovals: vi.fn(),
}));

describe("implementation queue request-approval API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_TECHNICAL_AGENT_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { db } = await import("@/lib/db");
		const { requestImplementationProposalApprovals } = await import(
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
		dbAny.all.mockResolvedValue([{ id: "proposal-1" }]);

		vi.mocked(requestImplementationProposalApprovals).mockResolvedValue({
			sharedApprovalId: "approval-1",
			requestedCount: 1,
			skippedCount: 0,
			results: [
				{ proposalId: "proposal-1", status: "REQUESTED", approvalId: "approval-1" },
			],
		} as any);
	});

	it("returns 400 for invalid payload when proposal ids are missing", async () => {
		const { POST } = await import(
			"@/app/api/implementation-queue/proposals/request-approval/route"
		);

		const request = new Request(
			"http://localhost/api/implementation-queue/proposals/request-approval",
			{
				method: "POST",
				body: JSON.stringify({ clientId: "client-1" }),
			},
		);

		const response = await POST(request as any);
		expect(response.status).toBe(400);
		const json = await response.json();
		expect(json.error.code).toBe("VALIDATION_ERROR");
	});

	it("returns success and scopes proposal ids before requesting approvals", async () => {
		const { db } = await import("@/lib/db");
		const { requestImplementationProposalApprovals } = await import(
			"@/lib/implementation-agent"
		);
		const dbAny = db as any;
		dbAny.all.mockResolvedValueOnce([{ id: "proposal-1" }]);

		const { POST } = await import(
			"@/app/api/implementation-queue/proposals/request-approval/route"
		);

		const request = new Request(
			"http://localhost/api/implementation-queue/proposals/request-approval",
			{
				method: "POST",
				body: JSON.stringify({
					clientId: "client-1",
					proposalId: "proposal-1",
					proposalIds: ["proposal-1", "proposal-2"],
				}),
			},
		);

		const response = await POST(request as any);
		expect(response.status).toBe(200);
		expect(vi.mocked(requestImplementationProposalApprovals)).toHaveBeenCalledWith({
			clientId: "client-1",
			proposalIds: ["proposal-1"],
			requestedBy: "user-1",
		});

		const json = await response.json();
		expect(json).toEqual(
			expect.objectContaining({
				version: "1.0.0",
				success: true,
				error: null,
				data: {
					clientId: "client-1",
					sharedApprovalId: "approval-1",
					requestedCount: 1,
					skippedCount: 0,
					results: [
						{
							proposalId: "proposal-1",
							status: "REQUESTED",
							approvalId: "approval-1",
						},
					],
				},
			}),
		);
	});
});
