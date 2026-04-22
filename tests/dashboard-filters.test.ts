import { describe, expect, it } from "vitest";
import {
	buildDashboardAlerts,
	filterDashboardClients,
	parseDashboardFilters,
} from "@/lib/dashboard/filters";

const baseCards = [
	{
		clientId: "c1",
		clientName: "Acme",
		isActive: true,
		healthStatus: "CRITICAL" as const,
		industry: "SaaS",
		managerIds: ["m1"],
		counts: { criticalIssues: 4, warningIssues: 2, pendingApprovals: 1 },
	},
	{
		clientId: "c2",
		clientName: "Bravo",
		isActive: true,
		healthStatus: "WATCH" as const,
		industry: "Healthcare",
		managerIds: ["m2"],
		counts: { criticalIssues: 0, warningIssues: 3, pendingApprovals: 2 },
	},
	{
		clientId: "c3",
		clientName: "Charlie",
		isActive: false,
		healthStatus: "HEALTHY" as const,
		industry: null,
		managerIds: [],
		counts: { criticalIssues: 0, warningIssues: 0, pendingApprovals: 0 },
	},
];

describe("dashboard filters", () => {
	it("parses query values with safe defaults", () => {
		expect(parseDashboardFilters({})).toEqual({
			status: "ALL",
			manager: "ALL",
			industry: "ALL",
		});

		expect(parseDashboardFilters({ status: "INVALID", manager: "m1" })).toEqual({
			status: "ALL",
			manager: "m1",
			industry: "ALL",
		});
	});

	it("filters by status, manager, and industry together", () => {
		const filtered = filterDashboardClients(baseCards, {
			status: "CRITICAL",
			manager: "m1",
			industry: "SaaS",
		});

		expect(filtered).toHaveLength(1);
		expect(filtered[0]?.clientId).toBe("c1");
	});

	it("returns only inactive clients when inactive status is selected", () => {
		const filtered = filterDashboardClients(baseCards, {
			status: "INACTIVE",
			manager: "ALL",
			industry: "ALL",
		});

		expect(filtered.map((item) => item.clientId)).toEqual(["c3"]);
	});
});

describe("dashboard alerts", () => {
	it("prioritizes critical alerts before warning-only items", () => {
		const alerts = buildDashboardAlerts(
			baseCards.map((card) => ({
				clientId: card.clientId,
				clientName: card.clientName,
				criticalIssues: card.counts.criticalIssues,
				warningIssues: card.counts.warningIssues,
				pendingApprovals: card.counts.pendingApprovals,
			})),
			2,
		);

		expect(alerts).toHaveLength(2);
		expect(alerts[0]?.severity).toBe("critical");
		expect(alerts[0]?.clientId).toBe("c1");
		expect(alerts[1]?.severity).toBe("warning");
	});
});
