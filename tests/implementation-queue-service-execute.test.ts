import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/approvals", () => ({
	createApprovalRequest: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		get: vi.fn(),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
		returning: vi.fn(),
		update: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
	},
}));

vi.mock("@/lib/implementation-agent/providers", () => ({
	findImplementationProvider: vi.fn(),
	isImplementationProviderName: vi.fn((value: string) =>
		["noop", "wordpress"].includes(value),
	),
}));

describe("implementation queue service execution", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("catches provider exceptions and persists FAILED state", async () => {
		const { db } = await import("@/lib/db");
		const { findImplementationProvider } = await import(
			"@/lib/implementation-agent/providers"
		);

		const providerExecute = vi
			.fn()
			.mockRejectedValue(new Error("Provider exploded"));
		(findImplementationProvider as any).mockReturnValue({
			name: "wordpress",
			execute: providerExecute,
			rollback: vi.fn(),
		} as any);

		const dbAny = db as any;
		dbAny.get
			.mockResolvedValueOnce({
				id: "proposal-1",
				clientId: "client-1",
				provider: "wordpress",
				approvalId: "approval-1",
				status: "APPROVED",
				proposalJson: "{}",
			})
			.mockResolvedValueOnce({ status: "APPROVED" });

		dbAny.returning
			.mockResolvedValueOnce([
				{
					id: "exec-1",
					proposalId: "proposal-1",
					clientId: "client-1",
					status: "RUNNING",
				},
			])
			.mockResolvedValueOnce([
				{
					id: "exec-1",
					proposalId: "proposal-1",
					clientId: "client-1",
					status: "FAILED",
					error: "Provider exploded",
				},
			]);

		const { executeImplementationProposal } = await import(
			"@/lib/implementation-agent/service"
		);
		const result = await executeImplementationProposal({
			proposalId: "proposal-1",
			startedBy: "user-1",
		});

		const snapshotCalls = dbAny.values.mock.calls
			.map((call: unknown[]) => call[0])
			.filter(
				(value: any) =>
					value &&
					typeof value === "object" &&
					"type" in value &&
					"proposalId" in value,
			);

		expect(snapshotCalls).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					proposalId: "proposal-1",
					type: "PRE_EXECUTION",
				}),
			]),
		);

		expect(providerExecute).toHaveBeenCalledWith(
			expect.objectContaining({
				context: expect.objectContaining({ dryRun: true }),
			}),
		);
		expect(result.execution.status).toBe("FAILED");
		expect(result.execution.error).toBe("Provider exploded");
	});

	it("fails with VALIDATION_ERROR for unsupported provider at execution time", async () => {
		const { db } = await import("@/lib/db");
		const { findImplementationProvider } = await import(
			"@/lib/implementation-agent/providers"
		);

		(findImplementationProvider as any).mockReturnValue(null);

		const dbAny = db as any;
		dbAny.get
			.mockResolvedValueOnce({
				id: "proposal-1",
				clientId: "client-1",
				provider: "legacy-provider",
				approvalId: "approval-1",
				status: "APPROVED",
				proposalJson: "{}",
			})
			.mockResolvedValueOnce({ status: "APPROVED" });

		const { executeImplementationProposal } = await import(
			"@/lib/implementation-agent/service"
		);

		await expect(
			executeImplementationProposal({
				proposalId: "proposal-1",
				startedBy: "user-1",
			}),
		).rejects.toMatchObject({
			code: "VALIDATION_ERROR",
			message: "Unsupported implementation provider: legacy-provider",
		});
	});
});
