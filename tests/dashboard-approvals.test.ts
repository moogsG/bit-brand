import { describe, expect, it } from "vitest";
import { countPendingApprovalsByClientForRoles } from "@/lib/dashboard/approvals";

describe("dashboard approvals aggregation", () => {
	it("counts only approvals actionable by role assignments", () => {
		const counts = countPendingApprovalsByClientForRoles(
			[
				{ clientId: "c1", requiredRoles: JSON.stringify(["STRATEGIST"]) },
				{ clientId: "c1", requiredRoles: JSON.stringify(["CLIENT_ADMIN"]) },
				{ clientId: "c2", requiredRoles: JSON.stringify(["STRATEGIST"]) },
			],
			[
				{ clientId: "c1", roleName: "STRATEGIST" },
				{ clientId: null, roleName: "ACCOUNT_MANAGER" },
			],
		);

		expect(counts.get("c1")).toBe(1);
		expect(counts.has("c2")).toBe(false);
	});

	it("applies global roles across all clients", () => {
		const counts = countPendingApprovalsByClientForRoles(
			[
				{ clientId: "c1", requiredRoles: JSON.stringify(["CLIENT_ADMIN"]) },
				{ clientId: "c2", requiredRoles: JSON.stringify(["CLIENT_ADMIN"]) },
			],
			[{ clientId: null, roleName: "CLIENT_ADMIN" }],
		);

		expect(counts.get("c1")).toBe(1);
		expect(counts.get("c2")).toBe(1);
	});

	it("ignores invalid required role payloads", () => {
		const counts = countPendingApprovalsByClientForRoles(
			[
				{ clientId: "c1", requiredRoles: "not-json" },
				{ clientId: "c1", requiredRoles: JSON.stringify([]) },
			],
			[{ clientId: "c1", roleName: "STRATEGIST" }],
		);

		expect(counts.size).toBe(0);
	});
});
