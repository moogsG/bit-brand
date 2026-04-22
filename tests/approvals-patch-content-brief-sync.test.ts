import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/authorize", () => ({ can: vi.fn(), resolvePermissionRole: vi.fn() }));
vi.mock("@/lib/auth/client-access", () => ({ getClientAccessContext: vi.fn() }));

const dbState: {
	lastUpdateTable: unknown;
	updateCalls: { table: unknown; values: Record<string, unknown> }[];
} = {
	lastUpdateTable: null,
	updateCalls: [],
};

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		innerJoin: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		get: vi.fn(),
		all: vi.fn(),
		update: vi.fn((table: unknown) => {
			dbState.lastUpdateTable = table;
			return (globalThis as any).__dbMock;
		}),
		set: vi.fn((values: Record<string, unknown>) => {
			dbState.updateCalls.push({ table: dbState.lastUpdateTable, values });
			return (globalThis as any).__dbMock;
		}),
		returning: vi.fn(async () => [{ id: "approval-1", status: "APPROVED" }]),
		run: vi.fn(async () => ({ changes: 1 })),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn(async () => [{ id: "audit-1" }]),
	},
}));

describe("approvals PATCH content brief sync", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		dbState.lastUpdateTable = null;
		dbState.updateCalls = [];

		const { auth } = await import("@/lib/auth");
		const { can, resolvePermissionRole } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { db } = await import("@/lib/db");

		(globalThis as any).__dbMock = db;

		(auth as any).mockResolvedValue({
			user: { id: "user-1", role: "ADMIN", rawRole: "AGENCY_OWNER" },
		} as any);
		(can as any).mockReturnValue(true);
		(resolvePermissionRole as any).mockReturnValue("ADMIN" as any);
		(getClientAccessContext as any).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});
	});

	it("syncs CONTENT_BRIEF status to APPROVED on approve action", async () => {
		const { db } = await import("@/lib/db");
		(db.get as any)
			.mockResolvedValueOnce({
				id: "approval-1",
				policyId: "policy-1",
				resourceType: "CONTENT_BRIEF",
				resourceId: "brief-1",
				clientId: "client-1",
				requestedBy: "user-2",
				status: "PENDING",
			} as any)
			.mockResolvedValueOnce({
				id: "policy-1",
				requiredRoles: JSON.stringify(["CLIENT_ADMIN"]),
			} as any);
		(db.all as any).mockResolvedValueOnce([{ roleName: "CLIENT_ADMIN" }] as any);

		const { PATCH } = await import("@/app/api/approvals/[id]/route");
		const response = await PATCH(
			new Request("http://localhost/api/approvals/approval-1", {
				method: "PATCH",
				body: JSON.stringify({ action: "approve" }),
			}) as any,
			{ params: Promise.resolve({ id: "approval-1" }) } as any,
		);

		expect(response.status).toBe(200);
		expect(dbState.updateCalls).toHaveLength(2);
		expect(dbState.updateCalls[1].values).toEqual(
			expect.objectContaining({ status: "APPROVED", updatedBy: "user-1" }),
		);
	});

	it("syncs CONTENT_BRIEF status to AWAITING_CLIENT_INPUT on reject action", async () => {
		const { db } = await import("@/lib/db");
		(db.get as any)
			.mockResolvedValueOnce({
				id: "approval-1",
				policyId: "policy-1",
				resourceType: "CONTENT_BRIEF",
				resourceId: "brief-1",
				clientId: "client-1",
				requestedBy: "user-2",
				status: "PENDING",
			} as any)
			.mockResolvedValueOnce({
				id: "policy-1",
				requiredRoles: JSON.stringify(["CLIENT_ADMIN"]),
			} as any);
		(db.all as any).mockResolvedValueOnce([{ roleName: "CLIENT_ADMIN" }] as any);

		const { PATCH } = await import("@/app/api/approvals/[id]/route");
		const response = await PATCH(
			new Request("http://localhost/api/approvals/approval-1", {
				method: "PATCH",
				body: JSON.stringify({ action: "reject", reason: "Need edits" }),
			}) as any,
			{ params: Promise.resolve({ id: "approval-1" }) } as any,
		);

		expect(response.status).toBe(200);
		expect(dbState.updateCalls).toHaveLength(2);
		expect(dbState.updateCalls[1].values).toEqual(
			expect.objectContaining({
				status: "AWAITING_CLIENT_INPUT",
				updatedBy: "user-1",
			}),
		);
	});

	it("does not sync brief status for non-content approvals", async () => {
		const { db } = await import("@/lib/db");
		(db.get as any)
			.mockResolvedValueOnce({
				id: "approval-1",
				policyId: "policy-1",
				resourceType: "IMPLEMENTATION_PROPOSAL",
				resourceId: "proposal-1",
				clientId: "client-1",
				requestedBy: "user-2",
				status: "PENDING",
			} as any)
			.mockResolvedValueOnce({
				id: "policy-1",
				requiredRoles: JSON.stringify(["CLIENT_ADMIN"]),
			} as any);
		(db.all as any).mockResolvedValueOnce([{ roleName: "CLIENT_ADMIN" }] as any);

		const { PATCH } = await import("@/app/api/approvals/[id]/route");
		const response = await PATCH(
			new Request("http://localhost/api/approvals/approval-1", {
				method: "PATCH",
				body: JSON.stringify({ action: "approve" }),
			}) as any,
			{ params: Promise.resolve({ id: "approval-1" }) } as any,
		);

		expect(response.status).toBe(200);
		expect(dbState.updateCalls).toHaveLength(1);
	});
});
