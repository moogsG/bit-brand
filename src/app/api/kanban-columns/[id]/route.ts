import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { kanbanColumns, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NewAuditLog } from "@/lib/db/schema";

interface RouteContext {
	params: Promise<{ id: string }>;
}

// PATCH /api/kanban-columns/[id]
export async function PATCH(request: Request, context: RouteContext) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await context.params;

	try {
		const body = await request.json();
		const { name, position, color, isDefault } = body;

		const column = await db
			.select()
			.from(kanbanColumns)
			.where(eq(kanbanColumns.id, id))
			.get();

		if (!column) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

		const accessContext = await getClientAccessContext(session, column.clientId);
		if (!can("kanban", "edit", { session, clientId: column.clientId, ...accessContext })) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const updateData: Partial<typeof kanbanColumns.$inferInsert> = {
			updatedAt: new Date(),
		};

		if (name !== undefined) updateData.name = name;
		if (position !== undefined) updateData.position = position;
		if (color !== undefined) updateData.color = color;
		if (isDefault !== undefined) updateData.isDefault = isDefault;

		const updated = await db
			.update(kanbanColumns)
			.set(updateData)
			.where(eq(kanbanColumns.id, id))
			.returning();

		// Audit log
		const auditEntry: NewAuditLog = {
			userId: session.user.id,
			action: "UPDATE",
			resourceType: "KANBAN_COLUMN",
			resourceId: id,
			clientId: column.clientId,
			changes: JSON.stringify({ before: column, after: updateData }),
		};
		await db.insert(auditLogs).values(auditEntry);

		return NextResponse.json(updated[0]);
	} catch (error) {
		console.error("Error updating kanban column:", error);
		return NextResponse.json(
			{ error: "Failed to update kanban column" },
			{ status: 500 },
		);
	}
}

// DELETE /api/kanban-columns/[id]
export async function DELETE(request: Request, context: RouteContext) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await context.params;

	try {
		const column = await db
			.select()
			.from(kanbanColumns)
			.where(eq(kanbanColumns.id, id))
			.get();

		if (!column) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

		const accessContext = await getClientAccessContext(session, column.clientId);
		if (!can("kanban", "edit", { session, clientId: column.clientId, ...accessContext })) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		await db.delete(kanbanColumns).where(eq(kanbanColumns.id, id));

		// Audit log
		const auditEntry: NewAuditLog = {
			userId: session.user.id,
			action: "DELETE",
			resourceType: "KANBAN_COLUMN",
			resourceId: id,
			clientId: column.clientId,
			changes: JSON.stringify({ deleted: column }),
		};
		await db.insert(auditLogs).values(auditEntry);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting kanban column:", error);
		return NextResponse.json(
			{ error: "Failed to delete kanban column" },
			{ status: 500 },
		);
	}
}
