"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ClientMessage } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

interface MessagesThreadProps {
	messages: ClientMessage[];
	clientId: string;
	currentRole?: "ADMIN" | "CLIENT";
}

export function MessagesThread({
	messages,
	clientId,
	currentRole = "CLIENT",
}: MessagesThreadProps) {
	const [items, setItems] = useState<ClientMessage[]>(messages);
	const [input, setInput] = useState("");
	const [sending, setSending] = useState(false);

	// Sort ascending for display
	const sorted = useMemo(
		() => [...items].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
		[items],
	);

	useEffect(() => {
		setItems(messages);
	}, [messages]);

	async function handleSend() {
		if (!input.trim()) return;
		setSending(true);
		const optimistic: ClientMessage = {
			id: `temp-${Date.now()}`,
			clientId,
			body: input.trim(),
			createdAt: Date.now(),
			senderId: "me",
			senderRole: currentRole,
			readAt: null,
		};
		setItems((prev) => [...prev, optimistic]);
		setInput("");

		try {
			const res = await fetch("/api/messages", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ clientId, message: optimistic.body }),
			});
			if (!res.ok) {
				throw new Error(await res.text());
			}
			const saved = (await res.json()) as ClientMessage;
			setItems((prev) => [...prev.filter((m) => !m.id.startsWith("temp-")), saved]);
		} catch (error) {
			console.error("Failed to send message", error);
			// remove optimistic on failure
			setItems((prev) => prev.filter((m) => !m.id.startsWith("temp-")));
		} finally {
			setSending(false);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Conversation</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="max-h-[420px] overflow-y-auto space-y-3 pr-2">
					{sorted.length === 0 ? (
						<p className="text-sm text-muted-foreground">No messages yet.</p>
					) : (
						sorted.map((msg) => {
							const isMine = msg.senderRole === currentRole || msg.senderId === "me";
							const roleLabel = msg.senderRole === "ADMIN" ? "Team" : "Client";
							return (
								<div key={msg.id} className={cn("flex flex-col gap-1") }>
									<div className={cn("text-xs text-muted-foreground", "flex gap-2 items-center") }>
										<span>{isMine ? "You" : roleLabel}</span>
										{msg.createdAt && (
											<span>
												{new Date(msg.createdAt).toLocaleString()}
											</span>
										)}
									</div>
									<div
										className={cn(
											"rounded-lg border px-3 py-2 text-sm",
											msg.senderRole === "ADMIN"
												? "bg-indigo-50 border-indigo-100 text-indigo-900"
												: "bg-muted border-border",
										)}
									>
										{msg.body}
									</div>
								</div>
							);
						})
					)}
				</div>
				<div className="space-y-2">
					<label className="text-sm font-medium" htmlFor="message-input">
						Send a message
					</label>
					<Textarea
						id="message-input"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="Write your update or question..."
						rows={3}
					/>
					<Button onClick={handleSend} disabled={sending || !input.trim()}>
						{sending ? "Sending..." : "Send"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
