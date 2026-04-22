import { and, eq, gte, inArray, isNotNull, lt, ne, or } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications, tasks } from "@/lib/db/schema";

const TASK_ALERTS_CRON_VERSION = "1.0.0" as const;

const DEFAULT_LIMITS = {
	maxTasks: 100,
	dedupeWindowHours: 24,
} as const;

function parsePositiveInt(
	value: unknown,
	fallback: number,
	min = 1,
	max = 500,
): number {
	if (typeof value === "number" && Number.isFinite(value)) {
		return Math.min(max, Math.max(min, Math.trunc(value)));
	}

	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number.parseInt(value, 10);
		if (Number.isFinite(parsed)) {
			return Math.min(max, Math.max(min, parsed));
		}
	}

	return fallback;
}

async function tryParseJsonBody(
	request: NextRequest,
): Promise<Record<string, unknown>> {
	try {
		const text = await request.text();
		if (!text.trim()) {
			return {};
		}

		return JSON.parse(text) as Record<string, unknown>;
	} catch {
		return {};
	}
}

type AlertType = "TASK_OVERDUE" | "TASK_BLOCKED";

interface CandidateAlert {
	type: AlertType;
	taskId: string;
	clientId: string;
	recipientUserId: string;
	taskTitle: string;
	dueDate: Date | null;
}

export async function POST(request: NextRequest) {
	const authHeader = request.headers.get("authorization");
	const cronSecret = process.env.CRON_SECRET;
	if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
		return NextResponse.json(
			{
				version: TASK_ALERTS_CRON_VERSION,
				success: false,
				data: null,
				error: { code: "UNAUTHORIZED", message: "Unauthorized" },
			},
			{ status: 401 },
		);
	}

	const query =
		request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
	const body = await tryParseJsonBody(request);

	const maxTasks = parsePositiveInt(
		query.get("maxTasks") ?? body.maxTasks,
		DEFAULT_LIMITS.maxTasks,
		1,
		500,
	);

	const dedupeWindowHours = parsePositiveInt(
		query.get("dedupeWindowHours") ?? body.dedupeWindowHours,
		DEFAULT_LIMITS.dedupeWindowHours,
		1,
		168,
	);

	const now = new Date();
	const dedupeSince = new Date(
		now.getTime() - dedupeWindowHours * 60 * 60 * 1000,
	);

	const candidateTasks = await db
		.select({
			id: tasks.id,
			clientId: tasks.clientId,
			title: tasks.title,
			status: tasks.status,
			dueDate: tasks.dueDate,
			assignedTo: tasks.assignedTo,
			createdBy: tasks.createdBy,
		})
		.from(tasks)
		.where(
			and(
				or(
					and(
						isNotNull(tasks.dueDate),
						lt(tasks.dueDate, now),
						ne(tasks.status, "DONE"),
					),
					eq(tasks.status, "BLOCKED"),
				),
			),
		)
		.limit(maxTasks)
		.all();

	let overdueCandidates = 0;
	let blockedCandidates = 0;

	const candidates: CandidateAlert[] = [];
	for (const task of candidateTasks) {
		const recipientUserId = task.assignedTo ?? task.createdBy;
		if (!recipientUserId) {
			continue;
		}

		const isOverdue = Boolean(
			task.dueDate && task.dueDate < now && task.status !== "DONE",
		);
		const isBlocked = task.status === "BLOCKED";

		if (isOverdue) {
			overdueCandidates += 1;
			candidates.push({
				type: "TASK_OVERDUE",
				taskId: task.id,
				clientId: task.clientId,
				recipientUserId,
				taskTitle: task.title,
				dueDate: task.dueDate,
			});
		}

		if (isBlocked) {
			blockedCandidates += 1;
			candidates.push({
				type: "TASK_BLOCKED",
				taskId: task.id,
				clientId: task.clientId,
				recipientUserId,
				taskTitle: task.title,
				dueDate: task.dueDate,
			});
		}
	}

	const candidateTaskIds = [
		...new Set(candidates.map((candidate) => candidate.taskId)),
	];

	const existing =
		candidateTaskIds.length > 0
			? await db
					.select({
						recipientUserId: notifications.recipientUserId,
						type: notifications.type,
						taskId: notifications.taskId,
					})
					.from(notifications)
					.where(
						and(
							inArray(notifications.type, ["TASK_OVERDUE", "TASK_BLOCKED"]),
							inArray(notifications.taskId, candidateTaskIds),
							gte(notifications.createdAt, dedupeSince),
						),
					)
					.all()
			: [];

	const dedupeSet = new Set(
		existing.map(
			(item) => `${item.recipientUserId}:${item.type}:${item.taskId ?? ""}`,
		),
	);

	let createdAlerts = 0;
	let skippedDuplicates = 0;

	for (const candidate of candidates) {
		const dedupeKey = `${candidate.recipientUserId}:${candidate.type}:${candidate.taskId}`;
		if (dedupeSet.has(dedupeKey)) {
			skippedDuplicates += 1;
			continue;
		}

		await db.insert(notifications).values({
			recipientUserId: candidate.recipientUserId,
			clientId: candidate.clientId,
			taskId: candidate.taskId,
			type: candidate.type,
			title:
				candidate.type === "TASK_OVERDUE" ? "Task overdue" : "Task blocked",
			body:
				candidate.type === "TASK_OVERDUE"
					? `${candidate.taskTitle} is overdue${candidate.dueDate ? ` (due ${candidate.dueDate.toLocaleDateString()})` : ""}.`
					: `${candidate.taskTitle} is currently blocked and needs intervention.`,
			createdAt: now,
		});

		dedupeSet.add(dedupeKey);
		createdAlerts += 1;
	}

	return NextResponse.json({
		version: TASK_ALERTS_CRON_VERSION,
		success: true,
		data: {
			limits: {
				maxTasks,
				dedupeWindowHours,
			},
			counts: {
				scannedTasks: candidateTasks.length,
				overdueCandidates,
				blockedCandidates,
				createdAlerts,
				skippedDuplicates,
			},
			timestamp: now.toISOString(),
		},
		error: null,
	});
}
