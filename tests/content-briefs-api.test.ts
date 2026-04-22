import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
	auth: vi.fn(),
}));

vi.mock("@/lib/auth/authorize", () => ({
	can: vi.fn(),
	resolvePermissionRole: vi.fn(),
}));

vi.mock("@/lib/auth/client-access", () => ({
	getClientAccessContext: vi.fn(),
}));

vi.mock("@/lib/approvals", () => ({
	createApprovalRequest: vi.fn(),
	hasPendingApproval: vi.fn(),
}));

const dbState: {
	brief: any;
} = {
	brief: null,
};

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		all: vi.fn(),
		get: vi.fn(async () => dbState.brief),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
		returning: vi.fn(async () => [dbState.brief].filter(Boolean)),
		update: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
	},
}));

describe("content briefs API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_CONTENT_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can, resolvePermissionRole } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { db } = await import("@/lib/db");

		dbState.brief = {
			id: "brief-1",
			clientId: "client-1",
			assetId: null,
			title: "Brief",
			primaryKeyword: "keyword",
			supportingKeywords: "[]",
			outline: "{}",
			status: "DRAFT",
			clientVisibleSummary: null,
			internalNotes: "internal",
			createdBy: "user-1",
			updatedBy: "user-1",
			createdAt: new Date("2026-04-15T00:00:00.000Z"),
			updatedAt: new Date("2026-04-15T00:00:00.000Z"),
		};

		vi.mocked(auth).mockResolvedValue({
			user: { id: "user-1", role: "ADMIN", rawRole: "ACCOUNT_MANAGER" },
		} as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(resolvePermissionRole).mockReturnValue("ACCOUNT_MANAGER" as any);
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});
		vi.mocked(db.all).mockResolvedValue([dbState.brief]);
	});

	it("lists briefs and omits internal notes for client-equivalent roles", async () => {
		const { resolvePermissionRole } = await import("@/lib/auth/authorize");
		vi.mocked(resolvePermissionRole).mockReturnValueOnce("CLIENT_ADMIN" as any);
		const { db } = await import("@/lib/db");
		vi.mocked(db.all).mockResolvedValueOnce([
			{
				...dbState.brief,
				id: "brief-approved",
				status: "APPROVED",
				clientVisibleSummary: "Approved summary",
			},
			{
				...dbState.brief,
				id: "brief-draft",
				status: "DRAFT",
				clientVisibleSummary: "Draft summary",
			},
		]);

		const { GET } = await import("@/app/api/content/briefs/route");
		const request = new Request("http://localhost:3000/api/content/briefs?clientId=client-1");
		const response = await GET(request as any);
		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.data).toHaveLength(1);
		expect(data.data[0]).toMatchObject({
			id: "brief-approved",
			status: "APPROVED",
			clientVisibleSummary: "Approved summary",
		});
		expect(data.data[0]).not.toHaveProperty("internalNotes");
		expect(data.data[0]).not.toHaveProperty("outline");
	});

	it("creates an approval request when transitioning to READY_FOR_APPROVAL", async () => {
		const { hasPendingApproval, createApprovalRequest } = await import("@/lib/approvals");
		vi.mocked(hasPendingApproval).mockResolvedValue(false);

		const { PATCH } = await import("@/app/api/content/briefs/[briefId]/route");
		const request = new Request("http://localhost:3000/api/content/briefs/brief-1", {
			method: "PATCH",
			body: JSON.stringify({ status: "READY_FOR_APPROVAL" }),
		});

		const response = await PATCH(request as any, { params: Promise.resolve({ briefId: "brief-1" }) });
		expect(response.status).toBe(200);
		expect(vi.mocked(createApprovalRequest)).toHaveBeenCalledWith(
			expect.objectContaining({
				policyName: "content_brief_approve",
				resourceType: "CONTENT_BRIEF",
				resourceId: "brief-1",
				clientId: "client-1",
			}),
		);
	});

	it("returns approved summary only on single brief GET for client-equivalent roles", async () => {
		const { resolvePermissionRole } = await import("@/lib/auth/authorize");
		vi.mocked(resolvePermissionRole).mockReturnValueOnce("CLIENT_ADMIN" as any);

		dbState.brief = {
			...dbState.brief,
			status: "APPROVED",
			clientVisibleSummary: "Client-safe summary",
		};

		const { GET } = await import("@/app/api/content/briefs/[briefId]/route");
		const request = new Request("http://localhost:3000/api/content/briefs/brief-1");
		const response = await GET(request as any, {
			params: Promise.resolve({ briefId: "brief-1" }),
		});

		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(payload.data).toMatchObject({
			status: "APPROVED",
			clientVisibleSummary: "Client-safe summary",
		});
		expect(payload.data).not.toHaveProperty("internalNotes");
		expect(payload.data).not.toHaveProperty("outline");
	});

	it("returns not found for non-approved single brief GET for client-equivalent roles", async () => {
		const { resolvePermissionRole } = await import("@/lib/auth/authorize");
		vi.mocked(resolvePermissionRole).mockReturnValueOnce("CLIENT_ADMIN" as any);

		dbState.brief = {
			...dbState.brief,
			status: "DRAFT",
		};

		const { GET } = await import("@/app/api/content/briefs/[briefId]/route");
		const request = new Request("http://localhost:3000/api/content/briefs/brief-1");
		const response = await GET(request as any, {
			params: Promise.resolve({ briefId: "brief-1" }),
		});

		expect(response.status).toBe(404);
	});
});
