"use client";

import { useMemo, useState } from "react";
import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApprovalDisplayContext } from "@/lib/approvals/metadata";
import type { Approval } from "@/lib/db/schema";

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;
type ApprovalAction = "approve" | "reject" | "cancel";

interface PortalApprovalsListProps {
	approvals: Approval[];
	currentUserId: string;
	canApprove: boolean;
}

export function PortalApprovalsList({
	approvals,
	currentUserId,
	canApprove,
}: PortalApprovalsListProps) {
	const [items, setItems] = useState<Approval[]>(approvals);
	const [pendingActionId, setPendingActionId] = useState<string | null>(null);

	const sorted = useMemo(
		() =>
			[...items].sort((a, b) => {
				const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
				const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
				return bTime - aTime;
			}),
		[items],
	);

	const getStatusVariant = (status: string): BadgeVariant => {
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

	async function handleAction(approvalId: string, action: ApprovalAction) {
		setPendingActionId(approvalId);

		let reason: string | undefined;
		if (action === "reject") {
			const response = window.prompt("Optional rejection reason:");
			reason = response ?? undefined;
		}

		try {
			const response = await fetch(`/api/approvals/${approvalId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action, reason }),
			});

			if (!response.ok) {
				throw new Error("Failed to update approval");
			}

			const updated = (await response.json()) as Approval;
			setItems((prev) =>
				prev.map((item) => (item.id === approvalId ? { ...item, ...updated } : item)),
			);
		} catch (error) {
			console.error("[portal.approvals] action failed", error);
		} finally {
			setPendingActionId(null);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>All approvals for this client</CardTitle>
			</CardHeader>
			<CardContent className="p-0">
				{sorted.length === 0 ? (
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
									<th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">
										Actions
									</th>
								</tr>
							</thead>
							<tbody>
								{sorted.map((approval) => {
									const display = getApprovalDisplayContext({
										resourceType: approval.resourceType,
										resourceId: approval.resourceId,
										metadata: approval.metadata,
									});
									const resolvedAt = approval.approvedAt || approval.rejectedAt;
									const isPending = approval.status === "PENDING";
									const canCancel = approval.requestedBy === currentUserId;
									const isSaving = pendingActionId === approval.id;

									return (
										<tr
											key={approval.id}
											className="border-b border-border last:border-0"
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
												<Badge variant={getStatusVariant(approval.status)}>
													{approval.status}
												</Badge>
											</td>
											<td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
												{approval.createdAt
													? new Date(approval.createdAt).toLocaleDateString()
													: "—"}
											</td>
											<td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
												{resolvedAt ? new Date(resolvedAt).toLocaleDateString() : "—"}
											</td>
											<td className="px-4 py-3">
												<div className="flex items-center justify-end gap-2">
													{isPending && canApprove ? (
														<>
															<Button
																size="sm"
																variant="outline"
																onClick={() => handleAction(approval.id, "approve")}
																disabled={isSaving}
															>
																Approve
															</Button>
															<Button
																size="sm"
																variant="destructive"
																onClick={() => handleAction(approval.id, "reject")}
																disabled={isSaving}
															>
																Reject
															</Button>
														</>
													) : null}
													{isPending && canCancel ? (
														<Button
															size="sm"
															variant="ghost"
															onClick={() => handleAction(approval.id, "cancel")}
															disabled={isSaving}
														>
															Cancel
														</Button>
													) : null}
													{!isPending ? <span className="text-xs text-muted-foreground">—</span> : null}
												</div>
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
