import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type { PermissionRole } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import {
	clientMessages,
	clients,
	dataSources,
	monthlyReports,
	seoStrategies,
	tasks,
} from "@/lib/db/schema";
import { getDashboardPendingApprovalCounts } from "@/lib/dashboard/approvals";
import {
	computeHealthScore,
	healthScoreConstants,
	type HealthScoreResult,
} from "@/lib/health/score";

interface NumericCountRow {
	clientId: string;
	count: number;
}

interface LatestTimestampRow {
	clientId: string;
	timestamp: number | null;
}

export interface DashboardClientHealthAggregate {
	client: {
		id: string;
		name: string;
		domain: string;
		slug: string;
		industry: string | null;
		isActive: boolean;
		createdAt: Date;
	};
	aggregates: {
		technical: {
			connectedSources: number;
			totalConfiguredSources: number;
			staleSources: number;
			errorSources: number;
			totalExpectedSources: number;
		};
		contentFreshness: {
			lastUpdatedAt: Date | null;
		};
		activeIssues: {
			blockedTasks: number;
			urgentTasks: number;
			pendingApprovals: number;
			unreadClientMessages: number;
		};
	};
	health: HealthScoreResult;
}

export interface DashboardHealthAggregateOptions {
	clientIds?: string[];
	limit?: number;
	asOf?: Date;
	viewer?: {
		userId: string;
		role: PermissionRole;
	};
}

function mapCountRows(rows: NumericCountRow[]): Map<string, number> {
	return new Map(rows.map((row) => [row.clientId, row.count]));
}

function mapTimestampRows(rows: LatestTimestampRow[]): Map<string, number> {
	return new Map(
		rows
			.filter((row): row is { clientId: string; timestamp: number } =>
				Number.isFinite(row.timestamp),
			)
			.map((row) => [row.clientId, row.timestamp]),
	);
}

export async function getDashboardClientHealthAggregates(
	options: DashboardHealthAggregateOptions = {},
): Promise<DashboardClientHealthAggregate[]> {
	const asOf = options.asOf ?? new Date();

	const baseClientQuery = db
		.select({
			id: clients.id,
			name: clients.name,
			domain: clients.domain,
			slug: clients.slug,
			industry: clients.industry,
			isActive: clients.isActive,
			createdAt: clients.createdAt,
		})
		.from(clients)
		.orderBy(desc(clients.createdAt));

	const scopedClientQuery =
		options.clientIds && options.clientIds.length > 0
			? baseClientQuery.where(inArray(clients.id, options.clientIds))
			: baseClientQuery;

	const selectedClients =
		typeof options.limit === "number"
			? await scopedClientQuery.limit(options.limit)
			: await scopedClientQuery;

	if (selectedClients.length === 0) {
		return [];
	}

	const clientIds = selectedClients.map((client) => client.id);
	const staleBeforeTimestamp = new Date(
		asOf.getTime() - healthScoreConstants.TECHNICAL_STALE_DAYS * 24 * 60 * 60 * 1000,
	);

	const [
		configuredSources,
		blockedTaskRows,
		urgentTaskRows,
		pendingApprovalsByClient,
		unreadMessageRows,
		latestStrategyRows,
		latestReportRows,
	] = await Promise.all([
		db
			.select({
				clientId: dataSources.clientId,
				isConnected: dataSources.isConnected,
				lastSyncedAt: dataSources.lastSyncedAt,
				lastSyncError: dataSources.lastSyncError,
			})
			.from(dataSources)
			.where(inArray(dataSources.clientId, clientIds)),
		db
			.select({ clientId: tasks.clientId, count: sql<number>`count(*)` })
			.from(tasks)
			.where(
				and(inArray(tasks.clientId, clientIds), eq(tasks.status, "BLOCKED")),
			)
			.groupBy(tasks.clientId),
		db
			.select({ clientId: tasks.clientId, count: sql<number>`count(*)` })
			.from(tasks)
			.where(
				and(
					inArray(tasks.clientId, clientIds),
					eq(tasks.priority, "URGENT"),
					ne(tasks.status, "DONE"),
					ne(tasks.status, "BLOCKED"),
				),
			)
			.groupBy(tasks.clientId),
		getDashboardPendingApprovalCounts({
			clientIds,
			userId: options.viewer?.userId ?? "",
			role: options.viewer?.role ?? "ADMIN",
		}),
		db
			.select({ clientId: clientMessages.clientId, count: sql<number>`count(*)` })
			.from(clientMessages)
			.where(
				and(
					inArray(clientMessages.clientId, clientIds),
					eq(clientMessages.senderRole, "CLIENT"),
					isNull(clientMessages.readAt),
				),
			)
			.groupBy(clientMessages.clientId),
		db
			.select({
				clientId: seoStrategies.clientId,
				timestamp: sql<number | null>`max(${seoStrategies.updatedAt})`,
			})
			.from(seoStrategies)
			.where(inArray(seoStrategies.clientId, clientIds))
			.groupBy(seoStrategies.clientId),
		db
			.select({
				clientId: monthlyReports.clientId,
				timestamp: sql<number | null>`max(${monthlyReports.updatedAt})`,
			})
			.from(monthlyReports)
			.where(inArray(monthlyReports.clientId, clientIds))
			.groupBy(monthlyReports.clientId),
	]);

	const blockedByClient = mapCountRows(blockedTaskRows as NumericCountRow[]);
	const urgentByClient = mapCountRows(urgentTaskRows as NumericCountRow[]);
	const unreadMessagesByClient = mapCountRows(unreadMessageRows as NumericCountRow[]);

	const latestStrategyByClient = mapTimestampRows(
		latestStrategyRows as LatestTimestampRow[],
	);
	const latestReportByClient = mapTimestampRows(latestReportRows as LatestTimestampRow[]);

	const dataSourcesByClient = new Map<string, (typeof configuredSources)[number][]>();
	for (const source of configuredSources) {
		const sourceList = dataSourcesByClient.get(source.clientId) ?? [];
		sourceList.push(source);
		dataSourcesByClient.set(source.clientId, sourceList);
	}

	return selectedClients.map((client) => {
		const clientSources = dataSourcesByClient.get(client.id) ?? [];
		const connectedSources = clientSources.filter((source) => source.isConnected).length;
		const staleSources = clientSources.filter(
			(source) => source.isConnected && (!source.lastSyncedAt || source.lastSyncedAt < staleBeforeTimestamp),
		).length;
		const errorSources = clientSources.filter(
			(source) =>
				source.isConnected &&
				typeof source.lastSyncError === "string" &&
				source.lastSyncError.trim().length > 0,
		).length;

		const lastStrategyTimestamp = latestStrategyByClient.get(client.id) ?? null;
		const lastReportTimestamp = latestReportByClient.get(client.id) ?? null;
		const latestContentTimestamp = Math.max(
			lastStrategyTimestamp ?? -Infinity,
			lastReportTimestamp ?? -Infinity,
		);
		const lastUpdatedAt = Number.isFinite(latestContentTimestamp)
			? new Date(latestContentTimestamp)
			: null;

		const aggregates = {
			technical: {
				connectedSources,
				totalConfiguredSources: clientSources.length,
				staleSources,
				errorSources,
				totalExpectedSources: healthScoreConstants.DEFAULT_TOTAL_EXPECTED_SOURCES,
			},
			contentFreshness: {
				lastUpdatedAt,
			},
			activeIssues: {
				blockedTasks: blockedByClient.get(client.id) ?? 0,
				urgentTasks: urgentByClient.get(client.id) ?? 0,
				pendingApprovals: pendingApprovalsByClient.get(client.id) ?? 0,
				unreadClientMessages: unreadMessagesByClient.get(client.id) ?? 0,
			},
		};

		const health = computeHealthScore(
			{
				technical: aggregates.technical,
				contentFreshness: aggregates.contentFreshness,
				activeIssues: aggregates.activeIssues,
			},
			{ asOf },
		);

		return {
			client,
			aggregates,
			health,
		};
	});
}

export async function getDashboardClientHealthAggregateByClientId(
	clientId: string,
	options: Omit<DashboardHealthAggregateOptions, "clientIds" | "limit"> = {},
): Promise<DashboardClientHealthAggregate | null> {
	const aggregates = await getDashboardClientHealthAggregates({
		clientIds: [clientId],
		limit: 1,
		asOf: options.asOf,
	});

	return aggregates[0] ?? null;
}
