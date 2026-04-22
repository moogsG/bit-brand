import { cn } from "@/lib/utils";

type TechnicalAuditRunStatus = "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";

interface TechnicalRunsSparklinePoint {
	issuesFound: number;
	status: TechnicalAuditRunStatus;
}

interface TechnicalRunsSparklineProps {
	runs: TechnicalRunsSparklinePoint[];
	label?: string;
	className?: string;
}

const statusBarClass: Record<TechnicalAuditRunStatus, string> = {
	RUNNING: "bg-secondary",
	SUCCESS: "bg-primary/80",
	PARTIAL: "bg-amber-500/70",
	FAILED: "bg-destructive/80",
};

export function TechnicalRunsSparkline({
	runs,
	label = "Last 5 runs",
	className,
}: TechnicalRunsSparklineProps) {
	const recentRuns = runs.slice(0, 5).reverse();
	const maxIssues = Math.max(
		1,
		...recentRuns.map((run) => Math.max(0, run.issuesFound)),
	);
	const ariaLabel =
		recentRuns.length === 0
			? "No technical audit runs available."
			: `Technical audit issue trend for the last ${recentRuns.length} runs: ${recentRuns
					.map((run) => `${run.status} with ${run.issuesFound} issues`)
					.join(", ")}.`;

	return (
		<figure className={cn("space-y-1", className)}>
			<figcaption className="text-[11px] text-muted-foreground">
				{label}
			</figcaption>
			<div
				className="flex h-8 items-end gap-1"
				role="img"
				aria-label={ariaLabel}
			>
				{recentRuns.length === 0 ? (
					<div className="h-2 w-16 rounded-sm bg-muted" aria-hidden="true" />
				) : (
					recentRuns.map((run, index) => {
						const normalizedIssues = Math.max(0, run.issuesFound);
						const heightPct = Math.max(
							20,
							Math.round((normalizedIssues / maxIssues) * 100),
						);

						return (
							<span
								key={`${run.status}-${run.issuesFound}-${index}`}
								className={cn(
									"w-2 rounded-sm transition-[height]",
									statusBarClass[run.status],
								)}
								style={{ height: `${heightPct}%` }}
								aria-hidden="true"
							/>
						);
					})
				)}
			</div>
		</figure>
	);
}
