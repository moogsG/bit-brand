"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import type { Approval } from "@/lib/db/schema";

interface PendingApprovalsCardProps {
	approvals: Approval[];
	onApprove?: (id: string) => void;
	onReject?: (id: string) => void;
}

export function PendingApprovalsCard({
	approvals,
	onApprove,
	onReject,
}: PendingApprovalsCardProps) {
	const pendingApprovals = approvals.filter((a) => a.status === "PENDING");

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<Clock className="h-5 w-5" />
						Pending Approvals
					</CardTitle>
					<Badge variant="secondary">{pendingApprovals.length}</Badge>
				</div>
			</CardHeader>
			<CardContent className="p-0">
				{pendingApprovals.length === 0 ? (
					<div className="py-8 text-center text-muted-foreground text-sm px-4">
						No pending approvals
					</div>
				) : (
					<div className="divide-y divide-border">
						{pendingApprovals.map((approval) => {
							const metadata = approval.metadata
								? JSON.parse(approval.metadata)
								: {};
							return (
								<div
									key={approval.id}
									className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
								>
									<div className="min-w-0 flex-1">
										<p className="text-sm font-medium truncate">
											{approval.resourceType} - {metadata.title || "Untitled"}
										</p>
										<p className="text-xs text-muted-foreground">
											Requested{" "}
											{approval.createdAt
												? new Date(approval.createdAt).toLocaleDateString()
												: "—"}
										</p>
									</div>
									<div className="flex items-center gap-2 ml-4 flex-shrink-0">
										{onApprove && (
											<Button
												size="sm"
												variant="ghost"
												onClick={() => onApprove(approval.id)}
												className="h-8 w-8 p-0"
											>
												<CheckCircle className="h-4 w-4 text-green-600" />
											</Button>
										)}
										{onReject && (
											<Button
												size="sm"
												variant="ghost"
												onClick={() => onReject(approval.id)}
												className="h-8 w-8 p-0"
											>
												<XCircle className="h-4 w-4 text-destructive" />
											</Button>
										)}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
