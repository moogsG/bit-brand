import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { createInvitation } from "@/lib/auth/invites";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { sendInviteEmail } from "@/lib/email";
import { isOnboardingComplete } from "@/lib/onboarding";

const inviteSchema = z.object({
	email: z.string().email(),
	clientId: z.string().min(1),
});

export async function POST(req: NextRequest) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await req.json();
		const { email, clientId } = inviteSchema.parse(body);

		const accessContext = await getClientAccessContext(session, clientId);
		if (!can("clients", "edit", { session, clientId, ...accessContext })) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const clientRecord = await db
			.select({ name: clients.name })
			.from(clients)
			.where(eq(clients.id, clientId))
			.get();

		if (!clientRecord) {
			return NextResponse.json({ error: "Client not found" }, { status: 404 });
		}

		const onboardingComplete = await isOnboardingComplete(clientId);
		if (!onboardingComplete) {
			return NextResponse.json(
				{
					error:
						"Client onboarding must be completed before inviting portal users.",
					code: "ONBOARDING_INCOMPLETE",
				},
				{ status: 409 },
			);
		}

		const invitation = await createInvitation({
			email,
			clientId,
			createdBy: session.user.id,
		});

		const baseUrl =
			process.env.NEXTAUTH_URL ??
			process.env.NEXT_PUBLIC_APP_URL ??
			"http://localhost:3000";

		const inviteUrl = `${baseUrl}/invite/${invitation.token}`;

		// Fire-and-forget email (errors logged but not surfaced to caller)
		sendInviteEmail({
			to: email,
			inviteUrl,
			clientName: clientRecord?.name ?? "your portal",
		}).catch((err: unknown) => {
			console.error("Failed to send invite email:", err);
		});

		return NextResponse.json(
			{ inviteUrl, token: invitation.token },
			{ status: 201 },
		);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to create invitation";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
