import { desc, eq } from "drizzle-orm";
import { ArrowLeft, Eye, Globe } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { ClientEditForm } from "@/components/admin/client-edit-form";
import { ClientStatusBadge } from "@/components/admin/client-status-badge";
import { DataSourceForm } from "@/components/admin/data-source-form";
import { InviteUserDialog } from "@/components/admin/invite-user-dialog";
import { SyncControls } from "@/components/admin/sync-controls";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
	clients,
	clientUsers,
	dataSources,
	invitations,
	syncJobs,
	users,
} from "@/lib/db/schema";

interface PageProps {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ tab?: string }>;
}

export default async function ClientDetailPage({
	params,
	searchParams,
}: PageProps) {
	const session = await auth();
	if (!session || session.user.role !== "ADMIN") {
		redirect("/login");
	}

	const { id } = await params;
	const { tab = "overview" } = await searchParams;

	// Fetch client
	const client = await db
		.select()
		.from(clients)
		.where(eq(clients.id, id))
		.get();

	if (!client) notFound();

	// Fetch related data in parallel
	const [clientUserRows, invitationRows, dataSourceRows, recentSyncJobs] =
		await Promise.all([
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
			db
				.select()
				.from(invitations)
				.where(eq(invitations.clientId, id))
				.orderBy(),
			db.select().from(dataSources).where(eq(dataSources.clientId, id)),
			db
				.select()
				.from(syncJobs)
				.where(eq(syncJobs.clientId, id))
				.orderBy(desc(syncJobs.createdAt))
				.limit(20)
				.all(),
		]);

	const tabs = [
		"overview",
		"data-sources",
		"sync",
		"users",
		"invitations",
	] as const;
	type TabKey = (typeof tabs)[number];
	const activeTab = (tabs.includes(tab as TabKey) ? tab : "overview") as TabKey;

	const tabLabels: Record<TabKey, string> = {
		overview: "Overview",
		"data-sources": "Data Sources",
		sync: "Sync",
		users: "Users",
		invitations: "Invitations",
	};

	const externalLinks = [
		{ href: `/admin/clients/${id}/keywords`, label: "Keywords" },
		{ href: `/admin/clients/${id}/strategy`, label: "Strategy" },
		{ href: `/admin/clients/${id}/reports`, label: "Reports" },
	];

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
								className={buttonVariants({
									variant: "outline",
									size: "sm",
									className: "gap-2",
								})}
							>
								<Eye className="h-4 w-4" />
								Preview Portal
							</Link>
						</div>
					</div>
				</div>

				{/* Tabs */}
				<div className="border-b border-border">
					<nav className="flex gap-1 -mb-px flex-wrap">
						{tabs.map((t) => (
							<Link
								key={t}
								href={`/admin/clients/${id}?tab=${t}`}
								className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
									activeTab === t
										? "border-primary text-foreground"
										: "border-transparent text-muted-foreground hover:text-foreground"
								}`}
							>
								{tabLabels[t]}
								{t === "users" && (
									<span className="ml-1.5 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
										{clientUserRows.length}
									</span>
								)}
								{t === "invitations" && (
									<span className="ml-1.5 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
										{invitationRows.length}
									</span>
								)}
							</Link>
						))}
						{/* External section links */}
						<div className="flex-1" />
						{externalLinks.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors"
							>
								{link.label} →
							</Link>
						))}
					</nav>
				</div>

				{/* Tab Content */}
				{activeTab === "overview" && (
					<Card>
						<CardHeader>
							<CardTitle>Client Details</CardTitle>
						</CardHeader>
						<CardContent>
							<ClientEditForm client={client} />
						</CardContent>
					</Card>
				)}

				{activeTab === "data-sources" && (
					<DataSourceForm clientId={id} existingSources={dataSourceRows} />
				)}

				{activeTab === "sync" && (
					<SyncControls
						clientId={id}
						dataSources={dataSourceRows}
						recentJobs={recentSyncJobs}
					/>
				)}

				{activeTab === "users" && (
					<Card>
						<CardHeader>
							<CardTitle>Portal Users</CardTitle>
						</CardHeader>
						<CardContent className="p-0">
							{clientUserRows.length === 0 ? (
								<p className="text-sm text-muted-foreground py-6 text-center px-4">
									No users yet. Invite someone from the Invitations tab.
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
				)}

				{activeTab === "invitations" && (
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle>Invitations</CardTitle>
								<InviteUserDialog clientId={id} />
							</div>
						</CardHeader>
						<CardContent className="p-0">
							{invitationRows.length === 0 ? (
								<p className="text-sm text-muted-foreground py-6 text-center px-4">
									No invitations sent yet.
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
											{invitationRows.map((inv) => {
												const isAccepted = !!inv.acceptedAt;
												const isExpired =
													!isAccepted && inv.expiresAt < new Date();
												const statusLabel = isAccepted
													? "Accepted"
													: isExpired
														? "Expired"
														: "Pending";
												const statusClass = isAccepted
													? "text-green-600 dark:text-green-400"
													: isExpired
														? "text-destructive"
														: "text-yellow-600 dark:text-yellow-400";
												return (
													<tr
														key={inv.id}
														className="border-b border-border last:border-0 hover:bg-muted/40"
													>
														<td className="px-4 py-3">{inv.email}</td>
														<td className="px-4 py-3">
															<span
																className={`text-xs font-medium ${statusClass}`}
															>
																{statusLabel}
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
												);
											})}
										</tbody>
									</table>
								</div>
							)}
						</CardContent>
					</Card>
				)}
			</main>
		</div>
	);
}
