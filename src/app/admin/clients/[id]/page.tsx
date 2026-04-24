import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle2,
	ClipboardCheck,
	Eye,
	Globe,
	MessageSquare,
	Target,
	TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { ClientSectionsNav } from "@/components/admin/client-sections-nav";
import { ClientApprovalsList } from "@/components/admin/client-approvals-list";
import { ClientStatusBadge } from "@/components/admin/client-status-badge";
import { InviteUserDialog } from "@/components/admin/invite-user-dialog";
import { KanbanBoard } from "@/components/admin/kanban-board";
import { MessagesThread } from "@/components/portal/messages-thread";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import {
	approvals,
	aiVisibility,
	clientMessages,
	clientOnboardingProfiles,
	clients,
	clientUsers,
	ga4Metrics,
	invitations,
	kanbanColumns,
	onboardingNorthStarGoals,
	rankscaleMetrics,
	tasks,
	technicalAuditRuns,
	technicalIssues,
	users,
} from "@/lib/db/schema";
import { phase1Flags } from "@/lib/flags";

interface PageProps {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ tab?: string }>;
}

function toDateStr(date: Date): string {
	return date.toISOString().split("T")[0] ?? "";
}

function pctChange(current: number, previous: number): number | null {
	if (previous <= 0) return null;
	return ((current - previous) / previous) * 100;
}

export default async function ClientDetailPage({
	params,
	searchParams,
}: PageProps) {
	const session = await auth();
	if (!session) {
		redirect("/login");
	}

	const { id } = await params;
	const { tab = "dashboard" } = await searchParams;
	const accessContext = await getClientAccessContext(session, id);

	if (!can("clients", "view", { session, clientId: id, ...accessContext })) {
		redirect("/portal");
	}

	// Fetch client
	const client = await db
		.select()
		.from(clients)
		.where(eq(clients.id, id))
		.get();

	if (!client) notFound();

	const canViewOnboarding =
		phase1Flags.onboardingV2() &&
		can("onboarding", "view", {
			session,
			clientId: id,
			...accessContext,
		});

	const now = new Date();
	const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
	const d60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
	const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
	const strNow = toDateStr(now);
	const str30 = toDateStr(d30);
	const str60 = toDateStr(d60);
	const str90 = toDateStr(d90);

	// Fetch related data in parallel
	const [
		clientUserRows,
		invitationRows,
		clientTasks,
		clientKanbanColumns,
		clientApprovals,
		messages,
		latestTechnicalRun,
		ga4CurrentTotals,
		ga4PreviousTotals,
		latestOnboardingProfile,
		latestAiVisibility,
		promptResultsLast90,
	] = await Promise.all([
		db
			.select({
				id: clientUsers.id,
				userId: clientUsers.userId,
				createdAt: clientUsers.createdAt,
				userName: users.name,
				userEmail: users.email,
			})
			.from(clientUsers)
			.innerJoin(users, eq(clientUsers.userId, users.id))
			.where(eq(clientUsers.clientId, id)),
		db.select().from(invitations).where(eq(invitations.clientId, id)).orderBy(),
		db.select().from(tasks).where(eq(tasks.clientId, id)).all(),
		db.select().from(kanbanColumns).where(eq(kanbanColumns.clientId, id)).all(),
		db
			.select()
			.from(approvals)
			.where(eq(approvals.clientId, id))
			.orderBy(desc(approvals.createdAt))
			.all(),
			db
				.select()
				.from(clientMessages)
				.where(eq(clientMessages.clientId, id))
				.orderBy(desc(clientMessages.createdAt))
				.limit(200)
				.all(),
		db
			.select({
				id: technicalAuditRuns.id,
				status: technicalAuditRuns.status,
				completedAt: technicalAuditRuns.completedAt,
				startedAt: technicalAuditRuns.startedAt,
			})
			.from(technicalAuditRuns)
			.where(eq(technicalAuditRuns.clientId, id))
			.orderBy(desc(technicalAuditRuns.startedAt))
			.limit(1)
			.get(),
		db
			.select({
				sessions: sql<number>`coalesce(sum(${ga4Metrics.sessions}), 0)`,
				organicSessions: sql<number>`coalesce(sum(${ga4Metrics.organicSessions}), 0)`,
			})
			.from(ga4Metrics)
			.where(
				and(
					eq(ga4Metrics.clientId, id),
					gte(ga4Metrics.date, str30),
					lte(ga4Metrics.date, strNow),
				),
			)
			.get(),
		db
			.select({
				sessions: sql<number>`coalesce(sum(${ga4Metrics.sessions}), 0)`,
				organicSessions: sql<number>`coalesce(sum(${ga4Metrics.organicSessions}), 0)`,
			})
			.from(ga4Metrics)
			.where(
				and(
					eq(ga4Metrics.clientId, id),
					gte(ga4Metrics.date, str60),
					lte(ga4Metrics.date, str30),
				),
			)
			.get(),
		db
			.select({ id: clientOnboardingProfiles.id, status: clientOnboardingProfiles.status })
			.from(clientOnboardingProfiles)
			.where(eq(clientOnboardingProfiles.clientId, id))
			.orderBy(desc(clientOnboardingProfiles.version))
			.limit(1)
			.get(),
		db
			.select()
			.from(aiVisibility)
			.where(eq(aiVisibility.clientId, id))
			.orderBy(desc(aiVisibility.date))
			.limit(1)
			.get(),
		db
			.select({ count: sql<number>`count(*)` })
			.from(rankscaleMetrics)
			.where(
				and(
					eq(rankscaleMetrics.clientId, id),
					gte(rankscaleMetrics.date, str90),
				),
			)
			.get(),
	]);

	const northStar = latestOnboardingProfile
		? await db
				.select({
					statement: onboardingNorthStarGoals.statement,
					metricName: onboardingNorthStarGoals.metricName,
					currentValue: onboardingNorthStarGoals.currentValue,
					targetValue: onboardingNorthStarGoals.targetValue,
					targetDate: onboardingNorthStarGoals.targetDate,
				})
				.from(onboardingNorthStarGoals)
				.where(eq(onboardingNorthStarGoals.profileId, latestOnboardingProfile.id))
				.get()
		: null;

	const criticalIssuesCount = latestTechnicalRun
		? (
				await db
					.select({
						count: sql<number>`count(*)`,
					})
					.from(technicalIssues)
					.where(
						and(
							eq(technicalIssues.clientId, id),
							eq(technicalIssues.runId, latestTechnicalRun.id),
							eq(technicalIssues.severity, "CRITICAL"),
						),
					)
					.get()
			)?.count ?? 0
		: 0;

	const tabs = [
		"dashboard",
		"overview",
		"tasks",
		"communications",
		"users",
		"ai-visibility",
	] as const;
	type TabKey = (typeof tabs)[number];
	const tabKey = (tabs.includes(tab as TabKey) ? tab : "dashboard") as TabKey;
	const activeTab = tabKey === "overview" ? "dashboard" : tabKey;

	const pendingInvitationRows = invitationRows.filter(
		(invitation) => !invitation.acceptedAt && invitation.expiresAt >= new Date(),
	);

	const pendingApprovalsCount = clientApprovals.filter(
		(approval) => approval.status === "PENDING",
	).length;
	const unreadClientMessagesCount = messages.filter(
		(message) => message.senderRole === "CLIENT" && !message.readAt,
	).length;
	const openTasksCount = clientTasks.filter((task) => task.status !== "DONE").length;
	const overdueTasksCount = clientTasks.filter(
		(task) =>
			task.status !== "DONE" &&
			!!task.dueDate &&
			new Date(task.dueDate).getTime() < now.getTime(),
	).length;

	const sessionsCurrent = ga4CurrentTotals?.sessions ?? 0;
	const sessionsPrevious = ga4PreviousTotals?.sessions ?? 0;
	const organicCurrent = ga4CurrentTotals?.organicSessions ?? 0;
	const organicPrevious = ga4PreviousTotals?.organicSessions ?? 0;
	const sessionsTrend = pctChange(sessionsCurrent, sessionsPrevious);
	const organicTrend = pctChange(organicCurrent, organicPrevious);

	const northStarProgress =
		typeof northStar?.currentValue === "number" &&
		typeof northStar?.targetValue === "number" &&
		northStar.targetValue > 0
			? Math.max(
					0,
					Math.min(100, (northStar.currentValue / northStar.targetValue) * 100),
				)
			: null;

	const aiVisibilityScore =
		latestAiVisibility?.overallScore !== null &&
		latestAiVisibility?.overallScore !== undefined
			? Math.round(latestAiVisibility.overallScore)
			: null;

	return (
		<div className="flex flex-col flex-1 overflow-hidden">
			<AdminHeader title={client.name} />
			<main className="flex-1 overflow-y-auto p-6 space-y-6">
				{/* Back + Header */}
				<div className="space-y-3">
					<Link
						href="/admin/clients"
						className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
					>
						<ArrowLeft className="h-3.5 w-3.5" />
						All Clients
					</Link>
					<div className="flex items-start justify-between gap-4">
						<div>
							<div className="flex items-center gap-3">
								<h1 className="text-2xl font-bold">{client.name}</h1>
								<ClientStatusBadge isActive={client.isActive} />
							</div>
							<div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
								<Globe className="h-3.5 w-3.5" />
								<a
									href={`https://${client.domain}`}
									target="_blank"
									rel="noopener noreferrer"
									className="hover:underline"
								>
									{client.domain}
								</a>
								{client.industry && (
									<>
										<span>·</span>
										<span>{client.industry}</span>
									</>
								)}
							</div>
							<p className="text-xs text-muted-foreground mt-0.5">
								Created{" "}
								{client.createdAt
									? new Date(client.createdAt).toLocaleDateString()
									: "—"}
							</p>
						</div>
						<div className="flex-shrink-0">
							<Link
								href={`/portal/${client.slug}/dashboard?impersonate=true`}
								className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
							>
								<Eye className="h-4 w-4" />
								Preview Portal
							</Link>
						</div>
					</div>
				</div>

				<ClientSectionsNav
					clientId={id}
					active={
						activeTab === "dashboard"
							? "dashboard"
							: activeTab === "ai-visibility"
								? "aiVisibility"
							: activeTab === "tasks"
								? "tasks"
								: activeTab === "communications"
									? "communications"
									: "users"
					}
				/>

				{/* Tab Content */}
				{activeTab === "dashboard" && (
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base">
									<ClipboardCheck className="h-4 w-4" />
									Approvals
								</CardTitle>
								<CardDescription>Requests waiting for review.</CardDescription>
							</CardHeader>
							<CardContent className="space-y-1">
								<p className="text-3xl font-bold">{pendingApprovalsCount}</p>
								<p className="text-xs text-muted-foreground">Pending approvals</p>
								<Link href={`/admin/clients/${id}?tab=communications`} className="text-xs font-medium text-primary hover:underline">
									Open approvals
								</Link>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base">
									<MessageSquare className="h-4 w-4" />
									Communications
								</CardTitle>
								<CardDescription>Client thread activity and unread items.</CardDescription>
							</CardHeader>
							<CardContent className="space-y-1">
								<p className="text-3xl font-bold">{messages.length}</p>
								<p className="text-xs text-muted-foreground">
									{unreadClientMessagesCount} unread from client
								</p>
								<Link href={`/admin/clients/${id}?tab=communications`} className="text-xs font-medium text-primary hover:underline">
									Open communications
								</Link>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base">
									<AlertTriangle className="h-4 w-4" />
									Critical Issues
								</CardTitle>
								<CardDescription>From the latest technical audit run.</CardDescription>
							</CardHeader>
							<CardContent className="space-y-1">
								<p className="text-3xl font-bold text-destructive">{criticalIssuesCount}</p>
								<p className="text-xs text-muted-foreground">
									{latestTechnicalRun?.startedAt
										? `Latest run ${new Date(latestTechnicalRun.startedAt).toLocaleDateString()}`
										: "No technical audit run yet"}
								</p>
								<Link href={`/admin/clients/${id}/technical-audits`} className="text-xs font-medium text-primary hover:underline">
									Open technical audits
								</Link>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base">
									<CheckCircle2 className="h-4 w-4" />
									Tasks
								</CardTitle>
								<CardDescription>Open delivery work and overdue items.</CardDescription>
							</CardHeader>
							<CardContent className="space-y-1">
								<p className="text-3xl font-bold">{openTasksCount}</p>
								<p className="text-xs text-muted-foreground">
									{overdueTasksCount} overdue
								</p>
								<Link href={`/admin/clients/${id}?tab=tasks`} className="text-xs font-medium text-primary hover:underline">
									Open tasks
								</Link>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base">
									<TrendingUp className="h-4 w-4" />
									Traffic Data
								</CardTitle>
								<CardDescription>Last 30 days vs previous 30 days (GA4).</CardDescription>
							</CardHeader>
							<CardContent className="space-y-1">
								<p className="text-3xl font-bold">{sessionsCurrent.toLocaleString()}</p>
								<p className="text-xs text-muted-foreground">
									Sessions {sessionsTrend === null ? "(no baseline)" : `${sessionsTrend >= 0 ? "+" : ""}${sessionsTrend.toFixed(1)}%`}
								</p>
								<p className="text-xs text-muted-foreground">
									Organic {organicCurrent.toLocaleString()}
									{organicTrend === null
										? ""
										: ` (${organicTrend >= 0 ? "+" : ""}${organicTrend.toFixed(1)}%)`}
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base">
									<Target className="h-4 w-4" />
									North Star
								</CardTitle>
								<CardDescription>Primary strategic outcome for this client.</CardDescription>
							</CardHeader>
							<CardContent className="space-y-1">
								<p className="line-clamp-2 text-sm font-medium">
									{northStar?.statement ?? "North Star not set"}
								</p>
								<p className="text-xs text-muted-foreground">
									{northStar?.metricName
										? `${northStar.metricName}: ${northStar.currentValue ?? "—"} / ${northStar.targetValue ?? "—"}`
										: "Add a North Star goal in onboarding."}
								</p>
								<p className="text-xs text-muted-foreground">
									Progress {northStarProgress === null ? "N/A" : `${Math.round(northStarProgress)}%`}
								</p>
								{canViewOnboarding ? (
									<Link href={`/admin/clients/${id}/onboarding`} className="text-xs font-medium text-primary hover:underline">
										Open onboarding
									</Link>
								) : null}
							</CardContent>
						</Card>
					</div>
				)}

				{activeTab === "tasks" && (
					<div className="space-y-4">
						<KanbanBoard
							columns={clientKanbanColumns}
							tasks={clientTasks}
							clientId={id}
						/>
					</div>
				)}

				{activeTab === "communications" && (
					<div className="space-y-4">
						<ClientApprovalsList approvals={clientApprovals} />
						<MessagesThread
							messages={messages}
							clientId={id}
							currentRole="ADMIN"
							recipientOptions={clientUserRows.map((member) => ({
								id: member.userId,
								name: member.userName,
								email: member.userEmail,
							}))}
						/>
					</div>
				)}

				{activeTab === "ai-visibility" && (
					<div className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>AI Visibility</CardTitle>
								<CardDescription>
									Quick AI performance snapshot for this client.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-2">
								<p className="text-3xl font-bold">
									{aiVisibilityScore !== null ? aiVisibilityScore : "—"}
								</p>
								<p className="text-xs text-muted-foreground">
									Overall AI visibility score
								</p>
								<p className="text-xs text-muted-foreground">
									{promptResultsLast90?.count ?? 0} prompt results in the last 90 days
								</p>
								<Link
									href={`/admin/clients/${id}/ai-visibility`}
									className="text-xs font-medium text-primary hover:underline"
								>
									Open detailed AI workspace
								</Link>
							</CardContent>
						</Card>
					</div>
				)}

				{activeTab === "users" && (
					<div className="space-y-4">
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between gap-3">
									<CardTitle>Portal Users</CardTitle>
									<InviteUserDialog clientId={id} />
								</div>
							</CardHeader>
							<CardContent className="p-0">
								{clientUserRows.length === 0 ? (
									<p className="text-sm text-muted-foreground py-6 text-center px-4">
										No users yet. Use Add User to send the first invitation.
									</p>
								) : (
									<div className="divide-y divide-border">
										{clientUserRows.map((cu) => (
											<div
												key={cu.id}
												className="flex items-center justify-between px-4 py-3"
											>
												<div>
													<p className="text-sm font-medium">{cu.userName}</p>
													<p className="text-xs text-muted-foreground">
														{cu.userEmail}
													</p>
												</div>
												<p className="text-xs text-muted-foreground">
													Joined{" "}
													{cu.createdAt
														? new Date(cu.createdAt).toLocaleDateString()
														: "—"}
												</p>
											</div>
										))}
									</div>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Pending Invitations</CardTitle>
							</CardHeader>
							<CardContent className="p-0">
								{pendingInvitationRows.length === 0 ? (
									<p className="text-sm text-muted-foreground py-6 text-center px-4">
										No pending invites.
									</p>
								) : (
									<div className="overflow-auto">
										<table className="w-full text-sm">
											<thead>
												<tr className="border-b border-border">
													<th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
														Email
													</th>
													<th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
														Status
													</th>
													<th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground hidden sm:table-cell">
														Expires
													</th>
													<th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground hidden sm:table-cell">
														Sent
													</th>
												</tr>
											</thead>
											<tbody>
												{pendingInvitationRows.map((inv) => (
													<tr
														key={inv.id}
														className="border-b border-border last:border-0 hover:bg-muted/40"
													>
														<td className="px-4 py-3">{inv.email}</td>
														<td className="px-4 py-3">
															<span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
																Pending
															</span>
														</td>
														<td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
															{inv.expiresAt
																? new Date(inv.expiresAt).toLocaleDateString()
																: "—"}
														</td>
														<td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
															{inv.createdAt
																? new Date(inv.createdAt).toLocaleDateString()
																: "—"}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				)}
			</main>
		</div>
	);
}
