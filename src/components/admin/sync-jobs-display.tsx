"use client";

import {
	AlertCircle,
	CheckCircle,
	Clock,
	Loader2,
	XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SyncJob } from "@/lib/db/schema";

type DataSourceType = "GA4" | "GSC" | "MOZ" | "RANKSCALE" | "DATAFORSEO";

const SOURCE_LABELS: Record<DataSourceType, string> = {
	GA4: "Google Analytics 4",
	GSC: "Google Search Console",
	MOZ: "Moz",
	RANKSCALE: "RankScale",
	DATAFORSEO: "DataForSEO",
};

interface SyncJobsDisplayProps {
	jobs: SyncJob[];
	title?: string;
	maxJobs?: number;
}

function formatDuration(startedAt: Date | null, completedAt: Date | null) {
	if (!startedAt) return "—";
	if (!completedAt) return "Running...";

	const durationMs =
		new Date(completedAt).getTime() - new Date(startedAt).getTime();
	const seconds = Math.floor(durationMs / 1000);

	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}m ${remainingSeconds}s`;
}

function formatRelativeTime(date: Date | null): string {
	if (!date) return "—";
	const now = new Date();
	const diffMs = now.getTime() - new Date(date).getTime();
	const diffMins = Math.floor(diffMs / 60_000);
	const diffHours = Math.floor(diffMs / 3_600_000);
	const diffDays = Math.floor(diffMs / 86_400_000);

	if (diffMins < 1) return "Just now";
	if (diffMins < 60)
		return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
	if (diffHours < 24)
		return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
	return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function StatusIcon({ status }: { status: SyncJob["status"] }) {
	switch (status) {
		case "SUCCESS":
			return <CheckCircle className="h-4 w-4 text-green-500" />;
		case "FAILED":
		case "FAILED_PERMANENT":
			return <XCircle className="h-4 w-4 text-destructive" />;
		case "RUNNING":
			return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
		case "PENDING":
			return <Clock className="h-4 w-4 text-muted-foreground" />;
		default:
			return <AlertCircle className="h-4 w-4 text-amber-500" />;
	}
}

function StatusBadge({ status }: { status: SyncJob["status"] }) {
	const colors: Record<SyncJob["status"], string> = {
		SUCCESS:
			"bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
		FAILED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
		FAILED_PERMANENT:
			"bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
		RUNNING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
		PENDING: "bg-muted text-muted-foreground",
	};

	return (
		<span
			className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status]}`}
		>
			{status}
		</span>
	);
}

export function SyncJobsDisplay({
	jobs,
	title = "Recent Sync Jobs",
	maxJobs = 10,
}: SyncJobsDisplayProps) {
	const displayJobs = jobs.slice(0, maxJobs);

	if (displayJobs.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">{title}</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground text-center py-4">
						No sync jobs yet
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">{title}</CardTitle>
				<p className="text-xs text-muted-foreground">
					Showing {displayJobs.length} of {jobs.length} job
					{jobs.length === 1 ? "" : "s"}
				</p>
			</CardHeader>
			<CardContent className="p-0">
				<div className="divide-y divide-border">
					{displayJobs.map((job) => {
						const sourceLabel =
							SOURCE_LABELS[job.source as DataSourceType] ?? job.source;

						return (
							<div key={job.id} className="px-6 py-3 space-y-2">
								{/* Header row */}
								<div className="flex items-center justify-between gap-3">
									<div className="flex items-center gap-2 min-w-0">
										<StatusIcon status={job.status} />
										<span className="text-sm font-medium truncate">
											{sourceLabel}
										</span>
									</div>
									<StatusBadge status={job.status} />
								</div>

								{/* Details row */}
								<div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
									<div className="flex items-center gap-3">
										<span>{formatRelativeTime(job.createdAt)}</span>
										{job.status !== "PENDING" && (
											<span>
												Duration:{" "}
												{formatDuration(job.startedAt, job.completedAt)}
											</span>
										)}
										{job.status === "SUCCESS" && job.rowsInserted !== null && (
											<span className="text-green-600 dark:text-green-400 font-medium">
												{job.rowsInserted} row
												{job.rowsInserted === 1 ? "" : "s"}
											</span>
										)}
									</div>
									{job.retryCount > 0 && (
										<span className="text-amber-600 dark:text-amber-400">
											Retry #{job.retryCount}
										</span>
									)}
								</div>

								{/* Error message */}
								{job.error && (
									<div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5 border border-destructive/20">
										<span className="font-medium">Error:</span> {job.error}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
