import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { approvals, clients } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function PortalApprovalsPage({
	params,
}: {
	params: Promise<{ clientSlug: string }>;
}) {
	const session = await auth();
	if (!session) redirect("/login");
	const { clientSlug } = await params;

	const client = await db
		.select()
		.from(clients)
		.where(eq(clients.slug, clientSlug))
		.get();

	if (!client) redirect("/portal");

	// Limit view to this client
	if (session.user.role === "CLIENT") {
		// membership check done in layout; no-op here
	}

	const items = await db
		.select()
		.from(approvals)
		.where(eq(approvals.clientId, client.id))
		.orderBy(desc(approvals.createdAt))
		.all();

	const getStatusVariant = (status: string) => {
		switch (status) {
			case "APPROVED":
				return "default";
			case "REJECTED":
				return "destructive";
			case "PENDING":
				return "secondary";
			default:
				return "outline";
		}
	};

	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Approvals</h1>
			<Card>
				<CardHeader>
					<CardTitle>All approvals for this client</CardTitle>
				</CardHeader>
				<CardContent className="p-0">
					{items.length === 0 ? (
						<div className="py-8 text-center text-sm text-muted-foreground">
							No approvals yet
						</div>
					) : (
						<div className="overflow-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-border">
										<th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
											Resource
										</th>
										<th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
											Status
										</th>
										<th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground hidden sm:table-cell">
											Requested
										</th>
										<th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground hidden sm:table-cell">
											Resolved
										</th>
									</tr>
								</thead>
								<tbody>
									{items.map((approval) => {
										const metadata = approval.metadata
											? JSON.parse(approval.metadata)
											: {};
										const resolvedAt =
											approval.approvedAt || approval.rejectedAt;
										return (
											<tr
												key={approval.id}
												className="border-b border-border last:border-0"
											>
												<td className="px-4 py-3">
													<div>
														<p className="font-medium">{approval.resourceType}</p>
														<p className="text-xs text-muted-foreground">
															{metadata.title || approval.resourceId}
														</p>
													</div>
												</td>
												<td className="px-4 py-3">
													<Badge variant={getStatusVariant(approval.status) as any}>
														{approval.status}
													</Badge>
												</td>
												<td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
													{approval.createdAt
														? new Date(approval.createdAt).toLocaleDateString()
														: "—"}
												</td>
												<td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
													{resolvedAt
														? new Date(resolvedAt).toLocaleDateString()
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
		</div>
	);
}
