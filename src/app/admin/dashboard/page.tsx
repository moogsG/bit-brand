import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Activity, Building2, Mail, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { CreateClientDialog } from "@/components/admin/create-client-dialog";
import {
	DashboardActivityFeed,
	type DashboardActivityItem,
} from "@/components/admin/dashboard-activity-feed";
import { DashboardAlertsBar } from "@/components/admin/dashboard-alerts-bar";
import { DashboardClientCard } from "@/components/admin/dashboard-client-card";
import { DashboardFilters } from "@/components/admin/dashboard-filters";
import { DashboardTechnicalAuditHealth } from "@/components/admin/dashboard-technical-audit-health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApprovalDisplayContext } from "@/lib/approvals/metadata";
import { auth } from "@/lib/auth";
import { can, resolvePermissionRole } from "@/lib/auth/authorize";
import { getAssignedClientIdsForUser } from "@/lib/auth/client-access";
import { getDashboardClientHealthAggregates } from "@/lib/dashboard/aggregates";
import {
	buildDashboardAlerts,
	dashboardStatusOptions,
	filterDashboardClients,
	parseDashboardFilters,
} from "@/lib/dashboard/filters";
import { db } from "@/lib/db";
import {
	approvals,
	clientMessages,
	clientOnboardingProfiles,
	clients,
	clientUsers,
	invitations,
	onboardingNorthStarGoals,
	tasks,
	technicalAuditRuns,
	userClientAssignments,
	users,
} from "@/lib/db/schema";
import { phase1Flags } from "@/lib/flags";

interface DashboardPageProps {
	searchParams: Promise<{
		status?: string;
		manager?: string;
		industry?: string;
	}>;
}

function toDate(value: Date | number | null): Date {
	if (value instanceof Date) {
		return value;
	}

	if (typeof value === "number") {
		return new Date(value);
	}

	return new Date(0);
}

const statusLabelMap: Record<(typeof dashboardStatusOptions)[number], string> =
	{
		ALL: "All statuses",
		HEALTHY: "Healthy",
		WATCH: "Watch",
		AT_RISK: "At Risk",
		CRITICAL: "Critical",
		INACTIVE: "Inactive",
	};

export default async function AdminDashboardPage({
	searchParams,
}: DashboardPageProps) {
	const session = await auth();
	if (!session) {
		redirect("/login");
	}

	if (!can("admin", "view", { session })) {
		redirect("/portal");
	}

	const role = resolvePermissionRole({ session });
	const isAssignmentScopedRole =
		role === "ACCOUNT_MANAGER" || role === "STRATEGIST";
	const assignedClientIds = isAssignmentScopedRole
		? await getAssignedClientIdsForUser(session.user.id)
		: [];
	const scopedClientIds = isAssignmentScopedRole ? assignedClientIds : null;
	const dashboardV2Enabled = phase1Flags.dashboardV2();

	if (!dashboardV2Enabled) {
		const scopedClients =
			scopedClientIds && scopedClientIds.length === 0
				? []
				: scopedClientIds
					? await db
							.select({
								id: clients.id,
								name: clients.name,
								isActive: clients.isActive,
							})
							.from(clients)
							.where(inArray(clients.id, scopedClientIds))
					: await db
							.select({
								id: clients.id,
								name: clients.name,
								isActive: clients.isActive,
							})
							.from(clients);

		const scopedClientIdList = scopedClients.map((client) => client.id);

		const pendingInvitesResult =
			scopedClientIdList.length === 0
				? { count: 0 }
				: await db
						.select({ count: count() })
						.from(invitations)
						.where(
							and(
								isNull(invitations.acceptedAt),
								inArray(invitations.clientId, scopedClientIdList),
							),
						)
						.get();

		const totalPortalUsersResult =
			scopedClientIdList.length === 0
				? { count: 0 }
				: await db
						.select({
							count: sql<number>`count(distinct ${clientUsers.userId})`,
						})
						.from(clientUsers)
						.where(inArray(clientUsers.clientId, scopedClientIdList))
						.get();

		const stats = [
			{
				label: "Total Clients",
				value: scopedClients.length,
				icon: Building2,
				description: "Clients in your scope",
			},
			{
				label: "Active Clients",
				value: scopedClients.filter((client) => client.isActive).length,
				icon: Activity,
				description: "Currently active",
			},
			{
				label: "Pending Invitations",
				value: pendingInvitesResult?.count ?? 0,
				icon: Mail,
				description: "Awaiting acceptance",
			},
			{
				label: "Portal Users",
				value: totalPortalUsersResult?.count ?? 0,
				icon: Users,
				description: "Active client accounts",
			},
		];

		const latestAuditRunsByClient = new Map<
			string,
			{
				status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
				issuesFound: number;
				completedAt: Date | number | null;
			}
		>();
		const recentAuditRunsByClient = new Map<
			string,
			Array<{
				status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
				issuesFound: number;
			}>
		>();

		if (scopedClientIdList.length > 0) {
			const latestAuditRows = await db
				.select({
					clientId: technicalAuditRuns.clientId,
					status: technicalAuditRuns.status,
					issuesFound: technicalAuditRuns.issuesFound,
					completedAt: technicalAuditRuns.completedAt,
					startedAt: technicalAuditRuns.startedAt,
				})
				.from(technicalAuditRuns)
				.where(inArray(technicalAuditRuns.clientId, scopedClientIdList))
				.orderBy(desc(technicalAuditRuns.startedAt))
				.all();

			for (const row of latestAuditRows) {
				if (!latestAuditRunsByClient.has(row.clientId)) {
					latestAuditRunsByClient.set(row.clientId, {
						status: row.status,
						issuesFound: row.issuesFound,
						completedAt: row.completedAt ?? row.startedAt,
					});
				}

				const clientRecentRuns =
					recentAuditRunsByClient.get(row.clientId) ?? [];
				if (clientRecentRuns.length < 5) {
					clientRecentRuns.push({
						status: row.status,
						issuesFound: row.issuesFound,
					});
					recentAuditRunsByClient.set(row.clientId, clientRecentRuns);
				}
			}
		}

		const technicalAuditHealthItems = scopedClients
			.slice()
			.sort((a, b) => Number(b.isActive) - Number(a.isActive))
			.map((client) => {
				const latestRun = latestAuditRunsByClient.get(client.id);
				return {
					clientId: client.id,
					clientName: client.name,
					status: latestRun?.status ?? null,
					issuesFound: latestRun?.issuesFound ?? null,
					completedAt: latestRun?.completedAt ?? null,
					trendRuns: recentAuditRunsByClient.get(client.id) ?? [],
				};
			});

		return (
			<div className="flex flex-1 flex-col overflow-hidden">
				<AdminHeader title="Dashboard" />
				<main className="flex-1 space-y-6 overflow-y-auto p-6">
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{stats.map(({ label, value, icon: Icon, description }) => (
							<Card key={label}>
								<CardHeader>
									<div className="flex items-center justify-between">
										<CardTitle className="text-sm font-medium text-muted-foreground">
											{label}
										</CardTitle>
										<Icon className="h-4 w-4 text-muted-foreground" />
									</div>
								</CardHeader>
								<CardContent>
									<p className="text-3xl font-bold">{value}</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{description}
									</p>
								</CardContent>
							</Card>
						))}
					</div>

					<Card>
						<CardHeader>
							<CardTitle>Dashboard v2 disabled</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2 text-sm text-muted-foreground">
							<p>
								The enhanced dashboard sections are currently disabled in this
								environment.
							</p>
							<p>
								Enable <code>FF_DASHBOARD_V2=true</code> to restore alerts,
								filters, client cards, and activity feed panels.
							</p>
						</CardContent>
					</Card>

					<DashboardTechnicalAuditHealth items={technicalAuditHealthItems} />
				</main>
			</div>
		);
	}

	const filters = parseDashboardFilters(await searchParams);

	const clientHealthCards =
		scopedClientIds && scopedClientIds.length === 0
			? []
			: await getDashboardClientHealthAggregates({
					clientIds: scopedClientIds ?? undefined,
					viewer: {
						userId: session.user.id,
						role,
					},
				});

	const visibleClientIds = clientHealthCards.map(({ client }) => client.id);

	const pendingInvitesResult =
		visibleClientIds.length === 0
			? { count: 0 }
			: await db
					.select({ count: count() })
					.from(invitations)
					.where(
						and(
							isNull(invitations.acceptedAt),
							inArray(invitations.clientId, visibleClientIds),
						),
					)
					.get();

	const totalPortalUsersResult =
		visibleClientIds.length === 0
			? { count: 0 }
			: await db
					.select({ count: sql<number>`count(distinct ${clientUsers.userId})` })
					.from(clientUsers)
					.where(inArray(clientUsers.clientId, visibleClientIds))
					.get();

	const managerAssignments =
		visibleClientIds.length === 0
			? []
			: await db
					.select({
						clientId: userClientAssignments.clientId,
						managerId: users.id,
						managerName: users.name,
					})
					.from(userClientAssignments)
					.innerJoin(users, eq(users.id, userClientAssignments.userId))
					.where(inArray(userClientAssignments.clientId, visibleClientIds));

	const onboardingProfiles =
		visibleClientIds.length === 0
			? []
			: await db
					.select({
						id: clientOnboardingProfiles.id,
						clientId: clientOnboardingProfiles.clientId,
						version: clientOnboardingProfiles.version,
					})
					.from(clientOnboardingProfiles)
					.where(inArray(clientOnboardingProfiles.clientId, visibleClientIds))
					.orderBy(desc(clientOnboardingProfiles.version));

	const latestProfileByClient = new Map<
		string,
		{ id: string; version: number }
	>();
	for (const profile of onboardingProfiles) {
		if (!latestProfileByClient.has(profile.clientId)) {
			latestProfileByClient.set(profile.clientId, {
				id: profile.id,
				version: profile.version,
			});
		}
	}

	const northStarProfileIds = Array.from(latestProfileByClient.values()).map(
		(profile) => profile.id,
	);

	const northStars =
		northStarProfileIds.length === 0
			? []
			: await db
					.select({
						profileId: onboardingNorthStarGoals.profileId,
						statement: onboardingNorthStarGoals.statement,
						metricName: onboardingNorthStarGoals.metricName,
						targetValue: onboardingNorthStarGoals.targetValue,
					})
					.from(onboardingNorthStarGoals)
					.where(
						inArray(onboardingNorthStarGoals.profileId, northStarProfileIds),
					);

	const northStarByProfileId = new Map(
		northStars.map((northStar) => [northStar.profileId, northStar]),
	);

	const managersByClientId = new Map<
		string,
		Array<{ managerId: string; managerName: string }>
	>();
	for (const assignment of managerAssignments) {
		const existing = managersByClientId.get(assignment.clientId) ?? [];
		existing.push({
			managerId: assignment.managerId,
			managerName: assignment.managerName,
		});
		managersByClientId.set(assignment.clientId, existing);
	}

	const approvalActivityRows =
		visibleClientIds.length === 0
			? []
			: await db
					.select({
						id: approvals.id,
						clientId: approvals.clientId,
						clientName: clients.name,
						resourceType: approvals.resourceType,
						resourceId: approvals.resourceId,
						metadata: approvals.metadata,
						status: approvals.status,
						createdAt: approvals.createdAt,
					})
					.from(approvals)
					.innerJoin(clients, eq(clients.id, approvals.clientId))
					.where(inArray(approvals.clientId, visibleClientIds))
					.orderBy(desc(approvals.createdAt))
					.limit(8);

	const taskActivityRows =
		visibleClientIds.length === 0
			? []
			: await db
					.select({
						id: tasks.id,
						clientId: tasks.clientId,
						clientName: clients.name,
						title: tasks.title,
						status: tasks.status,
						priority: tasks.priority,
						updatedAt: tasks.updatedAt,
					})
					.from(tasks)
					.innerJoin(clients, eq(clients.id, tasks.clientId))
					.where(inArray(tasks.clientId, visibleClientIds))
					.orderBy(desc(tasks.updatedAt))
					.limit(8);

	const messageActivityRows =
		visibleClientIds.length === 0
			? []
			: await db
					.select({
						id: clientMessages.id,
						clientId: clientMessages.clientId,
						clientName: clients.name,
						senderRole: clientMessages.senderRole,
						createdAt: clientMessages.createdAt,
					})
					.from(clientMessages)
					.innerJoin(clients, eq(clients.id, clientMessages.clientId))
					.where(inArray(clientMessages.clientId, visibleClientIds))
					.orderBy(desc(clientMessages.createdAt))
					.limit(8);

	const latestAuditRows =
		visibleClientIds.length === 0
			? []
			: await db
					.select({
						clientId: technicalAuditRuns.clientId,
						status: technicalAuditRuns.status,
						issuesFound: technicalAuditRuns.issuesFound,
						completedAt: technicalAuditRuns.completedAt,
						startedAt: technicalAuditRuns.startedAt,
					})
					.from(technicalAuditRuns)
					.where(inArray(technicalAuditRuns.clientId, visibleClientIds))
					.orderBy(desc(technicalAuditRuns.startedAt))
					.all();

	const latestAuditByClient = new Map<
		string,
		{
			status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
			issuesFound: number;
			completedAt: Date | number | null;
		}
	>();
	const recentAuditRunsByClient = new Map<
		string,
		Array<{
			status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
			issuesFound: number;
		}>
	>();

	for (const row of latestAuditRows) {
		if (!latestAuditByClient.has(row.clientId)) {
			latestAuditByClient.set(row.clientId, {
				status: row.status,
				issuesFound: row.issuesFound,
				completedAt: row.completedAt ?? row.startedAt,
			});
		}

		const clientRecentRuns = recentAuditRunsByClient.get(row.clientId) ?? [];
		if (clientRecentRuns.length < 5) {
			clientRecentRuns.push({
				status: row.status,
				issuesFound: row.issuesFound,
			});
			recentAuditRunsByClient.set(row.clientId, clientRecentRuns);
		}
	}

	const activityItems: DashboardActivityItem[] = [
		...approvalActivityRows.map((approval) => {
			const display = getApprovalDisplayContext({
				resourceType: approval.resourceType,
				resourceId: approval.resourceId,
				metadata: approval.metadata,
				clientName: approval.clientName,
			});

			return {
				id: `approval-${approval.id}`,
				type: "APPROVAL" as const,
				clientId: approval.clientId,
				clientName: approval.clientName,
				title: `${display.resourceLabel} ${approval.status.toLowerCase()}`,
				detail:
					display.subtitle ?? `Approval request for ${display.resourceLabel}.`,
				createdAt: toDate(approval.createdAt),
			};
		}),
		...taskActivityRows.map((task) => ({
			id: `task-${task.id}`,
			type: "TASK" as const,
			clientId: task.clientId,
			clientName: task.clientName,
			title: task.title,
			detail: `${task.status.replaceAll("_", " ")} • ${task.priority} priority`,
			createdAt: toDate(task.updatedAt),
		})),
		...messageActivityRows.map((message) => ({
			id: `message-${message.id}`,
			type: "MESSAGE" as const,
			clientId: message.clientId,
			clientName: message.clientName,
			title: `${message.senderRole === "CLIENT" ? "Client" : "Agency"} message`,
			detail: "New message in the shared client thread.",
			createdAt: toDate(message.createdAt),
		})),
	]
		.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
		.slice(0, 12);

	const dashboardCards = clientHealthCards.map(
		({ client, aggregates, health }) => {
			const managers = managersByClientId.get(client.id) ?? [];
			const latestProfile = latestProfileByClient.get(client.id);
			const northStar = latestProfile
				? northStarByProfileId.get(latestProfile.id)
				: undefined;

			const criticalIssues =
				aggregates.activeIssues.blockedTasks +
				aggregates.activeIssues.urgentTasks +
				aggregates.technical.errorSources;
			const warningIssues =
				aggregates.activeIssues.unreadClientMessages +
				aggregates.technical.staleSources;

			return {
				client,
				northStar: {
					statement: northStar?.statement ?? null,
					metricName: northStar?.metricName ?? null,
					targetValue: northStar?.targetValue ?? null,
				},
				health,
				counts: {
					criticalIssues,
					warningIssues,
					pendingApprovals: aggregates.activeIssues.pendingApprovals,
				},
				managerIds: managers.map((manager) => manager.managerId),
				managerNames: managers.map((manager) => manager.managerName),
			};
		},
	);

	const filteredDashboardCards = filterDashboardClients(
		dashboardCards.map((card) => ({
			...card,
			clientId: card.client.id,
			isActive: card.client.isActive,
			healthStatus: card.health.status,
			industry: card.client.industry,
		})),
		filters,
	);

	const technicalAuditHealthItems = filteredDashboardCards
		.map((card) => {
			const latestRun = latestAuditByClient.get(card.client.id);
			return {
				clientId: card.client.id,
				clientName: card.client.name,
				status: latestRun?.status ?? null,
				issuesFound: latestRun?.issuesFound ?? null,
				completedAt: latestRun?.completedAt ?? null,
				trendRuns: recentAuditRunsByClient.get(card.client.id) ?? [],
			};
		})
		.sort((a, b) => a.clientName.localeCompare(b.clientName));

	const alertItems = buildDashboardAlerts(
		filteredDashboardCards.map((card) => ({
			clientId: card.client.id,
			clientName: card.client.name,
			criticalIssues: card.counts.criticalIssues,
			warningIssues: card.counts.warningIssues,
			pendingApprovals: card.counts.pendingApprovals,
		})),
	);

	const alertTotals = filteredDashboardCards.reduce(
		(acc, card) => {
			acc.critical += card.counts.criticalIssues;
			acc.warnings += card.counts.warningIssues;
			acc.pendingApprovals += card.counts.pendingApprovals;
			return acc;
		},
		{ critical: 0, warnings: 0, pendingApprovals: 0 },
	);

	const managerOptions = [
		{ value: "ALL", label: "All managers" },
		...Array.from(
			new Map(
				dashboardCards
					.flatMap((card) =>
						card.managerIds.map((managerId, index) => ({
							managerId,
							managerName: card.managerNames[index] ?? "Unknown",
						})),
					)
					.map((manager) => [manager.managerId, manager]),
			).values(),
		).map((manager) => ({
			value: manager.managerId,
			label: manager.managerName,
		})),
	];

	const industryOptions = [
		{ value: "ALL", label: "All industries" },
		...Array.from(
			new Set(
				dashboardCards.map((card) => card.client.industry ?? "Unspecified"),
			),
		)
			.sort((a, b) => a.localeCompare(b))
			.map((industry) => ({ value: industry, label: industry })),
	];

	const stats = [
		{
			label: "Total Clients",
			value: clientHealthCards.length,
			icon: Building2,
			description: "Clients in your scope",
		},
		{
			label: "Active Clients",
			value: clientHealthCards.filter((item) => item.client.isActive).length,
			icon: Activity,
			description: "Currently active",
		},
		{
			label: "Pending Invitations",
			value: pendingInvitesResult?.count ?? 0,
			icon: Mail,
			description: "Awaiting acceptance",
		},
		{
			label: "Portal Users",
			value: totalPortalUsersResult?.count ?? 0,
			icon: Users,
			description: "Active client accounts",
		},
	];

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<AdminHeader title="Dashboard" />
			<main className="flex-1 space-y-6 overflow-y-auto p-6">
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{stats.map(({ label, value, icon: Icon, description }) => (
						<Card key={label}>
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle className="text-sm font-medium text-muted-foreground">
										{label}
									</CardTitle>
									<Icon className="h-4 w-4 text-muted-foreground" />
								</div>
							</CardHeader>
							<CardContent>
								<p className="text-3xl font-bold">{value}</p>
								<p className="mt-1 text-xs text-muted-foreground">
									{description}
								</p>
							</CardContent>
						</Card>
					))}
				</div>

				<DashboardAlertsBar alerts={alertItems} totals={alertTotals} />

				<DashboardFilters
					statusOptions={dashboardStatusOptions.map((status) => ({
						value: status,
						label: statusLabelMap[status],
					}))}
					managerOptions={managerOptions}
					industryOptions={industryOptions}
					current={{
						status: filters.status,
						manager: filters.manager,
						industry: filters.industry,
					}}
				/>

				<div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
					<section className="space-y-4">
						<div className="flex items-center justify-between">
							<h2 className="text-base font-semibold">Client Overview</h2>
							<CreateClientDialog />
						</div>

						{filteredDashboardCards.length === 0 ? (
							<Card>
								<CardContent className="py-8 text-center text-sm text-muted-foreground">
									No clients match the current filters.
								</CardContent>
							</Card>
						) : (
							<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
								{filteredDashboardCards.map((card) => (
									<DashboardClientCard
										key={card.client.id}
										client={card.client}
										northStar={card.northStar}
										health={card.health}
										counts={card.counts}
										managerNames={card.managerNames}
									/>
								))}
							</div>
						)}
					</section>

					<div className="space-y-4">
						<DashboardActivityFeed items={activityItems} />
						<DashboardTechnicalAuditHealth items={technicalAuditHealthItems} />
					</div>
				</div>
			</main>
		</div>
	);
}
