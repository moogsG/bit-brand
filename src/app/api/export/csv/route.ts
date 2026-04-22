import { and, eq, gte, lte } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import {
	clients,
	ga4Metrics,
	gscMetrics,
	keywordResearch,
} from "@/lib/db/schema";
import {
	implementationChangesToCSV,
	keywordsToCSV,
	metricsToCSV,
} from "@/lib/export/csv";
import { listClientSafeImplementationChanges } from "@/lib/implementation-agent";
import {
	applyImplementationChangeFilters,
	deriveImplementationChangeStatus,
	deriveImplementationChangeType,
	type ImplementationChangeStatus,
	type ImplementationChangeType,
	implementationChangeStatuses,
	implementationChangeTypes,
	sortImplementationChangesByUpdatedAt,
} from "@/lib/implementation-agent/client-safe";

const implementationChangesFilterSchema = z
	.object({
		status: z.enum(["all", ...implementationChangeStatuses]).optional(),
		changeType: z.enum(["all", ...implementationChangeTypes]).optional(),
		search: z.string().trim().max(200).optional(),
		from: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/)
			.optional(),
		to: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/)
			.optional(),
	})
	.superRefine((input, ctx) => {
		if (input.from && input.to && input.from > input.to) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "from must be less than or equal to to",
				path: ["from"],
			});
		}
	});

// GET /api/export/csv?type=keywords&clientId={id}
// GET /api/export/csv?type=gsc&clientId={id}&month={m}&year={y}
// GET /api/export/csv?type=ga4&clientId={id}&month={m}&year={y}
export async function GET(req: NextRequest) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = req.nextUrl;
	const type = searchParams.get("type");
	const clientId = searchParams.get("clientId");

	if (!clientId || !type) {
		return NextResponse.json(
			{ error: "Missing type or clientId" },
			{ status: 400 },
		);
	}

	// Verify client exists
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

	let csvContent = "";
	let filename = "export.csv";
	const today = new Date().toISOString().split("T")[0];

	if (type === "keywords") {
		const keywords = await db
			.select()
			.from(keywordResearch)
			.where(eq(keywordResearch.clientId, clientId))
			.orderBy(keywordResearch.keyword)
			.all();

		csvContent = keywordsToCSV(
			keywords.map((kw) => ({
				keyword: kw.keyword,
				monthlyVolume: kw.monthlyVolume,
				difficulty: kw.difficulty,
				intent: kw.intent,
				priority: kw.priority,
				currentPosition: kw.currentPosition,
				targetPosition: kw.targetPosition,
				targetUrl: kw.targetUrl,
				status: kw.status,
				notes: kw.notes,
			})),
		);
		filename = `keywords_${client.slug}_${today}.csv`;
	} else if (type === "ga4") {
		const monthParam = searchParams.get("month");
		const yearParam = searchParams.get("year");

		let whereClause = eq(ga4Metrics.clientId, clientId);

		if (monthParam && yearParam) {
			const monthNum = parseInt(monthParam, 10);
			const yearNum = parseInt(yearParam, 10);
			const start = `${yearNum}-${String(monthNum).padStart(2, "0")}-01`;
			const end = new Date(yearNum, monthNum, 0).toISOString().split("T")[0];
			whereClause = and(
				eq(ga4Metrics.clientId, clientId),
				gte(ga4Metrics.date, start),
				lte(ga4Metrics.date, end),
			) as typeof whereClause;
		}

		const rows = await db
			.select()
			.from(ga4Metrics)
			.where(whereClause)
			.orderBy(ga4Metrics.date)
			.all();

		csvContent = metricsToCSV(
			rows.map((r) => ({
				date: r.date,
				sessions: r.sessions,
				users: r.users,
				newUsers: r.newUsers,
				pageviews: r.pageviews,
				bounceRate: r.bounceRate,
				avgSessionDuration: r.avgSessionDuration,
				organicSessions: r.organicSessions,
			})),
		);
		filename = `ga4_${client.slug}_${today}.csv`;
	} else if (type === "gsc") {
		const monthParam = searchParams.get("month");
		const yearParam = searchParams.get("year");

		let whereClause = eq(gscMetrics.clientId, clientId);

		if (monthParam && yearParam) {
			const monthNum = parseInt(monthParam, 10);
			const yearNum = parseInt(yearParam, 10);
			const start = `${yearNum}-${String(monthNum).padStart(2, "0")}-01`;
			const end = new Date(yearNum, monthNum, 0).toISOString().split("T")[0];
			whereClause = and(
				eq(gscMetrics.clientId, clientId),
				gte(gscMetrics.date, start),
				lte(gscMetrics.date, end),
			) as typeof whereClause;
		}

		const rows = await db
			.select()
			.from(gscMetrics)
			.where(whereClause)
			.orderBy(gscMetrics.date)
			.all();

		csvContent = metricsToCSV(
			rows.map((r) => ({
				date: r.date,
				query: r.query,
				page: r.page,
				clicks: r.clicks,
				impressions: r.impressions,
				ctr: r.ctr,
				position: r.position,
			})),
		);
		filename = `gsc_${client.slug}_${today}.csv`;
	} else if (type === "implementation_changes") {
		const parsedFilters = implementationChangesFilterSchema.safeParse({
			status: searchParams.get("status") ?? undefined,
			changeType:
				searchParams.get("changeType") ??
				searchParams.get("typeFilter") ??
				undefined,
			search: searchParams.get("search") ?? undefined,
			from: searchParams.get("from") ?? undefined,
			to: searchParams.get("to") ?? undefined,
		});

		if (!parsedFilters.success) {
			return NextResponse.json(
				{
					error: "Invalid implementation change filters",
					details: parsedFilters.error.flatten(),
				},
				{ status: 400 },
			);
		}

		const {
			status,
			changeType: parsedType,
			search,
			from,
			to,
		} = parsedFilters.data as {
			status?: ImplementationChangeStatus | "all";
			changeType?: ImplementationChangeType | "all";
			search?: string;
			from?: string;
			to?: string;
		};

		const changes = await listClientSafeImplementationChanges(clientId);
		const filtered = applyImplementationChangeFilters(changes, {
			status,
			type: parsedType,
			search,
			from,
			to,
		});

		const sorted = sortImplementationChangesByUpdatedAt(filtered);
		csvContent = implementationChangesToCSV(
			sorted.map((change) => ({
				id: change.id,
				title: change.title,
				targetRef: change.targetRef,
				changeType: deriveImplementationChangeType(change),
				status: deriveImplementationChangeStatus(change),
				approvalStatus: change.approvalStatus,
				executedAt: change.execution?.executedAt ?? null,
				rolledBackAt: change.rollback?.rolledBackAt ?? null,
				updatedAt: change.updatedAt,
			})),
		);
		filename = `implementation_changes_${client.slug}_${today}.csv`;
	} else {
		return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
	}

	return new NextResponse(`\ufeff${csvContent}`, {
		status: 200,
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="${filename}"`,
		},
	});
}
