"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Notification } from "@/lib/db/schema";

interface NotificationsListProps {
	clientId: string;
	notifications: Notification[];
}

export function NotificationsList({ clientId, notifications }: NotificationsListProps) {
	const [items, setItems] = useState<Notification[]>(notifications);
	const [pendingItemId, setPendingItemId] = useState<string | null>(null);
	const [isMarkingAll, setIsMarkingAll] = useState(false);

	const unreadCount = useMemo(
		() => items.filter((item) => item.readAt === null).length,
		[items],
	);

	const sorted = useMemo(
		() =>
			[...items].sort((a, b) => {
				const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
				const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
				return bTime - aTime;
			}),
		[items],
	);

	async function markRead(notificationId: string) {
		setPendingItemId(notificationId);
		try {
			const response = await fetch("/api/notifications", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ clientId, notificationIds: [notificationId] }),
			});
			if (!response.ok) {
				throw new Error("Failed to mark notification as read");
			}

			setItems((prev) =>
				prev.map((item) =>
					item.id === notificationId && item.readAt === null
						? { ...item, readAt: new Date() }
						: item,
				),
			);
		} catch (error) {
			console.error("[notifications] markRead failed", error);
		} finally {
			setPendingItemId(null);
		}
	}

	async function markAllUnreadAsRead() {
		setIsMarkingAll(true);
		try {
			const response = await fetch("/api/notifications", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ clientId, markAllUnread: true }),
			});
			if (!response.ok) {
				throw new Error("Failed to mark all notifications as read");
			}

			setItems((prev) =>
				prev.map((item) =>
					item.readAt === null ? { ...item, readAt: new Date() } : item,
				),
			);
		} catch (error) {
			console.error("[notifications] markAllUnreadAsRead failed", error);
		} finally {
			setIsMarkingAll(false);
		}
	}

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between gap-4">
				<CardTitle>Inbox</CardTitle>
				<Button
					variant="outline"
					size="sm"
					onClick={markAllUnreadAsRead}
					disabled={isMarkingAll || unreadCount === 0}
				>
					{isMarkingAll ? "Marking..." : "Mark all unread as read"}
				</Button>
			</CardHeader>
			<CardContent className="p-0">
				{sorted.length === 0 ? (
					<div className="px-4 py-10 text-sm text-center text-muted-foreground">
						No notifications yet
					</div>
				) : (
					<div className="divide-y divide-border">
						{sorted.map((item) => {
							const isUnread = item.readAt === null;
							const isPending = pendingItemId === item.id;
							return (
								<div
									key={item.id}
									className="px-4 py-4 flex items-start justify-between gap-4"
								>
									<div className="min-w-0 space-y-1">
										<div className="flex items-center gap-2">
											<p className="font-medium text-sm">{item.title}</p>
											<Badge variant={isUnread ? "secondary" : "outline"}>
												{isUnread ? "Unread" : "Read"}
											</Badge>
										</div>
										<p className="text-sm text-muted-foreground">{item.body}</p>
										<p className="text-xs text-muted-foreground">
											{item.createdAt
												? new Date(item.createdAt).toLocaleString()
												: ""}
										</p>
									</div>
									{isUnread ? (
										<Button
											size="sm"
											variant="ghost"
											onClick={() => markRead(item.id)}
											disabled={isPending}
										>
											{isPending ? "Saving..." : "Mark read"}
										</Button>
									) : null}
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
