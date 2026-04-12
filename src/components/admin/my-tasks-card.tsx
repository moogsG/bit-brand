"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Circle, Clock } from "lucide-react";
import type { Task } from "@/lib/db/schema";
import Link from "next/link";

interface MyTasksCardProps {
	tasks: Task[];
	userId: string;
}

export function MyTasksCard({ tasks, userId }: MyTasksCardProps) {
	const myTasks = tasks.filter((t) => t.assignedTo === userId);
	const pendingTasks = myTasks.filter(
		(t) => t.status !== "DONE" && t.status !== "BLOCKED",
	);

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "DONE":
				return <CheckSquare className="h-4 w-4 text-green-600" />;
			case "IN_PROGRESS":
				return <Clock className="h-4 w-4 text-blue-600" />;
			default:
				return <Circle className="h-4 w-4 text-muted-foreground" />;
		}
	};

	const getPriorityColor = (priority: string) => {
		switch (priority) {
			case "URGENT":
				return "destructive";
			case "HIGH":
				return "default";
			case "MEDIUM":
				return "secondary";
			default:
				return "outline";
		}
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<CheckSquare className="h-5 w-5" />
						My Tasks
					</CardTitle>
					<Badge variant="secondary">{pendingTasks.length}</Badge>
				</div>
			</CardHeader>
			<CardContent className="p-0">
				{pendingTasks.length === 0 ? (
					<div className="py-8 text-center text-muted-foreground text-sm px-4">
						No pending tasks
					</div>
				) : (
					<div className="divide-y divide-border">
						{pendingTasks.slice(0, 5).map((task) => (
							<div
								key={task.id}
								className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
							>
								<div className="min-w-0 flex-1 flex items-center gap-3">
									{getStatusIcon(task.status)}
									<div className="min-w-0">
										<p className="text-sm font-medium truncate">{task.title}</p>
										{task.dueDate && (
											<p className="text-xs text-muted-foreground">
												Due{" "}
												{new Date(task.dueDate).toLocaleDateString("en-US", {
													month: "short",
													day: "numeric",
												})}
											</p>
										)}
									</div>
								</div>
								<Badge
									variant={getPriorityColor(task.priority) as any}
									className="ml-4 flex-shrink-0"
								>
									{task.priority}
								</Badge>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
