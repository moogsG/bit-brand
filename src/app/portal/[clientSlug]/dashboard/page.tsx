import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
	clients,
	ga4Metrics,
	gscMetrics,
	mozMetrics,
	aiVisibility,
} from "@/lib/db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import {
	BarChart2,
	MousePointerClick,
	TrendingDown,
	Shield,
} from "lucide-react";
import { KpiCard } from "@/components/portal/kpi-card";
import { TrafficChart } from "@/components/portal/traffic-chart";
import { SearchPerformanceChart } from "@/components/portal/search-performance-chart";
import { TopKeywordsTable } from "@/components/portal/top-keywords-table";
import { AiVisibilityCard } from "@/components/portal/ai-visibility-card";

function toDateStr(date: Date): string {
	return date.toISOString().split("T")[0];
}

function pctChange(current: number, previous: number): number | undefined {
	if (previous === 0) return undefined;
	return ((current - previous) / previous) * 100;
}

function sumField<T>(rows: T[], field: keyof T): number {
	return rows.reduce((acc, row) => {
		const val = row[field];
		return acc + (typeof val === "number" ? val : 0);
	}, 0);
}

function avgField<T>(rows: T[], field: keyof T): number {
	if (rows.length === 0) return 0;
	return sumField(rows, field) / rows.length;
}

export default async function DashboardPage({
	params,
}: {
	params: Promise<{ clientSlug: string }>;
}) {
	const session = await auth();
	if (!session) redirect("/login");

	const { clientSlug } = await params;

	// Client lookup (layout already verified existence, but we need the ID)
	const client = await db
		.select()
		.from(clients)
		.where(eq(clients.slug, clientSlug))
		.get();

	if (!client) redirect("/portal");

	// ─── Date ranges ─────────────────────────────────────────────────────────
	const now = new Date();
	const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
	const d60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
	const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

	const str30 = toDateStr(d30);
	const str60 = toDateStr(d60);
	const str90 = toDateStr(d90);
	const strNow = toDateStr(now);

	// ─── GA4: last 30 days + previous 30 days ────────────────────────────────
	const [ga4Current, ga4Previous, ga4Trend] = await Promise.all([
		db
			.select()
			.from(ga4Metrics)
			.where(
				and(
					eq(ga4Metrics.clientId, client.id),
					gte(ga4Metrics.date, str30),
					lte(ga4Metrics.date, strNow),
				),
			)
			.all(),

		db
			.select()
			.from(ga4Metrics)
			.where(
				and(
					eq(ga4Metrics.clientId, client.id),
					gte(ga4Metrics.date, str60),
					lte(ga4Metrics.date, str30),
				),
			)
			.all(),

		// 90 day trend
		db
			.select()
			.from(ga4Metrics)
			.where(
				and(eq(ga4Metrics.clientId, client.id), gte(ga4Metrics.date, str90)),
			)
			.orderBy(ga4Metrics.date)
			.all(),
	]);

	// ─── GSC: last 30 days (aggregated per date) + previous + trend ──────────
	const [gscCurrent, gscPrevious, gscTrend] = await Promise.all([
		db
			.select({
				date: gscMetrics.date,
				clicks: sql<number>`sum(${gscMetrics.clicks})`.as("clicks"),
				impressions: sql<number>`sum(${gscMetrics.impressions})`.as(
					"impressions",
				),
				avgCtr: sql<number>`avg(${gscMetrics.ctr})`.as("avgCtr"),
				avgPosition: sql<number>`avg(${gscMetrics.position})`.as("avgPosition"),
			})
			.from(gscMetrics)
			.where(
				and(
					eq(gscMetrics.clientId, client.id),
					gte(gscMetrics.date, str30),
					lte(gscMetrics.date, strNow),
				),
			)
			.groupBy(gscMetrics.date)
			.all(),

		db
			.select({
				date: gscMetrics.date,
				clicks: sql<number>`sum(${gscMetrics.clicks})`.as("clicks"),
				impressions: sql<number>`sum(${gscMetrics.impressions})`.as(
					"impressions",
				),
				avgCtr: sql<number>`avg(${gscMetrics.ctr})`.as("avgCtr"),
				avgPosition: sql<number>`avg(${gscMetrics.position})`.as("avgPosition"),
			})
			.from(gscMetrics)
			.where(
				and(
					eq(gscMetrics.clientId, client.id),
					gte(gscMetrics.date, str60),
					lte(gscMetrics.date, str30),
				),
			)
			.groupBy(gscMetrics.date)
			.all(),

		// 90-day trend (aggregated per day)
		db
			.select({
				date: gscMetrics.date,
				clicks: sql<number>`sum(${gscMetrics.clicks})`.as("clicks"),
				impressions: sql<number>`sum(${gscMetrics.impressions})`.as(
					"impressions",
				),
			})
			.from(gscMetrics)
			.where(
				and(eq(gscMetrics.clientId, client.id), gte(gscMetrics.date, str90)),
			)
			.groupBy(gscMetrics.date)
			.orderBy(gscMetrics.date)
			.all(),
	]);

	// ─── GSC: Top keywords last 30 days ──────────────────────────────────────
	const topKeywordsRaw = await db
		.select({
			query: gscMetrics.query,
			clicks: sql<number>`sum(${gscMetrics.clicks})`.as("clicks"),
			impressions: sql<number>`sum(${gscMetrics.impressions})`.as(
				"impressions",
			),
			avgCtr: sql<number>`avg(${gscMetrics.ctr})`.as("avgCtr"),
			avgPosition: sql<number>`avg(${gscMetrics.position})`.as("avgPosition"),
		})
		.from(gscMetrics)
		.where(and(eq(gscMetrics.clientId, client.id), gte(gscMetrics.date, str30)))
		.groupBy(gscMetrics.query)
		.orderBy(desc(sql`sum(${gscMetrics.clicks})`))
		.limit(10)
		.all();

	// ─── Moz: latest record ───────────────────────────────────────────────────
	const mozLatest = await db
		.select()
		.from(mozMetrics)
		.where(eq(mozMetrics.clientId, client.id))
		.orderBy(desc(mozMetrics.date))
		.limit(1)
		.get();

	// ─── AI Visibility: latest record ────────────────────────────────────────
	const aiVis = await db
		.select()
		.from(aiVisibility)
		.where(eq(aiVisibility.clientId, client.id))
		.orderBy(desc(aiVisibility.date))
		.limit(1)
		.get();

	// ─── KPI calculations ─────────────────────────────────────────────────────
	const organicSessionsCurrent = sumField(ga4Current, "organicSessions");
	const organicSessionsPrevious = sumField(ga4Previous, "organicSessions");
	const organicChange = pctChange(
		organicSessionsCurrent,
		organicSessionsPrevious,
	);

	const clicksCurrent = gscCurrent.reduce((a, r) => a + r.clicks, 0);
	const clicksPrevious = gscPrevious.reduce((a, r) => a + r.clicks, 0);
	const clicksChange = pctChange(clicksCurrent, clicksPrevious);

	const avgPosCurrent =
		gscCurrent.length > 0
			? gscCurrent.reduce((a, r) => a + r.avgPosition, 0) / gscCurrent.length
			: null;
	const avgPosPrevious =
		gscPrevious.length > 0
			? gscPrevious.reduce((a, r) => a + r.avgPosition, 0) / gscPrevious.length
			: null;
	const posChange =
		avgPosCurrent !== null && avgPosPrevious !== null
			? pctChange(avgPosCurrent, avgPosPrevious)
			: undefined;

	// ─── Chart data ───────────────────────────────────────────────────────────
	const trafficTrendData = ga4Trend.map((row) => ({
		date: row.date,
		value: row.organicSessions ?? 0,
	}));

	const searchPerfData = gscTrend.map((row) => ({
		date: row.date,
		clicks: row.clicks,
		impressions: row.impressions,
	}));

	const topKeywords = topKeywordsRaw.map((row) => ({
		query: row.query,
		clicks: row.clicks,
		impressions: row.impressions,
		ctr: row.avgCtr,
		position: row.avgPosition,
	}));

	// ─── No-data flags ────────────────────────────────────────────────────────
	const noGa4 = ga4Current.length === 0 && ga4Trend.length === 0;
	const noGsc = gscCurrent.length === 0 && gscTrend.length === 0;
	const noMoz = !mozLatest;
	const noAiVis = !aiVis;

	return (
		<div className="space-y-6 max-w-7xl">
			{/* ── KPI Cards ─────────────────────────────────────────────────────── */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<KpiCard
					title="Organic Sessions"
					value={noGa4 ? "—" : organicSessionsCurrent.toLocaleString()}
					change={noGa4 ? undefined : organicChange}
					changeLabel="vs last 30 days"
					icon={<BarChart2 className="h-4 w-4" />}
					noData={noGa4}
				/>

				<KpiCard
					title="Total Clicks"
					value={noGsc ? "—" : clicksCurrent.toLocaleString()}
					change={noGsc ? undefined : clicksChange}
					changeLabel="vs last 30 days"
					icon={<MousePointerClick className="h-4 w-4" />}
					noData={noGsc}
				/>

				<KpiCard
					title="Average Position"
					value={avgPosCurrent !== null ? avgPosCurrent.toFixed(1) : "—"}
					change={noGsc ? undefined : posChange}
					changeLabel="vs last 30 days"
					icon={<TrendingDown className="h-4 w-4" />}
					noData={noGsc}
					lowerIsBetter
				/>

				<KpiCard
					title="Domain Authority"
					value={
						noMoz || mozLatest.domainAuthority === null
							? "—"
							: Math.round(mozLatest.domainAuthority).toString()
					}
					icon={<Shield className="h-4 w-4" />}
					noData={noMoz}
				/>
			</div>

			{/* ── Charts ────────────────────────────────────────────────────────── */}
			<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
				<TrafficChart
					data={trafficTrendData}
					title="Organic Traffic Trend (90 days)"
					color="#6366f1"
				/>
				<SearchPerformanceChart data={searchPerfData} />
			</div>

			{/* ── Bottom row ────────────────────────────────────────────────────── */}
			<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
				<TopKeywordsTable keywords={topKeywords} />

				<AiVisibilityCard
					overallScore={aiVis?.overallScore ?? null}
					rankscaleScore={aiVis?.rankscaleScore ?? null}
					secondaryScore={aiVis?.secondaryScore ?? null}
					totalPromptsTested={aiVis?.totalPromptsTested ?? 0}
					promptsVisible={aiVis?.promptsVisible ?? 0}
					noData={noAiVis}
				/>
			</div>
		</div>
	);
}
