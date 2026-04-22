import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HealthScoreResult } from "@/lib/health/score";

interface DashboardClientCardProps {
	client: {
		id: string;
		name: string;
		domain: string;
		industry: string | null;
		isActive: boolean;
	};
	northStar: {
		statement: string | null;
		metricName: string | null;
		targetValue: number | null;
	};
	health: HealthScoreResult;
	counts: {
		criticalIssues: number;
		warningIssues: number;
		pendingApprovals: number;
	};
	managerNames: string[];
}

const healthLabel: Record<HealthScoreResult["status"], string> = {
	HEALTHY: "Healthy",
	WATCH: "Watch",
	AT_RISK: "At Risk",
	CRITICAL: "Critical",
};

const healthVariant: Record<
	HealthScoreResult["status"],
	"default" | "secondary" | "outline" | "destructive"
> = {
	HEALTHY: "default",
	WATCH: "secondary",
	AT_RISK: "outline",
	CRITICAL: "destructive",
};

export function DashboardClientCard({
	client,
	northStar,
	health,
	counts,
	managerNames,
}: DashboardClientCardProps) {
	const issuesTotal = counts.criticalIssues + counts.warningIssues;
	const managerText = managerNames.length > 0 ? managerNames.join(", ") : "Unassigned";

	return (
		<Card className="h-full">
			<CardHeader className="space-y-2">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<CardTitle className="text-base truncate">{client.name}</CardTitle>
						<p className="text-xs text-muted-foreground truncate">{client.domain}</p>
					</div>
					<Badge variant={healthVariant[health.status]}>{healthLabel[health.status]}</Badge>
				</div>
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<span>{client.industry ?? "Unspecified"}</span>
					<span>•</span>
					<span>{client.isActive ? "Active" : "Inactive"}</span>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="rounded-md border bg-muted/30 p-3">
					<div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
						<Target className="h-3.5 w-3.5" />
						North Star
					</div>
					<p className="line-clamp-2 text-sm">
						{northStar.statement ?? "North Star not set"}
					</p>
					{northStar.metricName ? (
						<p className="mt-1 text-xs text-muted-foreground">
							{northStar.metricName}
							{typeof northStar.targetValue === "number"
								? ` → ${northStar.targetValue}`
								: ""}
						</p>
					) : null}
				</div>

				<div className="grid grid-cols-3 gap-2 text-center">
					<div className="rounded-md border p-2">
						<p className="text-lg font-semibold">{health.overallScore}</p>
						<p className="text-[11px] text-muted-foreground">Health</p>
					</div>
					<div className="rounded-md border p-2">
						<p className="text-lg font-semibold text-destructive">{issuesTotal}</p>
						<p className="text-[11px] text-muted-foreground">Issues</p>
					</div>
					<div className="rounded-md border p-2">
						<p className="text-lg font-semibold">{counts.pendingApprovals}</p>
						<p className="text-[11px] text-muted-foreground">Approvals</p>
					</div>
				</div>

				<div className="flex items-center justify-between text-xs text-muted-foreground">
					<p className="truncate">Manager: {managerText}</p>
					<Link
						href={`/admin/clients/${client.id}`}
						className="inline-flex items-center gap-1 font-medium text-foreground"
					>
						Open
						<ArrowRight className="h-3.5 w-3.5" />
					</Link>
				</div>

				{counts.criticalIssues > 0 ? (
					<div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
						<AlertTriangle className="h-3.5 w-3.5" />
						{counts.criticalIssues} critical issue{counts.criticalIssues === 1 ? "" : "s"}
					</div>
				) : (
					<div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-700 dark:text-emerald-300">
						<CheckCircle2 className="h-3.5 w-3.5" />
						No critical issues
					</div>
				)}
			</CardContent>
		</Card>
	);
}
