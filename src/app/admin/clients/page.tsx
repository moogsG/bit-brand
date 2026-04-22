import { desc, inArray } from "drizzle-orm";
import { ExternalLink, Eye } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { ClientStatusBadge } from "@/components/admin/client-status-badge";
import { CreateClientDialog } from "@/components/admin/create-client-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { can, resolvePermissionRole } from "@/lib/auth/authorize";
import { getAssignedClientIdsForUser } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";

export default async function AdminClientsPage() {
	const session = await auth();
	if (!session) {
		redirect("/login");
	}

	if (!can("clients", "view", { session })) {
		redirect("/portal");
	}

	const role = resolvePermissionRole({ session });
	const isAssignmentScopedRole =
		role === "ACCOUNT_MANAGER" || role === "STRATEGIST";
	const assignedClientIds = isAssignmentScopedRole
		? await getAssignedClientIdsForUser(session.user.id)
		: [];

	const allClients =
		isAssignmentScopedRole && assignedClientIds.length === 0
			? []
			: isAssignmentScopedRole
				? await db
						.select()
						.from(clients)
						.where(inArray(clients.id, assignedClientIds))
						.orderBy(desc(clients.createdAt))
				: await db.select().from(clients).orderBy(desc(clients.createdAt));

	return (
		<div className="flex flex-col flex-1 overflow-hidden">
			<AdminHeader title="Clients" />
			<main className="flex-1 overflow-y-auto p-6 space-y-4">
				{/* Toolbar */}
				<div className="flex items-center justify-between">
					<p className="text-sm text-muted-foreground">
						{allClients.length} {allClients.length === 1 ? "client" : "clients"}
					</p>
					<CreateClientDialog />
				</div>

				{/* Clients Table */}
				<Card>
					<CardContent className="p-0">
						{allClients.length === 0 ? (
							<div className="py-12 text-center text-muted-foreground text-sm">
								No clients yet. Create one to get started.
							</div>
						) : (
							<div className="overflow-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b border-border">
											<th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
												Name
											</th>
											<th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
												Domain
											</th>
											<th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
												Status
											</th>
											<th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground hidden sm:table-cell">
												Created
											</th>
											<th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">
												Actions
											</th>
											<th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">
												Preview
											</th>
										</tr>
									</thead>
									<tbody>
										{allClients.map((client) => (
											<tr
												key={client.id}
												className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
											>
												<td className="px-4 py-3 font-medium">
													<Link
														href={`/admin/clients/${client.id}`}
														className="hover:underline"
													>
														{client.name}
													</Link>
												</td>
												<td className="px-4 py-3 text-muted-foreground">
													<span className="flex items-center gap-1">
														{client.domain}
														<a
															href={`https://${client.domain}`}
															target="_blank"
															rel="noopener noreferrer"
															className="text-muted-foreground hover:text-foreground"
														>
															<ExternalLink className="h-3 w-3" />
														</a>
													</span>
												</td>
												<td className="px-4 py-3">
													<ClientStatusBadge isActive={client.isActive} />
												</td>
												<td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
													{client.createdAt
														? new Date(client.createdAt).toLocaleDateString()
														: "—"}
												</td>
												<td className="px-4 py-3 text-right">
													<Link
														href={`/admin/clients/${client.id}`}
														className="text-sm text-primary hover:underline"
													>
														View →
													</Link>
												</td>
												<td className="px-4 py-3 text-right">
													<Link
														href={`/portal/${client.slug}/dashboard?impersonate=true`}
														className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
													>
														<Eye className="h-3.5 w-3.5" />
														Preview
													</Link>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</CardContent>
				</Card>
			</main>
		</div>
	);
}
