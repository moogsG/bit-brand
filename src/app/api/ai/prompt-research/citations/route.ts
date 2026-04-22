import { and, desc, eq, gte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { aiPromptCitations } from "@/lib/db/schema";
import { phase2Flags } from "@/lib/flags";

const PROMPT_RESEARCH_CITATIONS_API_VERSION = "1.0.0" as const;

type CitationsErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "INTERNAL_ERROR";

interface CitationsError {
	code: CitationsErrorCode;
	message: string;
	details?: unknown;
}

interface CitationsEnvelope<TData> {
	version: typeof PROMPT_RESEARCH_CITATIONS_API_VERSION;
	success: boolean;
	data: TData | null;
	error: CitationsError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<CitationsEnvelope<TData>>(
		{ version: PROMPT_RESEARCH_CITATIONS_API_VERSION, success: true, data, error: null },
		{ status },
	);
}

function fail(status: number, error: CitationsError) {
	return NextResponse.json<CitationsEnvelope<never>>(
		{ version: PROMPT_RESEARCH_CITATIONS_API_VERSION, success: false, data: null, error },
		{ status },
	);
}

const querySchema = z.object({
	clientId: z.string().min(1),
	window: z
		.enum(["30", "90"])
		.optional()
		.transform((v) => (v ? Number.parseInt(v, 10) : 30)),
});

function dateMinusDays(days: number): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - days);
	return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
	if (!phase2Flags.promptResearchV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message:
				"Prompt research citation APIs are disabled in this environment (FF_PROMPT_RESEARCH_V1=false)",
		});
	}

	const session = await auth();
	if (!session) {
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
	}

	const searchParams = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
	const parsed = querySchema.safeParse({
		clientId: searchParams.get("clientId"),
		window: searchParams.get("window") ?? undefined,
	});
	if (!parsed.success) {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Invalid query params",
			details: parsed.error.flatten(),
		});
	}

	const { clientId, window } = parsed.data;
	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("promptResearch", "view", { session, clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	const startDate = dateMinusDays(window);

	try {
		const rows = await db
			.select({
				domain: aiPromptCitations.domain,
				engine: aiPromptCitations.engine,
				contentType: aiPromptCitations.contentType,
				freshnessHint: aiPromptCitations.freshnessHint,
				date: aiPromptCitations.date,
			})
			.from(aiPromptCitations)
			.where(
				and(
					eq(aiPromptCitations.clientId, clientId),
					gte(aiPromptCitations.date, startDate),
				),
			)
			.orderBy(desc(aiPromptCitations.date))
			.limit(5000)
			.all();

		const byDomain: Record<
			string,
			{
				domain: string;
				total: number;
				byEngine: Record<string, number>;
				byContentType: Record<string, number>;
				latestDate: string;
			}
		> = {};

		for (const row of rows) {
			const key = row.domain;
			const existing = byDomain[key] ?? {
				domain: row.domain,
				total: 0,
				byEngine: {},
				byContentType: {},
				latestDate: row.date,
			};
			existing.total += 1;
			existing.byEngine[row.engine] = (existing.byEngine[row.engine] ?? 0) + 1;
			existing.byContentType[row.contentType] =
				(existing.byContentType[row.contentType] ?? 0) + 1;
			if (row.date > existing.latestDate) existing.latestDate = row.date;
			byDomain[key] = existing;
		}

		const topDomains = Object.values(byDomain)
			.sort((a, b) => b.total - a.total)
			.slice(0, 50);

		return ok({
			windowDays: window,
			startDate,
			topDomains,
			rowCount: rows.length,
		});
	} catch {
		return fail(500, { code: "INTERNAL_ERROR", message: "Failed to load citations" });
	}
}
