import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/authorize", () => ({ can: vi.fn(), resolvePermissionRole: vi.fn() }));
vi.mock("@/lib/auth/client-access", () => ({
	getAssignedClientIdsForUser: vi.fn(),
	getClientAccessContext: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		all: vi.fn(),
		get: vi.fn(),
	},
}));

describe("approvals API context labels", () => {
	beforeEach(async () => {
		vi.clearAllMocks();

		const { auth } = await import("@/lib/auth");
		const { can, resolvePermissionRole } = await import("@/lib/auth/authorize");
		const { getClientAccessContext, getAssignedClientIdsForUser } = await import(
			"@/lib/auth/client-access"
		);

		vi.mocked(auth).mockResolvedValue({
			user: { id: "user-1", role: "ADMIN", rawRole: "AGENCY_OWNER" },
		} as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(resolvePermissionRole).mockReturnValue("ADMIN" as any);
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});
		vi.mocked(getAssignedClientIdsForUser).mockResolvedValue(["client-1"]);
	});

	it("enriches GET /api/approvals rows with implementation proposal resource/context labels", async () => {
		const { db } = await import("@/lib/db");
		const dbAny = db as any;
		dbAny.all.mockResolvedValueOnce([
			{
				id: "approval-1",
				resourceType: "IMPLEMENTATION_PROPOSAL",
				resourceId: "proposal-1",
				clientId: "client-1",
				status: "PENDING",
				metadata: JSON.stringify({
					proposalTitle: "Fix broken internal links",
					targetRef: "https://example.com/blog/post",
				}),
			},
		]);

		const { GET } = await import("@/app/api/approvals/route");
		const response = await GET(
			new Request("http://localhost/api/approvals?clientId=client-1"),
		);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json[0]).toEqual(
			expect.objectContaining({
				resourceLabel: "Implementation Proposal",
				contextTitle: "Fix broken internal links",
				contextSubtitle: "Target: https://example.com/blog/post",
			}),
		);
	});

	it("enriches GET /api/approvals/[id] with batch proposal context title", async () => {
		const { db } = await import("@/lib/db");
		const dbAny = db as any;
		dbAny.get.mockResolvedValueOnce({
			id: "approval-2",
			resourceType: "IMPLEMENTATION_PROPOSAL",
			resourceId: "proposal-1",
			clientId: "client-1",
			status: "PENDING",
			metadata: JSON.stringify({
				proposalCount: 3,
				targetRef: "https://example.com/pricing",
			}),
		});

		const { GET } = await import("@/app/api/approvals/[id]/route");
		const response = await GET(new Request("http://localhost/api/approvals/approval-2"), {
			params: Promise.resolve({ id: "approval-2" }),
		} as any);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json).toEqual(
			expect.objectContaining({
				resourceLabel: "Implementation Proposal",
				contextTitle: "3 implementation proposals",
				contextSubtitle: "Target: https://example.com/pricing",
			}),
		);
	});
});
