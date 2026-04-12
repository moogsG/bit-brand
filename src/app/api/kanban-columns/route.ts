import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { kanbanColumns, auditLogs } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NewKanbanColumn, NewAuditLog } from "@/lib/db/schema";

// GET /api/kanban-columns
export async function GET(request: Request) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const clientId = searchParams.get("clientId");

	if (!clientId) {
		return NextResponse.json(
			{ error: "clientId is required" },
			{ status: 400 },
		);
	}

	const results = await db
		.select()
		.from(kanbanColumns)
		.where(eq(kanbanColumns.clientId, clientId))
		.orderBy(asc(kanbanColumns.position))
		.all();

	return NextResponse.json(results);
}

// POST /api/kanban-columns
export async function POST(request: Request) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (session.user.role !== "ADMIN") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const body = await request.json();
		const { clientId, name, position = 0, color, isDefault = false } = body;

		if (!clientId || !name) {
			return NextResponse.json(
				{ error: "clientId and name are required" },
				{ status: 400 },
			);
		}

		const newColumn: NewKanbanColumn = {
			clientId,
			name,
			position,
			color: color || null,
			isDefault,
		};

		const result = await db
			.insert(kanbanColumns)
			.values(newColumn)
			.returning();

		// Audit log
		const auditEntry: NewAuditLog = {
			userId: session.user.id,
			action: "CREATE",
			resourceType: "KANBAN_COLUMN",
			resourceId: result[0].id,
			clientId,
			changes: JSON.stringify({ column: newColumn }),
		};
		await db.insert(auditLogs).values(auditEntry);

		return NextResponse.json(result[0], { status: 201 });
	} catch (error) {
		console.error("Error creating kanban column:", error);
		return NextResponse.json(
			{ error: "Failed to create kanban column" },
			{ status: 500 },
		);
	}
}
