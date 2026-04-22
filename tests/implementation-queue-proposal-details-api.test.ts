import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/authorize", () => ({ can: vi.fn() }));
vi.mock("@/lib/auth/client-access", () => ({
	getClientAccessContext: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		get: vi.fn(),
	},
}));
vi.mock("@/lib/implementation-agent", () => ({
	getImplementationProposalDetail: vi.fn(),
}));

describe("implementation queue proposal details API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_TECHNICAL_AGENT_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { db } = await import("@/lib/db");
		const { getImplementationProposalDetail } = await import(
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
		dbAny.get.mockResolvedValue({ id: "client-1" });

		vi.mocked(getImplementationProposalDetail).mockResolvedValue({
			id: "proposal-1",
			clientId: "client-1",
			title: "Fix schema",
			provider: "noop",
			status: "APPROVED",
			approvalStatus: "APPROVED",
			targetRef: "page-1",
			operation: "UPSERT",
			beforeSnapshot: { old: true },
			afterPreview: { old: false },
			proposedPayload: { old: false },
			executionHistory: [],
			rollbackHistory: [],
			timeline: [],
		} as any);
	});

	it("returns 401 when unauthenticated", async () => {
		const { auth } = await import("@/lib/auth");
		vi.mocked(auth).mockResolvedValueOnce(null);

		const { GET } = await import(
			"@/app/api/implementation-queue/proposals/[id]/route"
		);

		const request = {
			nextUrl: new URL(
				"http://localhost/api/implementation-queue/proposals/proposal-1?clientId=client-1",
			),
		} as any;

		const response = await GET(request, {
			params: Promise.resolve({ id: "proposal-1" }),
		});
		expect(response.status).toBe(401);
	});

	it("returns proposal details payload", async () => {
		const { getImplementationProposalDetail } = await import(
			"@/lib/implementation-agent"
		);
		const { GET } = await import(
			"@/app/api/implementation-queue/proposals/[id]/route"
		);

		const request = {
			nextUrl: new URL(
				"http://localhost/api/implementation-queue/proposals/proposal-1?clientId=client-1",
			),
		} as any;

		const response = await GET(request, {
			params: Promise.resolve({ id: "proposal-1" }),
		});

		expect(response.status).toBe(200);
		expect(vi.mocked(getImplementationProposalDetail)).toHaveBeenCalledWith({
			clientId: "client-1",
			proposalId: "proposal-1",
		});

		const json = await response.json();
		expect(json.success).toBe(true);
		expect(json.data?.proposal).toEqual(
			expect.objectContaining({
				id: "proposal-1",
				beforeSnapshot: { old: true },
				afterPreview: { old: false },
			}),
		);
	});
});
