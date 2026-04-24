import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { clientMessages, clientUsers, clients } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

function parseRecipientIds(value: string | null | undefined): string[] {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
	} catch {
		return [];
	}
}

// GET /api/messages?clientId=...
export async function GET(request: Request) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const clientId = searchParams.get("clientId");
	const limit = Number(searchParams.get("limit") ?? 100);

	if (!clientId) {
		return NextResponse.json({ error: "clientId is required" }, { status: 400 });
	}

	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("messages", "view", { session, clientId, ...accessContext })) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const rows = await db
		.select()
		.from(clientMessages)
		.where(eq(clientMessages.clientId, clientId))
		.orderBy(desc(clientMessages.createdAt))
		.limit(Math.max(1, Math.min(limit, 200)))
		.all();

	const visibleRows = rows.filter((row) => {
		if (session.user.role === "ADMIN") {
			return true;
		}

		if (row.senderId === session.user.id) {
			return true;
		}

		if (row.recipientScope === "TEAM") {
			return true;
		}

		const recipientIds = parseRecipientIds(row.recipientUserIds);
		return recipientIds.includes(session.user.id);
	});

	return NextResponse.json(visibleRows);
}

// POST /api/messages
export async function POST(request: Request) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { clientId, message, recipientScope, recipientUserIds } = body as {
			clientId?: string;
			message?: string;
			recipientScope?: "TEAM" | "MEMBERS";
			recipientUserIds?: string[];
		};

		if (!clientId || !message || message.trim().length === 0) {
			return NextResponse.json(
				{ error: "clientId and non-empty message are required" },
				{ status: 400 },
			);
		}

		// Verify client exists
		const client = await db.select().from(clients).where(eq(clients.id, clientId)).get();
		if (!client) {
			return NextResponse.json({ error: "Client not found" }, { status: 404 });
		}

		const accessContext = await getClientAccessContext(session, clientId);
		if (!can("messages", "edit", { session, clientId, ...accessContext })) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const resolvedRecipientScope =
			recipientScope === "MEMBERS" ? "MEMBERS" : "TEAM";
		const sanitizedRecipientIds = Array.isArray(recipientUserIds)
			? Array.from(
					new Set(
						recipientUserIds
							.filter((id): id is string => typeof id === "string")
							.map((id) => id.trim())
							.filter((id) => id.length > 0),
					),
			  )
			: [];

		if (resolvedRecipientScope === "MEMBERS") {
			if (sanitizedRecipientIds.length === 0) {
				return NextResponse.json(
					{ error: "Select at least one recipient when sending to members" },
					{ status: 400 },
				);
			}

			const clientMembershipRows = await db
				.select({ userId: clientUsers.userId })
				.from(clientUsers)
				.where(eq(clientUsers.clientId, clientId))
				.all();

			const validRecipientIds = new Set(clientMembershipRows.map((row) => row.userId));
			const hasInvalidRecipient = sanitizedRecipientIds.some(
				(id) => !validRecipientIds.has(id),
			);

			if (hasInvalidRecipient) {
				return NextResponse.json(
					{ error: "One or more recipients are not members of this client team" },
					{ status: 400 },
				);
			}
		}

		const [created] = await db
			.insert(clientMessages)
			.values({
				clientId,
				senderId: session.user.id,
				senderRole: session.user.role,
				recipientScope: resolvedRecipientScope,
				recipientUserIds: JSON.stringify(
					resolvedRecipientScope === "TEAM" ? [] : sanitizedRecipientIds,
				),
				body: message.trim(),
			})
			.returning();

		return NextResponse.json(created, { status: 201 });
	} catch (error) {
		console.error("Error creating message:", error);
		return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
	}
}
