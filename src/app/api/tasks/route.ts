import { and, desc, eq, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import type { NewAuditLog, NewTask } from "@/lib/db/schema";
import { auditLogs, tasks } from "@/lib/db/schema";

const taskStatusSchema = z.enum([
	"TODO",
	"IN_PROGRESS",
	"REVIEW",
	"DONE",
	"BLOCKED",
]);

// GET /api/tasks - List tasks
export async function GET(request: Request) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const clientId = searchParams.get("clientId");
	const assignedTo = searchParams.get("assignedTo");
	const status = searchParams.get("status");

	if (!clientId) {
		return NextResponse.json(
			{ error: "clientId is required" },
			{ status: 400 },
		);
	}

	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("tasks", "view", { session, clientId, ...accessContext })) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const conditions: SQL[] = [eq(tasks.clientId, clientId)];
	if (assignedTo) conditions.push(eq(tasks.assignedTo, assignedTo));
	if (status) {
		const parsedStatus = taskStatusSchema.safeParse(status);
		if (!parsedStatus.success) {
			return NextResponse.json({ error: "Invalid status" }, { status: 400 });
		}
		conditions.push(eq(tasks.status, parsedStatus.data));
	}

	const results = await db
		.select()
		.from(tasks)
		.where(and(...conditions))
		.orderBy(desc(tasks.createdAt))
		.all();
	return NextResponse.json(results);
}

// POST /api/tasks - Create task
export async function POST(request: Request) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const {
			clientId,
			title,
			description,
			status = "TODO",
			priority = "MEDIUM",
			assignedTo,
			dueDate,
			kanbanColumnId,
			position = 0,
			tags = [],
			linkedResourceType,
			linkedResourceId,
			linkedResourceLabel,
		} = body;

		if (!clientId || !title) {
			return NextResponse.json(
				{ error: "clientId and title are required" },
				{ status: 400 },
			);
		}

		const accessContext = await getClientAccessContext(session, clientId);
		if (!can("tasks", "edit", { session, clientId, ...accessContext })) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const newTask: NewTask = {
			clientId,
			title,
			description: description || null,
			status,
			priority,
			assignedTo: assignedTo || null,
			createdBy: session.user.id,
			dueDate: dueDate ? new Date(dueDate) : null,
			kanbanColumnId: kanbanColumnId || null,
			position,
			tags: JSON.stringify(tags),
			linkedResourceType: linkedResourceType || null,
			linkedResourceId: linkedResourceId || null,
			linkedResourceLabel: linkedResourceLabel || null,
		};

		const result = await db.insert(tasks).values(newTask).returning();

		// Audit log
		const auditEntry: NewAuditLog = {
			userId: session.user.id,
			action: "CREATE",
			resourceType: "TASK",
			resourceId: result[0].id,
			clientId,
			changes: JSON.stringify({ task: newTask }),
		};
		await db.insert(auditLogs).values(auditEntry);

		return NextResponse.json(result[0], { status: 201 });
	} catch (error) {
		console.error("Error creating task:", error);
		return NextResponse.json(
			{ error: "Failed to create task" },
			{ status: 500 },
		);
	}
}
