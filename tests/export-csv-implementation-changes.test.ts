import { describe, expect, it } from "vitest";
import { implementationChangesToCSV } from "@/lib/export/csv";

describe("implementationChangesToCSV", () => {
	it("serializes client-safe implementation change rows", () => {
		const csv = implementationChangesToCSV([
			{
				id: "proposal-1",
				title: "Fix robots meta",
				targetRef: "/privacy",
				changeType: "EXECUTION",
				status: "SUCCEEDED",
				approvalStatus: "APPROVED",
				executedAt: "2026-04-20T10:00:00.000Z",
				rolledBackAt: null,
				updatedAt: "2026-04-20T10:05:00.000Z",
			},
		]);

		expect(csv).toContain("Proposal ID,Title,Target,Type,Status,Approval");
		expect(csv).toContain("proposal-1");
		expect(csv).toContain("Fix robots meta");
		expect(csv).toContain("EXECUTION");
		expect(csv).toContain("SUCCEEDED");
	});
});
