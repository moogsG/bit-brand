import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients, monthlyReports } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import {
	ArrowLeft,
	FileText,
	TrendingUp,
	Globe,
	Link2,
	Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getReportAutoData } from "@/lib/reports/auto-data";
import { ReportTrafficChart } from "@/components/portal/report-traffic-chart";
import { ReportExportButtons } from "@/components/portal/export-buttons";

const MONTH_NAMES = [
	"",
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

interface ReportSections {
	executiveSummary?: { adminNotes?: string };
	wins?: { adminNotes?: string };
	opportunities?: { adminNotes?: string };
	nextMonthGoals?: { adminNotes?: string };
}

export default async function ReportDetailPage({
	params,
}: {
	params: Promise<{ clientSlug: string; reportId: string }>;
}) {
	const session = await auth();
	if (!session) redirect("/login");

	const { clientSlug, reportId } = await params;

	const client = await db
		.select()
		.from(clients)
		.where(and(eq(clients.slug, clientSlug), eq(clients.isActive, true)))
		.get();

	if (!client) notFound();

	const report = await db
		.select()
		.from(monthlyReports)
		.where(
			and(
				eq(monthlyReports.id, reportId),
				eq(monthlyReports.clientId, client.id),
			),
		)
		.get();

	if (!report) notFound();

	if (session.user.role !== "ADMIN" && report.status !== "PUBLISHED") {
		notFound();
	}

	let sections: ReportSections = {};
	try {
		const parsed = JSON.parse(report.sections) as unknown;
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			sections = parsed as ReportSections;
		}
	} catch {
		sections = {};
	}

	// Auto-pull metrics data for this month/year
	const autoData = await getReportAutoData(
		client.id,
		report.month,
		report.year,
	);

	const monthLabel = `${MONTH_NAMES[report.month]} ${report.year}`;
	const hasGa4 =
		autoData.ga4.totalSessions > 0 || autoData.ga4.dailyData.length > 0;
	const hasGsc =
		autoData.gsc.totalClicks > 0 || autoData.gsc.totalImpressions > 0;
	const hasMoz = autoData.moz.domainAuthority !== null;
	const hasAiVis = autoData.aiVisibility !== null;

	return (
		<div className="max-w-4xl space-y-8">
			{/* Back */}
			<Link
				href={`/portal/${clientSlug}/reports`}
				className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
			>
				<ArrowLeft className="h-3.5 w-3.5" />
				All Reports
			</Link>

			{/* Header */}
			<div className="flex items-start justify-between gap-4 flex-wrap">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<FileText className="h-5 w-5 text-primary" />
						<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
							Monthly Report
						</p>
					</div>
					<h1 className="text-3xl font-bold tracking-tight">{monthLabel}</h1>
					{report.publishedAt && (
						<p className="text-sm text-muted-foreground">
							Published{" "}
							{new Date(report.publishedAt).toLocaleDateString("en-AU", {
								day: "numeric",
								month: "long",
								year: "numeric",
							})}
						</p>
					)}
				</div>
				<ReportExportButtons
					reportId={report.id}
					clientId={client.id}
					clientName={client.name}
					reportTitle={report.title}
					reportData={{
						clientName: client.name,
						month: monthLabel,
						executiveSummary: sections.executiveSummary?.adminNotes,
						trafficOverview: {
							sessions: autoData.ga4.totalSessions,
							users: autoData.ga4.totalUsers,
							pageviews: autoData.ga4.totalPageviews,
							organicSessions: autoData.ga4.totalOrganicSessions,
						},
						searchPerformance: {
							totalClicks: autoData.gsc.totalClicks,
							totalImpressions: autoData.gsc.totalImpressions,
							avgPosition: autoData.gsc.avgPosition,
						},
						topKeywords: autoData.gsc.topQueries,
						backlinkProfile: {
							domainRating: autoData.moz.domainAuthority,
							backlinks: autoData.moz.backlinks,
							referringDomains: autoData.moz.referringDomains,
							organicKeywords: autoData.moz.organicKeywords,
						},
						aiVisibilityScore: autoData.aiVisibility?.overallScore ?? null,
						wins: sections.wins?.adminNotes,
						opportunities: sections.opportunities?.adminNotes,
						nextMonthGoals: sections.nextMonthGoals?.adminNotes,
					}}
				/>
			</div>

			{/* Section 1: Executive Summary */}
			{sections.executiveSummary?.adminNotes && (
				<Card>
					<CardHeader>
						<CardTitle>Executive Summary</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
							{sections.executiveSummary.adminNotes}
						</p>
					</CardContent>
				</Card>
			)}

			{/* Section 2: Traffic Overview */}
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<TrendingUp className="h-4 w-4 text-muted-foreground" />
						<CardTitle>Traffic Overview</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{hasGa4 ? (
						<>
							<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
								<div className="space-y-0.5">
									<p className="text-2xl font-bold">
										{autoData.ga4.totalSessions.toLocaleString()}
									</p>
									<p className="text-xs text-muted-foreground">Sessions</p>
								</div>
								<div className="space-y-0.5">
									<p className="text-2xl font-bold">
										{autoData.ga4.totalUsers.toLocaleString()}
									</p>
									<p className="text-xs text-muted-foreground">Users</p>
								</div>
								<div className="space-y-0.5">
									<p className="text-2xl font-bold">
										{autoData.ga4.totalPageviews.toLocaleString()}
									</p>
									<p className="text-xs text-muted-foreground">Pageviews</p>
								</div>
								<div className="space-y-0.5">
									<p className="text-2xl font-bold">
										{autoData.ga4.totalOrganicSessions.toLocaleString()}
									</p>
									<p className="text-xs text-muted-foreground">
										Organic Sessions
									</p>
								</div>
							</div>
							{autoData.ga4.dailyData.length > 0 && (
								<ReportTrafficChart
									data={autoData.ga4.dailyData.map((d) => ({
										date: d.date,
										value: d.organicSessions,
									}))}
									label="Organic Sessions"
									color="#6366f1"
								/>
							)}
						</>
					) : (
						<p className="text-sm text-muted-foreground">
							No traffic data available for {monthLabel}.
						</p>
					)}
				</CardContent>
			</Card>

			{/* Section 3: Search Performance */}
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<Globe className="h-4 w-4 text-muted-foreground" />
						<CardTitle>Search Performance</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{hasGsc ? (
						<>
							<div className="grid grid-cols-3 gap-4">
								<div className="space-y-0.5">
									<p className="text-2xl font-bold">
										{autoData.gsc.totalClicks.toLocaleString()}
									</p>
									<p className="text-xs text-muted-foreground">Total Clicks</p>
								</div>
								<div className="space-y-0.5">
									<p className="text-2xl font-bold">
										{autoData.gsc.totalImpressions.toLocaleString()}
									</p>
									<p className="text-xs text-muted-foreground">Impressions</p>
								</div>
								<div className="space-y-0.5">
									<p className="text-2xl font-bold">
										{autoData.gsc.avgPosition.toFixed(1)}
									</p>
									<p className="text-xs text-muted-foreground">Avg. Position</p>
								</div>
							</div>
						</>
					) : (
						<p className="text-sm text-muted-foreground">
							No search data available for {monthLabel}.
						</p>
					)}
				</CardContent>
			</Card>

			{/* Section 4: Top Keywords */}
			{hasGsc && autoData.gsc.topQueries.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Top Keywords</CardTitle>
					</CardHeader>
					<CardContent className="p-0">
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-border bg-muted/40">
										<th className="h-9 px-4 text-left align-middle font-medium text-muted-foreground">
											Query
										</th>
										<th className="h-9 px-4 text-right align-middle font-medium text-muted-foreground">
											Clicks
										</th>
										<th className="h-9 px-4 text-right align-middle font-medium text-muted-foreground">
											Impressions
										</th>
										<th className="h-9 px-4 text-right align-middle font-medium text-muted-foreground">
											CTR
										</th>
										<th className="h-9 px-4 text-right align-middle font-medium text-muted-foreground">
											Position
										</th>
									</tr>
								</thead>
								<tbody>
									{autoData.gsc.topQueries.map((q) => (
										<tr
											key={q.query}
											className="border-b border-border last:border-0 hover:bg-muted/20"
										>
											<td className="px-4 py-2.5 font-medium max-w-xs truncate">
												{q.query}
											</td>
											<td className="px-4 py-2.5 text-right">
												{q.clicks.toLocaleString()}
											</td>
											<td className="px-4 py-2.5 text-right">
												{q.impressions.toLocaleString()}
											</td>
											<td className="px-4 py-2.5 text-right">
												{(q.ctr * 100).toFixed(1)}%
											</td>
											<td className="px-4 py-2.5 text-right">
												{q.position.toFixed(1)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Section 5: Backlink Profile */}
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<Link2 className="h-4 w-4 text-muted-foreground" />
						<CardTitle>Backlink Profile</CardTitle>
					</div>
				</CardHeader>
				<CardContent>
					{hasMoz ? (
						<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
							<div className="space-y-0.5">
								<p className="text-2xl font-bold">
									{autoData.moz.domainAuthority !== null
										? Math.round(autoData.moz.domainAuthority)
										: "—"}
								</p>
								<p className="text-xs text-muted-foreground">
									Domain Authority
								</p>
							</div>
							<div className="space-y-0.5">
								<p className="text-2xl font-bold">
									{autoData.moz.backlinks.toLocaleString()}
								</p>
								<p className="text-xs text-muted-foreground">Backlinks</p>
							</div>
							<div className="space-y-0.5">
								<p className="text-2xl font-bold">
									{autoData.moz.referringDomains.toLocaleString()}
								</p>
								<p className="text-xs text-muted-foreground">
									Referring Domains
								</p>
							</div>
							<div className="space-y-0.5">
								<p className="text-2xl font-bold">
									{autoData.moz.organicKeywords.toLocaleString()}
								</p>
								<p className="text-xs text-muted-foreground">
									Organic Keywords
								</p>
							</div>
						</div>
					) : (
						<p className="text-sm text-muted-foreground">
							No backlink data available for {monthLabel}.
						</p>
					)}
				</CardContent>
			</Card>

			{/* Section 6: AI Search Visibility */}
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<Sparkles className="h-4 w-4 text-muted-foreground" />
						<CardTitle>AI Search Visibility</CardTitle>
					</div>
				</CardHeader>
				<CardContent>
					{hasAiVis && autoData.aiVisibility ? (
						<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
							<div className="space-y-0.5">
								<p className="text-3xl font-bold text-primary">
									{autoData.aiVisibility.overallScore !== null
										? Math.round(autoData.aiVisibility.overallScore)
										: "—"}
								</p>
								<p className="text-xs text-muted-foreground">
									Overall AI Score
								</p>
							</div>
							<div className="space-y-0.5">
								<p className="text-2xl font-bold">
									{autoData.aiVisibility.rankscaleScore !== null
										? Math.round(autoData.aiVisibility.rankscaleScore)
										: "—"}
								</p>
								<p className="text-xs text-muted-foreground">Rankscale Score</p>
							</div>
							<div className="space-y-0.5">
								<p className="text-2xl font-bold">
									{autoData.aiVisibility.promptsVisible} /{" "}
									{autoData.aiVisibility.totalPromptsTested}
								</p>
								<p className="text-xs text-muted-foreground">Prompts Visible</p>
							</div>
						</div>
					) : (
						<p className="text-sm text-muted-foreground">
							No AI visibility data available for {monthLabel}.
						</p>
					)}
				</CardContent>
			</Card>

			{/* Section 7: Wins */}
			{sections.wins?.adminNotes && (
				<Card>
					<CardHeader>
						<CardTitle>Wins This Month</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
							{sections.wins.adminNotes}
						</p>
					</CardContent>
				</Card>
			)}

			{/* Section 8: Opportunities */}
			{sections.opportunities?.adminNotes && (
				<Card>
					<CardHeader>
						<CardTitle>Opportunities</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
							{sections.opportunities.adminNotes}
						</p>
					</CardContent>
				</Card>
			)}

			{/* Section 9: Next Month Goals */}
			{sections.nextMonthGoals?.adminNotes && (
				<Card>
					<CardHeader>
						<CardTitle>Next Month Goals</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
							{sections.nextMonthGoals.adminNotes}
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
