"use client";

import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApprovalDisplayContext } from "@/lib/approvals/metadata";
import type { Approval } from "@/lib/db/schema";

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

interface ClientApprovalsListProps {
	approvals: Approval[];
}

export function ClientApprovalsList({ approvals }: ClientApprovalsListProps) {
	const getStatusColor = (status: string): BadgeVariant => {
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
		<Card>
			<CardHeader>
				<CardTitle>Approval History</CardTitle>
			</CardHeader>
			<CardContent className="p-0">
				{approvals.length === 0 ? (
					<div className="py-8 text-center text-muted-foreground text-sm px-4">
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
								{approvals.map((approval) => {
									const display = getApprovalDisplayContext({
										resourceType: approval.resourceType,
										resourceId: approval.resourceId,
										metadata: approval.metadata,
									});
									const resolvedAt = approval.approvedAt || approval.rejectedAt;
									return (
										<tr
											key={approval.id}
											className="border-b border-border last:border-0 hover:bg-muted/40"
										>
											<td className="px-4 py-3">
												<div>
													<p className="font-medium">{display.resourceLabel}</p>
													<p className="text-xs text-muted-foreground">
														{display.title}
													</p>
													{display.subtitle ? (
														<p className="text-[11px] text-muted-foreground">
															{display.subtitle}
														</p>
													) : null}
												</div>
											</td>
											<td className="px-4 py-3">
												<Badge variant={getStatusColor(approval.status)}>
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
	);
}
