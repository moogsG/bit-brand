import { and, desc, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { clients, technicalAuditRuns, technicalIssues } from "@/lib/db/schema";
import { phase1Flags } from "@/lib/flags";
import { runTechnicalBaselineAudit } from "@/lib/technical/baseline-audit";

const TECHNICAL_AUDITS_API_VERSION = "1.0.0" as const;

type TechnicalAuditsErrorCode =
	| "FEATURE_DISABLED"
	| "UNAUTHORIZED"
	| "VALIDATION_ERROR"
	| "FORBIDDEN"
	| "CLIENT_NOT_FOUND"
	| "INTERNAL_ERROR";

interface TechnicalAuditsError {
	code: TechnicalAuditsErrorCode;
	message: string;
	details?: unknown;
}

interface TechnicalAuditsEnvelope<TData> {
	version: typeof TECHNICAL_AUDITS_API_VERSION;
	success: boolean;
	data: TData | null;
	error: TechnicalAuditsError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<TechnicalAuditsEnvelope<TData>>(
		{
			version: TECHNICAL_AUDITS_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: TechnicalAuditsError) {
	return NextResponse.json<TechnicalAuditsEnvelope<never>>(
		{
			version: TECHNICAL_AUDITS_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const getQuerySchema = z.object({
	clientId: z.string().min(1),
	limit: z.coerce.number().int().min(1).max(20).optional().default(10),
});

const postBodySchema = z.object({
	clientId: z.string().min(1),
	urls: z.array(z.string().min(1).max(2_048)).max(10).optional(),
});

function parseSeedUrls(seedUrls: string): string[] {
	try {
		const parsed = JSON.parse(seedUrls) as unknown;
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed
			.filter((item): item is string => typeof item === "string")
			.slice(0, 10);
	} catch {
		return [];
	}
}

export async function GET(request: NextRequest) {
	if (!phase1Flags.technicalBaselineV1()) {
		return fail(404, {
			code: "FEATURE_DISABLED",
			message:
				"Technical baseline endpoints are disabled in this environment (FF_TECHNICAL_BASELINE_V1=false)",
		});
	}

	const session = await auth();
	if (!session) {
		return fail(401, {
			code: "UNAUTHORIZED",
			message: "Unauthorized",
		});
	}

	const parsedQuery = getQuerySchema.safeParse({
		clientId: request.nextUrl.searchParams.get("clientId"),
		limit: request.nextUrl.searchParams.get("limit") ?? undefined,
	});

	if (!parsedQuery.success) {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Invalid query parameters",
			details: parsedQuery.error.flatten(),
		});
	}

	const { clientId, limit } = parsedQuery.data;

	const client = await db
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.id, clientId), eq(clients.isActive, true)))
		.get();
	if (!client) {
		return fail(404, {
			code: "CLIENT_NOT_FOUND",
			message: "Client not found",
		});
	}

	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("technical", "view", { session, clientId, ...accessContext })) {
		return fail(403, {
			code: "FORBIDDEN",
			message: "Forbidden",
		});
	}

	try {
		const runs = await db
			.select()
			.from(technicalAuditRuns)
			.where(eq(technicalAuditRuns.clientId, clientId))
			.orderBy(desc(technicalAuditRuns.startedAt))
			.limit(limit)
			.all();

		const runIds = runs.map((run) => run.id);
		const issues =
			runIds.length > 0
				? await db
						.select()
						.from(technicalIssues)
						.where(inArray(technicalIssues.runId, runIds))
						.orderBy(desc(technicalIssues.createdAt))
						.all()
				: [];

		const issuesByRunId = new Map<
			string,
			(typeof technicalIssues.$inferSelect)[]
		>();
		for (const issue of issues) {
			const list = issuesByRunId.get(issue.runId) ?? [];
			list.push(issue);
			issuesByRunId.set(issue.runId, list);
		}

		return ok({
			clientId,
			runs: runs.map((run) => ({
				...run,
				seedUrls: parseSeedUrls(run.seedUrls),
				issues: issuesByRunId.get(run.id) ?? [],
			})),
		});
	} catch (error) {
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to load technical audits",
			details: error instanceof Error ? error.message : String(error),
		});
	}
}

export async function POST(request: NextRequest) {
	if (!phase1Flags.technicalBaselineV1()) {
		return fail(404, {
			code: "FEATURE_DISABLED",
			message:
				"Technical baseline endpoints are disabled in this environment (FF_TECHNICAL_BASELINE_V1=false)",
		});
	}

	const session = await auth();
	if (!session) {
		return fail(401, {
			code: "UNAUTHORIZED",
			message: "Unauthorized",
		});
	}

	let body: z.infer<typeof postBodySchema>;
	try {
		const payload = (await request.json()) as unknown;
		const parsed = postBodySchema.safeParse(payload);
		if (!parsed.success) {
			return fail(400, {
				code: "VALIDATION_ERROR",
				message: "Invalid request body",
				details: parsed.error.flatten(),
			});
		}
		body = parsed.data;
	} catch {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Request body must be valid JSON",
		});
	}

	const client = await db
		.select({
			id: clients.id,
			domain: clients.domain,
			isActive: clients.isActive,
		})
		.from(clients)
		.where(eq(clients.id, body.clientId))
		.get();

	if (!client || !client.isActive) {
		return fail(404, {
			code: "CLIENT_NOT_FOUND",
			message: "Client not found",
		});
	}

	const accessContext = await getClientAccessContext(session, body.clientId);
	if (
		!can("technical", "edit", {
			session,
			clientId: body.clientId,
			...accessContext,
		})
	) {
		return fail(403, {
			code: "FORBIDDEN",
			message: "Forbidden",
		});
	}

	try {
		const result = await runTechnicalBaselineAudit({
			clientId: body.clientId,
			clientDomain: client.domain,
			seedUrls: body.urls,
			triggeredByUserId: session.user.id,
		});

		return ok(
			{
				clientId: body.clientId,
				run: {
					...result.run,
					seedUrls: parseSeedUrls(result.run.seedUrls),
				},
				issues: result.issues,
				urlsCrawled: result.urlsCrawled,
			},
			201,
		);
	} catch (error) {
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to run technical baseline audit",
			details: error instanceof Error ? error.message : String(error),
		});
	}
}
