import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/approvals", () => ({
	createApprovalRequest: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		all: vi.fn(),
		get: vi.fn(),
	},
}));

describe("implementation queue service timeline read-model", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("includes approval/execution/rollback events in timeline sorted newest-first", async () => {
		const { db } = await import("@/lib/db");
		const dbAny = db as any;

		dbAny.all
			.mockResolvedValueOnce([
				{
					id: "proposal-1",
					clientId: "client-1",
					title: "Fix links",
					description: "Fix broken internal links",
					proposalJson: JSON.stringify({
						targetRef: "https://example.com/a",
						operation: "UPDATE",
						beforeSnapshot: { status: "broken" },
						afterPreview: { status: "fixed" },
						proposedPayload: { apply: true },
					}),
					status: "EXECUTED",
					provider: "noop",
					approvalId: "approval-1",
					requestedBy: "user-1",
					createdAt: new Date("2026-01-01T00:00:00.000Z"),
					updatedAt: new Date("2026-01-01T00:00:00.000Z"),
				},
			])
			.mockResolvedValueOnce([
				{
					id: "exec-1",
					proposalId: "proposal-1",
					clientId: "client-1",
					status: "SUCCEEDED",
					error: null,
					startedAt: new Date("2026-01-03T10:00:00.000Z"),
				},
			])
			.mockResolvedValueOnce([
				{
					id: "rollback-1",
					proposalId: "proposal-1",
					clientId: "client-1",
					status: "FAILED",
					error: "Rollback validation failed",
					createdAt: new Date("2026-01-02T10:00:00.000Z"),
				},
			])
			.mockResolvedValueOnce([
				{
					id: "approval-1",
					status: "APPROVED",
					metadata: JSON.stringify({ reviewer: "owner-1" }),
					createdAt: new Date("2026-01-01T10:00:00.000Z"),
					approvedAt: new Date("2026-01-01T11:00:00.000Z"),
					rejectedAt: null,
				},
			]);

		const { listImplementationProposals } = await import(
			"@/lib/implementation-agent/service"
		);
		const results = await listImplementationProposals("client-1");

		expect(results).toHaveLength(1);
		expect(results[0].timeline).toEqual([
			expect.objectContaining({
				id: "execution-exec-1",
				type: "EXECUTION",
				status: "SUCCEEDED",
			}),
			expect.objectContaining({
				id: "rollback-rollback-1",
				type: "ROLLBACK",
				status: "FAILED",
				message: "Rollback validation failed",
			}),
			expect.objectContaining({
				id: "approval-approval-1-approved",
				type: "APPROVAL",
				status: "APPROVED",
			}),
			expect.objectContaining({
				id: "approval-approval-1-requested",
				type: "APPROVAL",
				status: "PENDING",
			}),
		]);
		expect(results[0].latestExecution?.id).toBe("exec-1");
		expect(results[0].latestRollback?.id).toBe("rollback-1");
		expect(results[0]).toEqual(
			expect.objectContaining({
				operation: "UPDATE",
				beforeSnapshot: { status: "broken" },
				afterPreview: { status: "fixed" },
				proposedPayload: { apply: true },
				approval: expect.objectContaining({
					metadata: { reviewer: "owner-1" },
				}),
			}),
		);
	});

	it("returns proposal detail with full history payload for selected proposal", async () => {
		const { db } = await import("@/lib/db");
		const dbAny = db as any;

		dbAny.get.mockResolvedValueOnce({
			id: "proposal-99",
			clientId: "client-1",
			title: "Title",
			description: "Description",
			proposalJson: JSON.stringify({
				targetRef: "https://example.com/page",
				operation: "UPSERT",
				beforeSnapshot: { headline: "old" },
				afterPreview: { headline: "new" },
				proposedPayload: { headline: "new" },
			}),
			status: "APPROVED",
			provider: "noop",
			approvalId: "approval-99",
			requestedBy: "user-1",
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-02T00:00:00.000Z"),
		});

		dbAny.all
			.mockResolvedValueOnce([
				{
					id: "exec-99",
					proposalId: "proposal-99",
					clientId: "client-1",
					status: "FAILED",
					error: "boom",
					startedAt: new Date("2026-01-02T10:00:00.000Z"),
					completedAt: new Date("2026-01-02T10:01:00.000Z"),
				},
			])
			.mockResolvedValueOnce([
				{
					id: "rollback-99",
					proposalId: "proposal-99",
					clientId: "client-1",
					status: "SUCCEEDED",
					error: null,
					createdAt: new Date("2026-01-02T11:00:00.000Z"),
					completedAt: new Date("2026-01-02T11:01:00.000Z"),
				},
			])
			.mockResolvedValueOnce([
				{
					id: "approval-99",
					status: "APPROVED",
					metadata: JSON.stringify({ reviewer: "owner" }),
					createdAt: new Date("2026-01-02T09:00:00.000Z"),
					approvedAt: new Date("2026-01-02T09:30:00.000Z"),
					rejectedAt: null,
				},
			]);

		const { getImplementationProposalDetail } = await import(
			"@/lib/implementation-agent/service"
		);

		const detail = await getImplementationProposalDetail({
			clientId: "client-1",
			proposalId: "proposal-99",
		});

		expect(detail).toEqual(
			expect.objectContaining({
				id: "proposal-99",
				beforeSnapshot: { headline: "old" },
				afterPreview: { headline: "new" },
				proposedPayload: { headline: "new" },
				executionHistory: expect.arrayContaining([
					expect.objectContaining({ id: "exec-99", status: "FAILED" }),
				]),
				rollbackHistory: expect.arrayContaining([
					expect.objectContaining({ id: "rollback-99", status: "SUCCEEDED" }),
				]),
			}),
		);
		expect(detail?.timeline?.length).toBeGreaterThanOrEqual(4);
	});
});
