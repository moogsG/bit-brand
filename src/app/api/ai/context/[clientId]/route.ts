import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { buildClientContextPayload } from "@/lib/ai/context-builder";
import { auth } from "@/lib/auth";
import { can, resolvePermissionRole } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { isClientEquivalentRole } from "@/lib/auth/role-mapping";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { phase1Flags, phase2Flags } from "@/lib/flags";

const AI_CONTEXT_API_VERSION = "1.0.0" as const;

type AiContextErrorCode =
	| "FEATURE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "MODULE_DISABLED"
	| "CLIENT_NOT_FOUND"
	| "INTERNAL_ERROR";

interface AiContextError {
	code: AiContextErrorCode;
	message: string;
}

interface AiContextResponseEnvelope<TData> {
	version: typeof AI_CONTEXT_API_VERSION;
	success: boolean;
	data: TData | null;
	error: AiContextError | null;
}

interface AiContextData {
	clientId: string;
	scope: "agency-full" | "client-safe";
	context: Awaited<ReturnType<typeof buildClientContextPayload>>;
}

function buildSuccessResponse(
	data: AiContextData,
): NextResponse<AiContextResponseEnvelope<AiContextData>> {
	return NextResponse.json({
		version: AI_CONTEXT_API_VERSION,
		success: true,
		data,
		error: null,
	});
}

function buildErrorResponse(
	status: number,
	error: AiContextError,
): NextResponse<AiContextResponseEnvelope<AiContextData>> {
	return NextResponse.json(
		{
			version: AI_CONTEXT_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

function toClientSafeSubset(
	context: Awaited<ReturnType<typeof buildClientContextPayload>>,
) {
	return {
		...context,
		opportunities: {
			placeholder: context.opportunities.placeholder,
			items: [],
		},
		risks: {
			placeholder: context.risks.placeholder,
			items: [],
		},
	};
}

async function getClientOrNull(clientId: string) {
	return db
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.id, clientId), eq(clients.isActive, true)))
		.get();
}

const phase2ContextModules = [
	"ai-visibility",
	"prompt-research",
	"eeat",
] as const;
type Phase2ContextModule = (typeof phase2ContextModules)[number];

function parseContextModule(module: string | null): Phase2ContextModule | null {
	if (!module) {
		return null;
	}

	if ((phase2ContextModules as readonly string[]).includes(module)) {
		return module as Phase2ContextModule;
	}

	return null;
}

function isContextModuleEnabled(module: Phase2ContextModule): boolean {
	switch (module) {
		case "ai-visibility":
			return phase2Flags.aiVisibilityV1();
		case "prompt-research":
			return phase2Flags.promptResearchV1();
		case "eeat":
			return phase2Flags.eeatV1();
	}
}

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ clientId: string }> },
) {
	if (!phase1Flags.aiContextV1()) {
		return buildErrorResponse(404, {
			code: "FEATURE_DISABLED",
			message: "AI context endpoints are disabled in this environment",
		});
	}

	const searchParams =
		request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
	const requestedModule = parseContextModule(searchParams.get("module"));
	if (requestedModule && !isContextModuleEnabled(requestedModule)) {
		return buildErrorResponse(404, {
			code: "MODULE_DISABLED",
			message: `AI context module '${requestedModule}' is disabled in this environment`,
		});
	}

	const session = await auth();
	if (!session) {
		return buildErrorResponse(401, {
			code: "UNAUTHORIZED",
			message: "Unauthorized",
		});
	}

	const { clientId } = await params;
	const accessContext = await getClientAccessContext(session, clientId);

	if (!can("aiVisibility", "view", { session, clientId, ...accessContext })) {
		return buildErrorResponse(403, {
			code: "FORBIDDEN",
			message: "Forbidden",
		});
	}

	const role = resolvePermissionRole({ session });

	const client = await getClientOrNull(clientId);
	if (!client) {
		return buildErrorResponse(404, {
			code: "CLIENT_NOT_FOUND",
			message: "Client not found",
		});
	}

	try {
		const context = await buildClientContextPayload(clientId);
		const scope = isClientEquivalentRole(role) ? "client-safe" : "agency-full";

		return buildSuccessResponse({
			clientId,
			scope,
			context: scope === "client-safe" ? toClientSafeSubset(context) : context,
		});
	} catch {
		return buildErrorResponse(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to build AI context payload",
		});
	}
}
