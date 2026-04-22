import type { HealthScoreResult } from "@/lib/health/score";

export const dashboardStatusOptions = [
	"ALL",
	"HEALTHY",
	"WATCH",
	"AT_RISK",
	"CRITICAL",
	"INACTIVE",
] as const;

export type DashboardStatusFilter = (typeof dashboardStatusOptions)[number];

export interface DashboardFilters {
	status: DashboardStatusFilter;
	manager: string;
	industry: string;
}

export interface DashboardFilterClient {
	clientId: string;
	isActive: boolean;
	healthStatus: HealthScoreResult["status"];
	industry: string | null;
	managerIds: string[];
}

export interface DashboardAlertItem {
	clientId: string;
	clientName: string;
	severity: "critical" | "warning";
	message: string;
	count: number;
}

function parseStatusFilter(value: string | undefined): DashboardStatusFilter {
	if (!value) {
		return "ALL";
	}

	return dashboardStatusOptions.includes(value as DashboardStatusFilter)
		? (value as DashboardStatusFilter)
		: "ALL";
}

export function parseDashboardFilters(searchParams: {
	status?: string;
	manager?: string;
	industry?: string;
}): DashboardFilters {
	return {
		status: parseStatusFilter(searchParams.status),
		manager:
			typeof searchParams.manager === "string" && searchParams.manager.length > 0
				? searchParams.manager
				: "ALL",
		industry:
			typeof searchParams.industry === "string" && searchParams.industry.length > 0
				? searchParams.industry
				: "ALL",
	};
}

export function filterDashboardClients<T extends DashboardFilterClient>(
	clients: T[],
	filters: DashboardFilters,
): T[] {
	return clients.filter((client) => {
		if (filters.status !== "ALL") {
			if (filters.status === "INACTIVE") {
				if (client.isActive) {
					return false;
				}
			} else if (!client.isActive || client.healthStatus !== filters.status) {
				return false;
			}
		}

		if (filters.manager !== "ALL" && !client.managerIds.includes(filters.manager)) {
			return false;
		}

		if (filters.industry !== "ALL" && (client.industry ?? "Unspecified") !== filters.industry) {
			return false;
		}

		return true;
	});
}

export function buildDashboardAlerts(
	clients: Array<{
		clientId: string;
		clientName: string;
		criticalIssues: number;
		warningIssues: number;
		pendingApprovals: number;
	}>,
	limit = 3,
): DashboardAlertItem[] {
	const critical = clients
		.filter((client) => client.criticalIssues > 0)
		.sort((a, b) => b.criticalIssues - a.criticalIssues)
		.slice(0, limit)
		.map((client) => ({
			clientId: client.clientId,
			clientName: client.clientName,
			severity: "critical" as const,
			count: client.criticalIssues,
			message: `${client.criticalIssues} critical issue${client.criticalIssues === 1 ? "" : "s"}`,
		}));

	if (critical.length >= limit) {
		return critical;
	}

	const warnings = clients
		.filter(
			(client) =>
				client.warningIssues + client.pendingApprovals > 0 &&
				!critical.some((alert) => alert.clientId === client.clientId),
		)
		.sort(
			(a, b) =>
				b.warningIssues + b.pendingApprovals - (a.warningIssues + a.pendingApprovals),
		)
		.slice(0, Math.max(0, limit - critical.length))
		.map((client) => {
			const warningCount = client.warningIssues + client.pendingApprovals;
			return {
				clientId: client.clientId,
				clientName: client.clientName,
				severity: "warning" as const,
				count: warningCount,
				message: `${warningCount} warning item${warningCount === 1 ? "" : "s"}`,
			};
		});

	return [...critical, ...warnings];
}
