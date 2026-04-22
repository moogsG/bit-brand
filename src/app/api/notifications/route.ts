import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";

const querySchema = z.object({
	clientId: z.string().min(1).optional(),
	unreadOnly: z.coerce.boolean().default(false),
	limit: z.coerce.number().int().min(1).max(200).default(50),
});

const patchSchema = z
	.object({
		clientId: z.string().min(1).optional(),
		notificationIds: z.array(z.string().min(1)).min(1).optional(),
		markAllUnread: z.boolean().optional().default(false),
	})
	.refine(
		(value) => value.markAllUnread || (value.notificationIds && value.notificationIds.length > 0),
		{
			message: "Provide notificationIds or set markAllUnread=true",
			path: ["notificationIds"],
		},
	);

// GET /api/notifications
export async function GET(request: Request) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const parsedQuery = querySchema.safeParse({
		clientId: new URL(request.url).searchParams.get("clientId") ?? undefined,
		unreadOnly:
			new URL(request.url).searchParams.get("unreadOnly") ?? undefined,
		limit: new URL(request.url).searchParams.get("limit") ?? undefined,
	});

	if (!parsedQuery.success) {
		return NextResponse.json(
			{
				error: "Invalid query parameters",
				details: parsedQuery.error.flatten(),
			},
			{ status: 400 },
		);
	}

	const { clientId, unreadOnly, limit } = parsedQuery.data;

	if (clientId) {
		const accessContext = await getClientAccessContext(session, clientId);
		if (
			!can("notifications", "view", { session, clientId, ...accessContext })
		) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
	} else if (!can("notifications", "view", { session })) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const conditions = [eq(notifications.recipientUserId, session.user.id)];
	if (clientId) {
		conditions.push(eq(notifications.clientId, clientId));
	}
	if (unreadOnly) {
		conditions.push(isNull(notifications.readAt));
	}

	const rows = await db
		.select()
		.from(notifications)
		.where(and(...conditions))
		.orderBy(desc(notifications.createdAt))
		.limit(limit)
		.all();

	return NextResponse.json({
		success: true,
		data: rows,
		error: null,
	});
}

// PATCH /api/notifications
export async function PATCH(request: Request) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let parsedBody: z.infer<typeof patchSchema>;
	try {
		const body = (await request.json()) as unknown;
		const validation = patchSchema.safeParse(body);
		if (!validation.success) {
			return NextResponse.json(
				{
					error: "Invalid request payload",
					details: validation.error.flatten(),
				},
				{ status: 400 },
			);
		}
		parsedBody = validation.data;
	} catch {
		return NextResponse.json(
			{ error: "Request body must be valid JSON" },
			{ status: 400 },
		);
	}

	const { clientId, notificationIds = [], markAllUnread } = parsedBody;

	if (clientId) {
		const accessContext = await getClientAccessContext(session, clientId);
		if (!can("notifications", "view", { session, clientId, ...accessContext })) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
	} else if (!can("notifications", "view", { session })) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const scopedConditions = [eq(notifications.recipientUserId, session.user.id)];
	if (clientId) {
		scopedConditions.push(eq(notifications.clientId, clientId));
	}

	const idsToMark = markAllUnread
		? await db
				.select({ id: notifications.id })
				.from(notifications)
				.where(and(...scopedConditions, isNull(notifications.readAt)))
				.all()
		: await db
				.select({ id: notifications.id })
				.from(notifications)
				.where(
					and(
						...scopedConditions,
						inArray(notifications.id, [...new Set(notificationIds)]),
						isNull(notifications.readAt),
					),
				)
				.all();

	if (idsToMark.length === 0) {
		return NextResponse.json({
			success: true,
			data: { updated: 0 },
			error: null,
		});
	}

	await db
		.update(notifications)
		.set({ readAt: new Date() })
		.where(inArray(notifications.id, idsToMark.map((row) => row.id)))
		.run();

	return NextResponse.json({
		success: true,
		data: { updated: idsToMark.length },
		error: null,
	});
}
