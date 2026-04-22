import Link from "next/link";
import { AlertTriangle, BellRing } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardAlertItem } from "@/lib/dashboard/filters";

interface DashboardAlertsBarProps {
	alerts: DashboardAlertItem[];
	totals: {
		critical: number;
		warnings: number;
		pendingApprovals: number;
	};
}

export function DashboardAlertsBar({ alerts, totals }: DashboardAlertsBarProps) {
	return (
		<Card>
			<CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
				<div className="flex items-center gap-2">
					<BellRing className="h-4 w-4" />
					<p className="text-sm font-medium">
						Critical: {totals.critical} • Warnings: {totals.warnings} • Pending Approvals: {totals.pendingApprovals}
					</p>
				</div>

				{alerts.length === 0 ? (
					<p className="text-sm text-muted-foreground">No priority alerts in the current view.</p>
				) : (
					<div className="flex flex-wrap items-center gap-2">
						{alerts.map((alert) => (
							<Link
								key={`${alert.clientId}-${alert.severity}`}
								href={`/admin/clients/${alert.clientId}`}
								className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted/60"
							>
								<AlertTriangle
									className={`h-3.5 w-3.5 ${alert.severity === "critical" ? "text-destructive" : "text-amber-600"}`}
								/>
								<span className="font-medium">{alert.clientName}:</span>
								<span className="text-muted-foreground">{alert.message}</span>
							</Link>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
