import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/authorize", () => ({ can: vi.fn() }));
vi.mock("@/lib/auth/client-access", () => ({ getClientAccessContext: vi.fn() }));
vi.mock("@/lib/approvals", () => ({ createApprovalRequest: vi.fn() }));
vi.mock("@/lib/links/approval-policy", () => ({
	ensureLinkOutreachSendApprovalPolicy: vi.fn(),
	LINK_OUTREACH_RESOURCE_TYPE: "LINK_OUTREACH_DRAFT",
	LINK_OUTREACH_SEND_APPROVAL_POLICY_NAME: "link_outreach_send",
}));

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		get: vi.fn(),
		update: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
		returning: vi.fn(),
	},
}));

describe("links outreach approval-gated send APIs", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_LINKS_V1 = "true";

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

	it("blocks send when draft has no approval", async () => {
		const { db } = await import("@/lib/db");
		(db as any).get.mockResolvedValueOnce({
			id: "draft-1",
			clientId: "client-1",
			status: "DRAFT",
			approvalId: null,
		});

		const { POST } = await import("@/app/api/links/outreach/[id]/send/route");
		const response = await POST({} as any, {
			params: Promise.resolve({ id: "draft-1" }),
		});

		expect(response.status).toBe(409);
		const json = await response.json();
		expect(json.error.code).toBe("APPROVAL_REQUIRED");
	});

	it("blocks send when approval is not approved", async () => {
		const { db } = await import("@/lib/db");
		(db as any).get
			.mockResolvedValueOnce({
				id: "draft-1",
				clientId: "client-1",
				status: "PENDING_APPROVAL",
				approvalId: "approval-1",
			})
			.mockResolvedValueOnce({
				id: "approval-1",
				status: "PENDING",
				approvedAt: null,
			});

		const { POST } = await import("@/app/api/links/outreach/[id]/send/route");
		const response = await POST({} as any, {
			params: Promise.resolve({ id: "draft-1" }),
		});

		expect(response.status).toBe(409);
		const json = await response.json();
		expect(json.error.code).toBe("APPROVAL_REQUIRED");
	});

	it("sends draft when approval is approved", async () => {
		const { db } = await import("@/lib/db");
		(db as any).get
			.mockResolvedValueOnce({
				id: "draft-1",
				clientId: "client-1",
				status: "PENDING_APPROVAL",
				approvalId: "approval-1",
			})
			.mockResolvedValueOnce({
				id: "approval-1",
				status: "APPROVED",
				approvedAt: new Date("2026-04-21T00:00:00.000Z"),
			});
		(db as any).returning.mockResolvedValueOnce([
			{ id: "draft-1", status: "SENT", sentBy: "user-1" },
		]);

		const { POST } = await import("@/app/api/links/outreach/[id]/send/route");
		const response = await POST({} as any, {
			params: Promise.resolve({ id: "draft-1" }),
		});

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.success).toBe(true);
		expect(json.data.sent).toBe(true);
	});

	it("request-approval creates approval and updates draft status", async () => {
		const { db } = await import("@/lib/db");
		const { createApprovalRequest } = await import("@/lib/approvals");

		(db as any).get
			.mockResolvedValueOnce({
				id: "draft-1",
				clientId: "client-1",
				status: "DRAFT",
				approvalId: null,
				prospectId: "prospect-1",
				subject: "Hello",
			})
			.mockResolvedValueOnce({ domain: "example.com" });
		vi.mocked(createApprovalRequest).mockResolvedValueOnce("approval-1");
		(db as any).returning.mockResolvedValueOnce([
			{ id: "draft-1", status: "PENDING_APPROVAL", approvalId: "approval-1" },
		]);

		const { POST } = await import(
			"@/app/api/links/outreach/[id]/request-approval/route"
		);
		const response = await POST({} as any, {
			params: Promise.resolve({ id: "draft-1" }),
		});

		expect(response.status).toBe(200);
		expect(vi.mocked(createApprovalRequest)).toHaveBeenCalledTimes(1);
		const json = await response.json();
		expect(json.data.approvalId).toBe("approval-1");
	});
});
