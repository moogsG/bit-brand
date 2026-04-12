"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, MoreVertical } from "lucide-react";
import type { Task, KanbanColumn } from "@/lib/db/schema";

interface KanbanBoardProps {
	columns: KanbanColumn[];
	tasks: Task[];
	clientId: string;
}

export function KanbanBoard({ columns, tasks, clientId }: KanbanBoardProps) {
	const [columnState, setColumns] = useState<KanbanColumn[]>(columns);
	const [taskState, setTasks] = useState<Task[]>(tasks);

	const getTasksForColumn = (columnId: string) => {
		return taskState
			.filter((t) => t.kanbanColumnId === columnId)
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

	async function handleAddColumn() {
		const name = window.prompt("Column name");
		if (!name) return;
		try {
			const res = await fetch("/api/kanban-columns", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ clientId, name, position: columnState.length }),
			});
			if (!res.ok) throw new Error(await res.text());
			const col = (await res.json()) as KanbanColumn;
			setColumns((prev) => [...prev, col]);
		} catch (err) {
			console.error("Failed to add column", err);
		}
	}

	async function handleAddTask(columnId: string) {
		const title = window.prompt("Task title");
		if (!title) return;
		try {
			const res = await fetch("/api/tasks", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					clientId,
					title,
					kanbanColumnId: columnId,
					position: getTasksForColumn(columnId).length,
				}),
			});
			if (!res.ok) throw new Error(await res.text());
			const task = (await res.json()) as Task;
			setTasks((prev) => [...prev, task]);
		} catch (err) {
			console.error("Failed to add task", err);
		}
	}

	return (
		<div className="flex gap-4 overflow-x-auto pb-4">
			{columnState.map((column) => {
				const columnTasks = getTasksForColumn(column.id);
				return (
					<div
						key={column.id}
						className="flex-shrink-0 w-80"
						style={{ minWidth: "320px" }}
					>
						<Card>
							<CardHeader className="pb-3">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										{column.color && (
											<div
												className="w-3 h-3 rounded-full"
												style={{ backgroundColor: column.color }}
											/>
										)}
										<CardTitle className="text-sm font-medium">
											{column.name}
										</CardTitle>
										<Badge variant="secondary" className="text-xs">
											{columnTasks.length}
										</Badge>
									</div>
									<Button size="sm" variant="ghost" className="h-6 w-6 p-0">
										<MoreVertical className="h-4 w-4" />
									</Button>
								</div>
							</CardHeader>
							<CardContent className="space-y-2">
								{columnTasks.map((task) => (
									<Card
										key={task.id}
										className="p-3 cursor-pointer hover:shadow-md transition-shadow"
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
											<div className="flex items-center justify-between text-xs text-muted-foreground">
												{task.dueDate && (
													<span>
														Due{" "}
														{new Date(task.dueDate).toLocaleDateString("en-US", {
															month: "short",
															day: "numeric",
														})}
													</span>
												)}
												<Badge variant="outline" className="text-xs">
													{task.status}
												</Badge>
											</div>
										</div>
									</Card>
								))}
									<Button
										variant="ghost"
										size="sm"
										className="w-full justify-start text-muted-foreground"
										onClick={() => handleAddTask(column.id)}
									>
										<Plus className="h-4 w-4 mr-2" />
										Add task
								</Button>
							</CardContent>
						</Card>
					</div>
				);
			})}
			<div className="flex-shrink-0 w-80">
				<Button
					variant="outline"
					className="w-full h-full min-h-[200px] border-dashed"
					onClick={handleAddColumn}
				>
					<Plus className="h-5 w-5 mr-2" />
					Add column
				</Button>
			</div>
		</div>
	);
}
