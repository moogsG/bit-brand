"use client";

import { Link2, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { KanbanColumn, Task } from "@/lib/db/schema";

interface KanbanBoardProps {
	columns: KanbanColumn[];
	tasks: Task[];
	clientId: string;
}

type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

interface BoardColumn {
	id: TaskStatus;
	label: string;
}

interface TaskDraft {
	title: string;
	dueDate: string;
	urgency: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
	status: TaskStatus;
}

const BOARD_COLUMNS: BoardColumn[] = [
	{ id: "TODO", label: "Not Started" },
	{ id: "IN_PROGRESS", label: "In Progress" },
	{ id: "REVIEW", label: "Revision" },
	{ id: "DONE", label: "Complete" },
];

const EMPTY_DRAFT: TaskDraft = {
	title: "",
	dueDate: "",
	urgency: "MEDIUM",
	status: "TODO",
};

export function KanbanBoard({ columns, tasks, clientId }: KanbanBoardProps) {
	const [taskState, setTasks] = useState<Task[]>(tasks);
	const [isSaving, setIsSaving] = useState(false);
	const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
	const [taskDraft, setTaskDraft] = useState<TaskDraft>({ ...EMPTY_DRAFT });

	const statusToColumnId: Partial<Record<TaskStatus, string>> = {
		TODO: columns.find((column) => column.name.toLowerCase().includes("not") || column.name.toLowerCase().includes("todo"))?.id,
		IN_PROGRESS: columns.find((column) => column.name.toLowerCase().includes("progress") || column.name.toLowerCase().includes("doing"))?.id,
		REVIEW: columns.find((column) => column.name.toLowerCase().includes("review") || column.name.toLowerCase().includes("revision"))?.id,
		DONE: columns.find((column) => column.name.toLowerCase().includes("done") || column.name.toLowerCase().includes("complete"))?.id,
	};

	const deriveBoardStatus = (task: Task): TaskStatus => {
		if (task.status === "DONE") return "DONE";
		if (task.status === "REVIEW") return "REVIEW";
		if (task.status === "IN_PROGRESS") return "IN_PROGRESS";
		if (task.status === "BLOCKED") return "IN_PROGRESS";
		return "TODO";
	};

	const getTasksForColumn = (columnStatus: TaskStatus) => {
		return taskState
			.filter((task) => deriveBoardStatus(task) === columnStatus)
			.sort((a, b) => a.position - b.position);
	};

	const getPriorityColor = (priority: string) => {
		switch (priority) {
			case "URGENT":
				return "bg-red-500";
			case "HIGH":
				return "bg-orange-500";
			case "MEDIUM":
				return "bg-yellow-500";
			default:
				return "bg-gray-500";
		}
	};

	const getUrgencyLabel = (task: Task) => {
		try {
			const parsed = JSON.parse(task.tags ?? "[]") as string[];
			const urgencyTag = parsed.find((tag) => tag.startsWith("urgency:"));
			if (!urgencyTag) return task.priority;
			return urgencyTag.replace("urgency:", "").toUpperCase();
		} catch {
			return task.priority;
		}
	};

	const getLinkedResourceHref = (task: Task): string | null => {
		if (!task.linkedResourceType || !task.linkedResourceId) {
			return null;
		}

		switch (task.linkedResourceType.trim().toUpperCase()) {
			case "REPORT":
				return `/admin/clients/${clientId}/reports/${task.linkedResourceId}`;
			case "STRATEGY":
				return `/admin/clients/${clientId}/strategy/${task.linkedResourceId}`;
			case "KEYWORDS":
				return `/admin/clients/${clientId}/keywords`;
			case "OPPORTUNITY":
				return `/admin/clients/${clientId}/opportunities`;
			case "TECHNICAL_AUDIT":
				return `/admin/clients/${clientId}/technical-audits`;
			default:
				return null;
		}
	};

	const getLinkedResourceLabel = (task: Task): string | null => {
		if (
			task.linkedResourceLabel &&
			task.linkedResourceLabel.trim().length > 0
		) {
			return task.linkedResourceLabel.trim();
		}

		if (task.linkedResourceType && task.linkedResourceId) {
			return `${task.linkedResourceType}: ${task.linkedResourceId}`;
		}

		return null;
	};

	async function moveTask(taskId: string, targetStatus: TaskStatus) {
		const task = taskState.find((item) => item.id === taskId);
		if (!task) return;

		const targetTasks = getTasksForColumn(targetStatus);
		const nextPosition = targetTasks.length;

		setTasks((prev) =>
			prev.map((item) =>
				item.id === taskId
					? {
							...item,
							status: targetStatus,
							kanbanColumnId: statusToColumnId[targetStatus] ?? null,
							position: nextPosition,
						}
					: item,
			),
		);

		try {
			await fetch(`/api/tasks/${taskId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					status: targetStatus,
					kanbanColumnId: statusToColumnId[targetStatus] ?? null,
					position: nextPosition,
				}),
			});
		} catch (err) {
			console.error("Failed to move task", err);
			setTasks((prev) => prev.map((item) => (item.id === task.id ? task : item)));
		}
	}

	async function handleAddTask() {
		const columnStatus = taskDraft.status;
		const title = taskDraft.title.trim();
		if (!title) return;

		setIsSaving(true);
		try {
			const res = await fetch("/api/tasks", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					clientId,
					title,
					status: columnStatus,
					priority: taskDraft.urgency,
					tags: [`urgency:${taskDraft.urgency.toLowerCase()}`],
					dueDate: taskDraft.dueDate
						? new Date(taskDraft.dueDate).toISOString()
						: null,
					kanbanColumnId: statusToColumnId[columnStatus] ?? null,
					position: getTasksForColumn(columnStatus).length,
				}),
			});
			if (!res.ok) throw new Error(await res.text());
			const task = (await res.json()) as Task;
			setTasks((prev) => [...prev, task]);
			setTaskDraft({ ...EMPTY_DRAFT, status: columnStatus });
		} catch (err) {
			console.error("Failed to add task", err);
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-sm">Add Task</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
						<div className="space-y-1">
							<Label htmlFor="task-title-global" className="text-xs">
								Task
							</Label>
							<Input
								id="task-title-global"
								value={taskDraft.title}
								onChange={(event) =>
									setTaskDraft((prev) => ({ ...prev, title: event.target.value }))
								}
								placeholder="Add task title"
								className="h-9"
							/>
						</div>
						<div className="space-y-1">
							<Label htmlFor="task-status-global" className="text-xs">
								Status
							</Label>
							<select
								id="task-status-global"
								value={taskDraft.status}
								onChange={(event) =>
									setTaskDraft((prev) => ({
										...prev,
										status: event.target.value as TaskStatus,
									}))
								}
								className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
							>
								<option value="TODO">Not Started</option>
								<option value="IN_PROGRESS">In Progress</option>
								<option value="REVIEW">Revision</option>
								<option value="DONE">Complete</option>
							</select>
						</div>
						<div className="space-y-1">
							<Label htmlFor="task-due-global" className="text-xs">
								Due
							</Label>
							<Input
								id="task-due-global"
								type="date"
								value={taskDraft.dueDate}
								onChange={(event) =>
									setTaskDraft((prev) => ({ ...prev, dueDate: event.target.value }))
								}
								className="h-9"
							/>
						</div>
						<div className="space-y-1">
							<Label htmlFor="task-urgency-global" className="text-xs">
								Urgency
							</Label>
							<select
								id="task-urgency-global"
								value={taskDraft.urgency}
								onChange={(event) =>
									setTaskDraft((prev) => ({
										...prev,
										urgency: event.target.value as TaskDraft["urgency"],
									}))
								}
								className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
							>
								<option value="LOW">Low</option>
								<option value="MEDIUM">Medium</option>
								<option value="HIGH">High</option>
								<option value="URGENT">Urgent</option>
							</select>
						</div>
						<div className="flex items-end">
							<Button
								variant="outline"
								size="sm"
								className="h-9 w-full"
								onClick={() => void handleAddTask()}
								disabled={isSaving || taskDraft.title.trim().length === 0}
							>
								<Plus className="h-4 w-4 mr-2" />
								Add
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			<div className="flex gap-4 overflow-x-auto pb-4">
			{BOARD_COLUMNS.map((column) => {
				const columnTasks = getTasksForColumn(column.id);
				return (
					<div
						key={column.label}
						className="flex-shrink-0 w-80"
						style={{ minWidth: "320px" }}
						onDragOver={(event) => event.preventDefault()}
						onDrop={(event) => {
							event.preventDefault();
							if (!draggedTaskId) return;
							void moveTask(draggedTaskId, column.id);
							setDraggedTaskId(null);
						}}
					>
						<Card>
							<CardHeader className="pb-3">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<CardTitle className="text-sm font-medium">
											{column.label}
										</CardTitle>
										<Badge variant="secondary" className="text-xs">
											{columnTasks.length}
										</Badge>
									</div>
								</div>
							</CardHeader>
							<CardContent className="space-y-2">
								{columnTasks.map((task) => (
									<Card
										key={task.id}
										className="p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
										draggable
										onDragStart={() => setDraggedTaskId(task.id)}
									>
										<div className="space-y-2">
											<div className="flex items-start justify-between gap-2">
												<p className="text-sm font-medium flex-1">
													{task.title}
												</p>
												<div
													className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${getPriorityColor(task.priority)}`}
												/>
											</div>
											{task.description && (
												<p className="text-xs text-muted-foreground line-clamp-2">
													{task.description}
												</p>
											)}
											{getLinkedResourceLabel(task) ? (
												<div className="text-xs text-muted-foreground">
													<div className="inline-flex items-center gap-1">
														<Link2 className="h-3 w-3" />
														<span>Linked</span>
													</div>{" "}
													{getLinkedResourceHref(task) ? (
														<Link
															href={getLinkedResourceHref(task) ?? "#"}
															className="text-primary hover:underline"
														>
															{getLinkedResourceLabel(task)}
														</Link>
													) : (
														<span>{getLinkedResourceLabel(task)}</span>
													)}
												</div>
											) : null}
											<div className="flex items-center justify-between text-xs text-muted-foreground">
												{task.dueDate && (
													<span>
														Due{" "}
														{new Date(task.dueDate).toLocaleDateString(
															"en-US",
															{
																month: "short",
																day: "numeric",
															},
														)}
													</span>
												)}
												<Badge variant="outline" className="text-xs">
													{getUrgencyLabel(task)}
												</Badge>
											</div>
										</div>
									</Card>
								))}
							</CardContent>
						</Card>
					</div>
				);
			})}
			</div>
		</div>
	);
}
