import { and, desc, eq } from "drizzle-orm";
import { AlertTriangle, ShieldCheck, Wrench } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { TechnicalRunsSparkline } from "@/components/shared/technical-runs-sparkline";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients, technicalAuditRuns, technicalIssues } from "@/lib/db/schema";

function formatDateTime(value: Date | number | null): string {
	if (!value) {
		return "—";
	}

	const parsed = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return "—";
	}

	return parsed.toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

const severityOrder: Record<"CRITICAL" | "WARNING" | "INFO", number> = {
	CRITICAL: 0,
	WARNING: 1,
	INFO: 2,
};

const statusVariant = {
	RUNNING: "secondary",
	SUCCESS: "default",
	PARTIAL: "outline",
	FAILED: "destructive",
} as const;

export default async function PortalTechnicalPage({
	params,
}: {
	params: Promise<{ clientSlug: string }>;
}) {
	const session = await auth();
	if (!session) {
		redirect("/login");
	}

	const { clientSlug } = await params;

	const client = await db
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.slug, clientSlug), eq(clients.isActive, true)))
		.get();

	if (!client) {
		notFound();
	}

	const recentRuns = await db
		.select({
			id: technicalAuditRuns.id,
			status: technicalAuditRuns.status,
			issuesFound: technicalAuditRuns.issuesFound,
			pagesCrawled: technicalAuditRuns.pagesCrawled,
			startedAt: technicalAuditRuns.startedAt,
			completedAt: technicalAuditRuns.completedAt,
			error: technicalAuditRuns.error,
		})
		.from(technicalAuditRuns)
		.where(eq(technicalAuditRuns.clientId, client.id))
		.orderBy(desc(technicalAuditRuns.startedAt))
		.limit(5)
		.all();

	const latestRun = recentRuns[0] ?? null;

	const issues = latestRun
		? await db
				.select({
					id: technicalIssues.id,
					url: technicalIssues.url,
					issueType: technicalIssues.issueType,
					severity: technicalIssues.severity,
					message: technicalIssues.message,
					createdAt: technicalIssues.createdAt,
				})
				.from(technicalIssues)
				.where(
					and(
						eq(technicalIssues.clientId, client.id),
						eq(technicalIssues.runId, latestRun.id),
					),
				)
				.orderBy(desc(technicalIssues.createdAt))
				.limit(50)
				.all()
		: [];

	const topIssues = issues
		.slice()
		.sort((a, b) => {
			const severityCompare =
				severityOrder[a.severity] - severityOrder[b.severity];
			if (severityCompare !== 0) {
				return severityCompare;
			}
			const aTime =
				a.createdAt instanceof Date ? a.createdAt.getTime() : a.createdAt;
			const bTime =
				b.createdAt instanceof Date ? b.createdAt.getTime() : b.createdAt;
			return bTime - aTime;
		})
		.slice(0, 10);

	return (
		<div className="max-w-6xl space-y-6">
			<div className="flex items-center gap-2">
				<Wrench className="h-5 w-5 text-muted-foreground" />
				<div>
					<h2 className="text-2xl font-bold tracking-tight">
						Technical Highlights
					</h2>
					<p className="mt-0.5 text-sm text-muted-foreground">
						Latest technical audit health and top issues detected on your site.
					</p>
				</div>
			</div>

			{!latestRun ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center space-y-3 py-16 text-center">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
							<ShieldCheck className="h-6 w-6 text-muted-foreground" />
						</div>
						<p className="text-base font-medium">No technical audits yet</p>
						<p className="max-w-sm text-sm text-muted-foreground">
							Your account team will publish technical audit highlights after
							the first run.
						</p>
					</CardContent>
				</Card>
			) : (
				<>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm">Latest status</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								<Badge variant={statusVariant[latestRun.status]}>
									{latestRun.status}
								</Badge>
								<TechnicalRunsSparkline
									runs={recentRuns.map((run) => ({
										issuesFound: run.issuesFound,
										status: run.status,
									}))}
								/>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm">Issues found</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-2xl font-semibold">
									{latestRun.issuesFound}
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm">Pages crawled</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-2xl font-semibold">
									{latestRun.pagesCrawled}
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm">Completed</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-xs text-muted-foreground">
									{formatDateTime(latestRun.completedAt ?? latestRun.startedAt)}
								</p>
							</CardContent>
						</Card>
					</div>

					{latestRun.error ? (
						<Card>
							<CardContent className="flex items-start gap-2 py-4 text-sm text-destructive">
								<AlertTriangle className="mt-0.5 h-4 w-4" />
								<span>{latestRun.error}</span>
							</CardContent>
						</Card>
					) : null}

					<Card>
						<CardHeader>
							<CardTitle className="text-base">
								Top Issues (Latest Audit)
							</CardTitle>
						</CardHeader>
						<CardContent className="p-0">
							{topIssues.length === 0 ? (
								<p className="px-6 py-10 text-sm text-muted-foreground">
									No issues captured in the latest audit.
								</p>
							) : (
								<div className="overflow-x-auto">
									<table className="w-full text-sm">
										<thead>
											<tr className="border-b bg-muted/40">
												<th className="h-10 px-4 text-left font-medium text-muted-foreground">
													Severity
												</th>
												<th className="h-10 px-4 text-left font-medium text-muted-foreground">
													Issue
												</th>
												<th className="h-10 px-4 text-left font-medium text-muted-foreground">
													URL
												</th>
											</tr>
										</thead>
										<tbody>
											{topIssues.map((issue) => (
												<tr
													key={issue.id}
													className="border-b transition-colors hover:bg-muted/20 last:border-0"
												>
													<td className="px-4 py-3 whitespace-nowrap">
														<Badge
															variant={
																issue.severity === "CRITICAL"
																	? "destructive"
																	: "secondary"
															}
														>
															{issue.severity}
														</Badge>
													</td>
													<td className="px-4 py-3">
														<p className="font-medium">{issue.issueType}</p>
														<p className="text-xs text-muted-foreground">
															{issue.message}
														</p>
													</td>
													<td className="max-w-[340px] truncate px-4 py-3 text-xs text-muted-foreground">
														{issue.url}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</CardContent>
					</Card>
				</>
			)}
		</div>
	);
}
