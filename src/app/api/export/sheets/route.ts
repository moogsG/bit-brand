import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
	clients,
	keywordResearch,
	monthlyReports,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getReportAutoData } from "@/lib/reports/auto-data";
import { z } from "zod";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";

const sheetsSchema = z.object({
	type: z.enum(["keywords", "report"]),
	clientId: z.string().min(1),
	reportId: z.string().optional(),
	accessToken: z.string().min(1),
});

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

// POST /api/export/sheets
export async function POST(req: NextRequest) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const parsed = sheetsSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.message }, { status: 400 });
	}

	const { type, clientId, reportId, accessToken } = parsed.data;

	// Verify client exists and access control
	const client = await db
		.select()
		.from(clients)
		.where(eq(clients.id, clientId))
		.get();

	if (!client) {
		return NextResponse.json({ error: "Client not found" }, { status: 404 });
	}

	const accessContext = await getClientAccessContext(session, clientId);

	if (!can("export", "execute", { session, clientId, ...accessContext })) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		let spreadsheetTitle = "";
		let sheetsData: { sheetTitle: string; values: string[][] }[] = [];

		if (type === "keywords") {
			const keywords = await db
				.select()
				.from(keywordResearch)
				.where(eq(keywordResearch.clientId, clientId))
				.orderBy(keywordResearch.keyword)
				.all();

			spreadsheetTitle = `BBA Keywords — ${client.name} — ${new Date().toLocaleDateString("en-AU")}`;

			const header = [
				"Keyword",
				"Monthly Volume",
				"Difficulty",
				"Intent",
				"Priority",
				"Cur. Position",
				"Target Position",
				"Status",
				"Notes",
			];
			const rows = keywords.map((kw) => [
				kw.keyword,
				kw.monthlyVolume !== null ? String(kw.monthlyVolume) : "",
				kw.difficulty !== null ? String(kw.difficulty) : "",
				kw.intent ?? "",
				kw.priority ?? "",
				kw.currentPosition !== null ? String(kw.currentPosition) : "",
				kw.targetPosition !== null ? String(kw.targetPosition) : "",
				kw.status ?? "",
				kw.notes ?? "",
			]);

			sheetsData = [{ sheetTitle: "Keywords", values: [header, ...rows] }];
		} else if (type === "report" && reportId) {
			const report = await db
				.select()
				.from(monthlyReports)
				.where(
					and(
						eq(monthlyReports.id, reportId),
						eq(monthlyReports.clientId, clientId),
					),
				)
				.get();

			if (!report) {
				return NextResponse.json(
					{ error: "Report not found" },
					{ status: 404 },
				);
			}

			const autoData = await getReportAutoData(
				clientId,
				report.month,
				report.year,
			);
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
			const monthLabel = `${MONTH_NAMES[report.month]} ${report.year}`;

			spreadsheetTitle = `BBA Report — ${client.name} — ${monthLabel}`;

			const trafficSheet: string[][] = [
				["Metric", "Value"],
				["Sessions", String(autoData.ga4.totalSessions)],
				["Users", String(autoData.ga4.totalUsers)],
				["Pageviews", String(autoData.ga4.totalPageviews)],
				["Organic Sessions", String(autoData.ga4.totalOrganicSessions)],
				[],
				["GSC Clicks", String(autoData.gsc.totalClicks)],
				["GSC Impressions", String(autoData.gsc.totalImpressions)],
				["Avg. Position", String(autoData.gsc.avgPosition.toFixed(1))],
				[],
				[
					"Domain Authority",
					autoData.moz.domainAuthority !== null
						? String(autoData.moz.domainAuthority)
						: "",
				],
				["Backlinks", String(autoData.moz.backlinks)],
				["Referring Domains", String(autoData.moz.referringDomains)],
				["Organic Keywords", String(autoData.moz.organicKeywords)],
			];

			const topQueriesSheet: string[][] = [
				["Query", "Clicks", "Impressions", "CTR", "Position"],
				...autoData.gsc.topQueries.map((q) => [
					q.query,
					String(q.clicks),
					String(q.impressions),
					`${(q.ctr * 100).toFixed(1)}%`,
					q.position.toFixed(1),
				]),
			];

			sheetsData = [
				{ sheetTitle: "Overview", values: trafficSheet },
				{ sheetTitle: "Top Queries", values: topQueriesSheet },
			];
		} else {
			return NextResponse.json(
				{ error: "Invalid export parameters" },
				{ status: 400 },
			);
		}

		// 1. Create spreadsheet
		const createRes = await fetch(SHEETS_BASE, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				properties: { title: spreadsheetTitle },
				sheets: sheetsData.map((s, i) => ({
					properties: { sheetId: i, title: s.sheetTitle, index: i },
				})),
			}),
		});

		if (!createRes.ok) {
			const errText = await createRes.text();
			return NextResponse.json(
				{ error: `Google Sheets API error: ${createRes.status} — ${errText}` },
				{ status: 502 },
			);
		}

		const spreadsheet = (await createRes.json()) as {
			spreadsheetId: string;
			spreadsheetUrl: string;
		};
		const spreadsheetId = spreadsheet.spreadsheetId;

		// 2. Populate data using batchUpdate values
		const dataRes = await fetch(
			`${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					valueInputOption: "USER_ENTERED",
					data: sheetsData.map((s) => ({
						range: `${s.sheetTitle}!A1`,
						values: s.values,
					})),
				}),
			},
		);

		if (!dataRes.ok) {
			const errText = await dataRes.text();
			return NextResponse.json(
				{
					error: `Failed to populate spreadsheet: ${dataRes.status} — ${errText}`,
				},
				{ status: 502 },
			);
		}

		return NextResponse.json({
			spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Export failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
