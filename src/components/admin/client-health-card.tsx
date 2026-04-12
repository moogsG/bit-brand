"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, AlertCircle, CheckCircle2 } from "lucide-react";

interface ClientHealthCardProps {
	client: {
		id: string;
		name: string;
		domain: string;
		isActive: boolean;
	};
	counts: {
		pendingApprovals: number;
		criticalTasks: number;
		unreadMessages: number;
	};
}

export function ClientHealthCard({ client, counts }: ClientHealthCardProps) {
	const { pendingApprovals, criticalTasks, unreadMessages } = counts;
	
	// Determine health status
	const hasIssues = pendingApprovals > 0 || criticalTasks > 0;
	const healthStatus = hasIssues ? "attention" : "healthy";
	
	return (
		<Link href={`/admin/clients/${client.id}`}>
			<Card className="hover:bg-muted/40 transition-colors cursor-pointer h-full">
				<CardContent className="p-4 space-y-3">
					{/* Header: Client name + status badge */}
					<div className="flex items-start justify-between gap-2">
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2 mb-1">
								<Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
								<h3 className="font-medium text-sm truncate">{client.name}</h3>
							</div>
							<p className="text-xs text-muted-foreground truncate">{client.domain}</p>
						</div>
						<Badge
							variant={healthStatus === "attention" ? "destructive" : "default"}
							className="flex-shrink-0"
						>
							{healthStatus === "attention" ? (
								<>
									<AlertCircle className="h-3 w-3 mr-1" />
									Needs Attention
								</>
							) : (
								<>
									<CheckCircle2 className="h-3 w-3 mr-1" />
									Healthy
								</>
							)}
						</Badge>
					</div>

					{/* Counts grid */}
					<div className="grid grid-cols-3 gap-2 pt-2 border-t">
						<div className="text-center">
							<div className={`text-lg font-semibold ${pendingApprovals > 0 ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`}>
								{pendingApprovals}
							</div>
							<div className="text-xs text-muted-foreground">Approvals</div>
						</div>
						<div className="text-center">
							<div className={`text-lg font-semibold ${criticalTasks > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
								{criticalTasks}
							</div>
							<div className="text-xs text-muted-foreground">Critical</div>
						</div>
						<div className="text-center">
							<div className={`text-lg font-semibold ${unreadMessages > 0 ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}>
								{unreadMessages}
							</div>
							<div className="text-xs text-muted-foreground">Messages</div>
						</div>
					</div>
				</CardContent>
			</Card>
		</Link>
	);
}
