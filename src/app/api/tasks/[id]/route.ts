import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NewAuditLog } from "@/lib/db/schema";

interface RouteContext {
	params: Promise<{ id: string }>;
}

// GET /api/tasks/[id]
export async function GET(request: Request, context: RouteContext) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await context.params;

	const task = await db.select().from(tasks).where(eq(tasks.id, id)).get();

	if (!task) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	return NextResponse.json(task);
}

// PATCH /api/tasks/[id]
export async function PATCH(request: Request, context: RouteContext) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (session.user.role !== "ADMIN") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { id } = await context.params;

	try {
		const body = await request.json();
		const {
			title,
			description,
			status,
			priority,
			assignedTo,
			dueDate,
			completedAt,
			kanbanColumnId,
			position,
			tags,
			linkedResourceType,
			linkedResourceId,
		} = body;

		const task = await db.select().from(tasks).where(eq(tasks.id, id)).get();

		if (!task) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

		const updateData: any = {
			updatedAt: new Date(),
		};

		if (title !== undefined) updateData.title = title;
		if (description !== undefined) updateData.description = description;
		if (status !== undefined) {
			updateData.status = status;
			if (status === "DONE" && !task.completedAt) {
				updateData.completedAt = new Date();
			} else if (status !== "DONE") {
				updateData.completedAt = null;
			}
		}
		if (priority !== undefined) updateData.priority = priority;
		if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
		if (dueDate !== undefined)
			updateData.dueDate = dueDate ? new Date(dueDate) : null;
		if (completedAt !== undefined)
			updateData.completedAt = completedAt ? new Date(completedAt) : null;
		if (kanbanColumnId !== undefined)
			updateData.kanbanColumnId = kanbanColumnId;
		if (position !== undefined) updateData.position = position;
		if (tags !== undefined) updateData.tags = JSON.stringify(tags);
		if (linkedResourceType !== undefined)
			updateData.linkedResourceType = linkedResourceType;
		if (linkedResourceId !== undefined)
			updateData.linkedResourceId = linkedResourceId;

		const updated = await db
			.update(tasks)
			.set(updateData)
			.where(eq(tasks.id, id))
			.returning();

		// Audit log
		const auditEntry: NewAuditLog = {
			userId: session.user.id,
			action: "UPDATE",
			resourceType: "TASK",
			resourceId: id,
			clientId: task.clientId,
			changes: JSON.stringify({ before: task, after: updateData }),
		};
		await db.insert(auditLogs).values(auditEntry);

		return NextResponse.json(updated[0]);
	} catch (error) {
		console.error("Error updating task:", error);
		return NextResponse.json(
			{ error: "Failed to update task" },
			{ status: 500 },
		);
	}
}

// DELETE /api/tasks/[id]
export async function DELETE(request: Request, context: RouteContext) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (session.user.role !== "ADMIN") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { id } = await context.params;

	try {
		const task = await db.select().from(tasks).where(eq(tasks.id, id)).get();

		if (!task) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

		await db.delete(tasks).where(eq(tasks.id, id));

		// Audit log
		const auditEntry: NewAuditLog = {
			userId: session.user.id,
			action: "DELETE",
			resourceType: "TASK",
			resourceId: id,
			clientId: task.clientId,
			changes: JSON.stringify({ deleted: task }),
		};
		await db.insert(auditLogs).values(auditEntry);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting task:", error);
		return NextResponse.json(
			{ error: "Failed to delete task" },
			{ status: 500 },
		);
	}
}
