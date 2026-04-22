import { db } from "@/lib/db";
import {
	ga4Metrics,
	gscMetrics,
	mozMetrics,
	aiVisibility,
} from "@/lib/db/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

function monthStart(year: number, month: number): string {
	const d = new Date(year, month - 1, 1);
	return d.toISOString().split("T")[0];
}

function monthEnd(year: number, month: number): string {
	const d = new Date(year, month, 0); // last day of month
	return d.toISOString().split("T")[0];
}

export interface DailyGa4 {
	date: string;
	sessions: number;
	users: number;
	pageviews: number;
	organicSessions: number;
}

export interface TopQuery {
	query: string;
	clicks: number;
	impressions: number;
	ctr: number;
	position: number;
}

export interface ReportAutoData {
	ga4: {
		totalSessions: number;
		totalUsers: number;
		totalPageviews: number;
		totalOrganicSessions: number;
		dailyData: DailyGa4[];
	};
	gsc: {
		totalClicks: number;
		totalImpressions: number;
		avgPosition: number;
		topQueries: TopQuery[];
		dailyData: { date: string; clicks: number; impressions: number }[];
	};
	moz: {
		domainAuthority: number | null;
		pageAuthority: number | null;
		spamScore: number | null;
		backlinks: number;
		referringDomains: number;
		organicKeywords: number;
	};
	aiVisibility: {
		overallScore: number | null;
		rankscaleScore: number | null;
		secondaryScore: number | null;
		totalPromptsTested: number;
		promptsVisible: number;
	} | null;
}

export async function getReportAutoData(
	clientId: string,
	month: number,
	year: number,
): Promise<ReportAutoData> {
	const startDate = monthStart(year, month);
	const endDate = monthEnd(year, month);

	const [ga4Rows, gscDailyRows, gscQueryRows, mozRow, aiVisRow] =
		await Promise.all([
			// GA4 daily data
			db
				.select()
				.from(ga4Metrics)
				.where(
					and(
						eq(ga4Metrics.clientId, clientId),
						gte(ga4Metrics.date, startDate),
						lte(ga4Metrics.date, endDate),
					),
				)
				.orderBy(ga4Metrics.date)
				.all(),

			// GSC aggregated per day
			db
				.select({
					date: gscMetrics.date,
					clicks: sql<number>`sum(${gscMetrics.clicks})`.as("clicks"),
					impressions: sql<number>`sum(${gscMetrics.impressions})`.as(
						"impressions",
					),
					avgPosition: sql<number>`avg(${gscMetrics.position})`.as(
						"avgPosition",
					),
				})
				.from(gscMetrics)
				.where(
					and(
						eq(gscMetrics.clientId, clientId),
						gte(gscMetrics.date, startDate),
						lte(gscMetrics.date, endDate),
					),
				)
				.groupBy(gscMetrics.date)
				.orderBy(gscMetrics.date)
				.all(),

			// GSC top queries
			db
				.select({
					query: gscMetrics.query,
					clicks: sql<number>`sum(${gscMetrics.clicks})`.as("clicks"),
					impressions: sql<number>`sum(${gscMetrics.impressions})`.as(
						"impressions",
					),
					avgCtr: sql<number>`avg(${gscMetrics.ctr})`.as("avgCtr"),
					avgPosition: sql<number>`avg(${gscMetrics.position})`.as(
						"avgPosition",
					),
				})
				.from(gscMetrics)
				.where(
					and(
						eq(gscMetrics.clientId, clientId),
						gte(gscMetrics.date, startDate),
						lte(gscMetrics.date, endDate),
					),
				)
				.groupBy(gscMetrics.query)
				.orderBy(desc(sql`sum(${gscMetrics.clicks})`))
				.limit(10)
				.all(),

			// Moz — latest record in this month (or most recent before)
			db
				.select()
				.from(mozMetrics)
				.where(
					and(eq(mozMetrics.clientId, clientId), lte(mozMetrics.date, endDate)),
				)
				.orderBy(desc(mozMetrics.date))
				.limit(1)
				.get(),

			// AI Visibility — latest record in this month
			db
				.select()
				.from(aiVisibility)
				.where(
					and(
						eq(aiVisibility.clientId, clientId),
						gte(aiVisibility.date, startDate),
						lte(aiVisibility.date, endDate),
					),
				)
				.orderBy(desc(aiVisibility.date))
				.limit(1)
				.get(),
		]);

	// Aggregate GA4
	const totalSessions = ga4Rows.reduce((s, r) => s + r.sessions, 0);
	const totalUsers = ga4Rows.reduce((s, r) => s + r.users, 0);
	const totalPageviews = ga4Rows.reduce((s, r) => s + r.pageviews, 0);
	const totalOrganicSessions = ga4Rows.reduce(
		(s, r) => s + (r.organicSessions ?? 0),
		0,
	);

	// Aggregate GSC
	const totalClicks = gscDailyRows.reduce((s, r) => s + r.clicks, 0);
	const totalImpressions = gscDailyRows.reduce((s, r) => s + r.impressions, 0);
	const avgPosition =
		gscDailyRows.length > 0
			? gscDailyRows.reduce((s, r) => s + r.avgPosition, 0) /
				gscDailyRows.length
			: 0;

	return {
		ga4: {
			totalSessions,
			totalUsers,
			totalPageviews,
			totalOrganicSessions,
			dailyData: ga4Rows.map((r) => ({
				date: r.date,
				sessions: r.sessions,
				users: r.users,
				pageviews: r.pageviews,
				organicSessions: r.organicSessions ?? 0,
			})),
		},
		gsc: {
			totalClicks,
			totalImpressions,
			avgPosition,
			topQueries: gscQueryRows.map((r) => ({
				query: r.query,
				clicks: r.clicks,
				impressions: r.impressions,
				ctr: r.avgCtr ?? 0,
				position: r.avgPosition ?? 0,
			})),
			dailyData: gscDailyRows.map((r) => ({
				date: r.date,
				clicks: r.clicks,
				impressions: r.impressions,
			})),
		},
		moz: {
			domainAuthority: mozRow?.domainAuthority ?? null,
			pageAuthority: mozRow?.pageAuthority ?? null,
			spamScore: mozRow?.spamScore ?? null,
			backlinks: mozRow?.backlinks ?? 0,
			referringDomains: mozRow?.referringDomains ?? 0,
			organicKeywords: mozRow?.organicKeywords ?? 0,
		},
		aiVisibility: aiVisRow
			? {
					overallScore: aiVisRow.overallScore,
					rankscaleScore: aiVisRow.rankscaleScore,
					secondaryScore: aiVisRow.secondaryScore,
					totalPromptsTested: aiVisRow.totalPromptsTested ?? 0,
					promptsVisible: aiVisRow.promptsVisible ?? 0,
				}
			: null,
	};
}
