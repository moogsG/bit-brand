import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { clientMessages, clients } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

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

	return NextResponse.json(rows);
}

// POST /api/messages
export async function POST(request: Request) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { clientId, message } = body as { clientId?: string; message?: string };

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

		const [created] = await db
			.insert(clientMessages)
			.values({
				clientId,
				senderId: session.user.id,
				senderRole: session.user.role,
				body: message.trim(),
			})
			.returning();

		return NextResponse.json(created, { status: 201 });
	} catch (error) {
		console.error("Error creating message:", error);
		return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
	}
}
