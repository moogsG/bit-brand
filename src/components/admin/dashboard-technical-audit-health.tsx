import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { TechnicalRunsSparkline } from "@/components/shared/technical-runs-sparkline";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardTechnicalAuditHealthItem {
	clientId: string;
	clientName: string;
	status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED" | null;
	issuesFound: number | null;
	completedAt: Date | number | null;
	trendRuns: Array<{
		issuesFound: number;
		status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
	}>;
}

interface DashboardTechnicalAuditHealthProps {
	items: DashboardTechnicalAuditHealthItem[];
}

function formatDate(value: Date | number | null): string {
	if (!value) {
		return "—";
	}

	const parsed = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return "—";
	}

	return parsed.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

const statusVariant: Record<
	Exclude<DashboardTechnicalAuditHealthItem["status"], null>,
	"default" | "secondary" | "outline" | "destructive"
> = {
	RUNNING: "secondary",
	SUCCESS: "default",
	PARTIAL: "outline",
	FAILED: "destructive",
};

export function DashboardTechnicalAuditHealth({
	items,
}: DashboardTechnicalAuditHealthProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<ShieldCheck className="h-4 w-4" />
					Technical Audit Health
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{items.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No clients in your current scope.
					</p>
				) : (
					items.map((item) => (
						<div key={item.clientId} className="rounded-md border p-3">
							<div className="mb-2 flex items-center justify-between gap-2">
								<p className="truncate text-sm font-medium">
									{item.clientName}
								</p>
								{item.status ? (
									<Badge variant={statusVariant[item.status]}>
										{item.status}
									</Badge>
								) : (
									<Badge variant="outline">NOT RUN</Badge>
								)}
							</div>

							<div className="grid grid-cols-2 gap-2 text-xs">
								<div>
									<p className="text-muted-foreground">Issues found</p>
									<p className="font-medium">{item.issuesFound ?? "—"}</p>
								</div>
								<div>
									<p className="text-muted-foreground">Completed</p>
									<p className="font-medium">{formatDate(item.completedAt)}</p>
								</div>
							</div>

							<TechnicalRunsSparkline runs={item.trendRuns} className="mt-3" />

							<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
								<Link
									href={`/admin/clients/${item.clientId}/technical-audits`}
									className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
								>
									Technical audits
								</Link>
								<Link
									href={`/admin/clients/${item.clientId}/implementation-queue`}
									className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
								>
									Implementation queue
								</Link>
								<Link
									href={`/admin/clients/${item.clientId}/technical-audits?intent=create-proposal`}
									className="font-medium text-foreground underline-offset-2 hover:underline"
								>
									Create Proposal
								</Link>
							</div>
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}
