import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { phase1Flags } from "@/lib/flags";
import {
	getOnboardingProfile,
	onboardingPersistSchema,
	saveOnboardingProfile,
} from "@/lib/onboarding";

async function getClientOrNull(clientId: string) {
	return db
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.id, clientId), eq(clients.isActive, true)))
		.get();
}

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ clientId: string }> },
) {
	if (!phase1Flags.onboardingV2()) {
		return NextResponse.json(
			{ error: "Onboarding v2 is disabled in this environment" },
			{ status: 404 },
		);
	}

	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { clientId } = await params;
	const accessContext = await getClientAccessContext(session, clientId);

	if (!can("onboarding", "view", { session, clientId, ...accessContext })) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const client = await getClientOrNull(clientId);
	if (!client) {
		return NextResponse.json({ error: "Client not found" }, { status: 404 });
	}

	const profile = await getOnboardingProfile(clientId);
	return NextResponse.json(profile);
}

export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ clientId: string }> },
) {
	if (!phase1Flags.onboardingV2()) {
		return NextResponse.json(
			{ error: "Onboarding v2 is disabled in this environment" },
			{ status: 404 },
		);
	}

	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { clientId } = await params;
	const accessContext = await getClientAccessContext(session, clientId);

	if (!can("onboarding", "edit", { session, clientId, ...accessContext })) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const client = await getClientOrNull(clientId);
	if (!client) {
		return NextResponse.json({ error: "Client not found" }, { status: 404 });
	}

	try {
		const body = (await request.json()) as unknown;
		const parsed = onboardingPersistSchema.parse(body);
		const profile = await saveOnboardingProfile(
			clientId,
			session.user.id,
			{
				status: parsed.status,
				businessFundamentals: parsed.businessFundamentals,
				northStarGoal: parsed.northStarGoal,
				conversionArchitecture: parsed.conversionArchitecture,
				strategicLevers: parsed.strategicLevers,
				competitors: parsed.competitors,
				currentStateBaseline: parsed.currentStateBaseline,
			},
			{
				createNewVersion: parsed.createNewVersion,
				version: parsed.version,
			},
		);

		return NextResponse.json(profile);
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: "Failed to persist onboarding profile";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}

export async function PATCH(
	request: NextRequest,
	context: { params: Promise<{ clientId: string }> },
) {
	return PUT(request, context);
}
