import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { clients, userClientAssignments, users } from "@/lib/db/schema";

const createAssignmentSchema = z.object({
	userId: z.string().min(1),
	clientId: z.string().min(1),
});

export async function GET(req: NextRequest) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	if (!can("assignments", "view", { session })) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const clientId = req.nextUrl.searchParams.get("clientId");
	const userId = req.nextUrl.searchParams.get("userId");

	let rows = await db.select().from(userClientAssignments).all();

	if (clientId) {
		rows = rows.filter((row) => row.clientId === clientId);
	}

	if (userId) {
		rows = rows.filter((row) => row.userId === userId);
	}

	return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	if (!can("assignments", "view", { session })) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	if (!can("assignments", "edit", { session })) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const body = (await req.json()) as unknown;
		const parsed = createAssignmentSchema.parse(body);

		const [user, client] = await Promise.all([
			db
				.select({ id: users.id, role: users.role })
				.from(users)
				.where(eq(users.id, parsed.userId))
				.get(),
			db
				.select({ id: clients.id })
				.from(clients)
				.where(eq(clients.id, parsed.clientId))
				.get(),
		]);

		if (!user) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		if (!client) {
			return NextResponse.json({ error: "Client not found" }, { status: 404 });
		}

		if (!["ACCOUNT_MANAGER", "STRATEGIST"].includes(user.role)) {
			return NextResponse.json(
				{ error: "Only account managers and strategists can be assigned" },
				{ status: 400 },
			);
		}

		const existing = await db
			.select({ id: userClientAssignments.id })
			.from(userClientAssignments)
			.where(
				and(
					eq(userClientAssignments.userId, parsed.userId),
					eq(userClientAssignments.clientId, parsed.clientId),
				),
			)
			.get();

		if (existing) {
			return NextResponse.json({ id: existing.id, ...parsed });
		}

		const [created] = await db
			.insert(userClientAssignments)
			.values({
				userId: parsed.userId,
				clientId: parsed.clientId,
				assignedBy: session.user.id,
			})
			.returning();

		return NextResponse.json(created, { status: 201 });
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to create assignment";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}

export async function DELETE(req: NextRequest) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	if (!can("assignments", "view", { session })) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	if (!can("assignments", "edit", { session })) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const userId = req.nextUrl.searchParams.get("userId");
	const clientId = req.nextUrl.searchParams.get("clientId");

	if (!userId || !clientId) {
		return NextResponse.json(
			{ error: "userId and clientId are required" },
			{ status: 400 },
		);
	}

	const [deleted] = await db
		.delete(userClientAssignments)
		.where(
			and(
				eq(userClientAssignments.userId, userId),
				eq(userClientAssignments.clientId, clientId),
			),
		)
		.returning();

	if (!deleted) {
		return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
	}

	return NextResponse.json({ success: true });
}
