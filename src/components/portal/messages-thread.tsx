"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ClientMessage } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

interface MessageRecipientOption {
	id: string;
	name: string;
	email: string;
}

interface MessagesThreadProps {
	messages: ClientMessage[];
	clientId: string;
	currentRole?: "ADMIN" | "CLIENT";
	recipientOptions?: MessageRecipientOption[];
}

export function MessagesThread({
	messages,
	clientId,
	currentRole = "CLIENT",
	recipientOptions = [],
}: MessagesThreadProps) {
	const [items, setItems] = useState<ClientMessage[]>(messages);
	const [input, setInput] = useState("");
	const [sending, setSending] = useState(false);
	const [recipientScope, setRecipientScope] = useState<"TEAM" | "MEMBERS">("TEAM");
	const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);

	const recipientNameMap = useMemo(
		() => new Map(recipientOptions.map((option) => [option.id, option.name])),
		[recipientOptions],
	);

	function parseRecipientIds(value: string | null | undefined): string[] {
		if (!value) return [];
		try {
			const parsed = JSON.parse(value);
			if (!Array.isArray(parsed)) return [];
			return parsed.filter(
				(id): id is string => typeof id === "string" && id.trim().length > 0,
			);
		} catch {
			return [];
		}
	}

	function getRecipientDisplay(message: ClientMessage): string {
		if (message.recipientScope === "TEAM") {
			return "Whole team";
		}

		const recipientIds = parseRecipientIds(message.recipientUserIds);
		if (recipientIds.length === 0) return "Selected team members";

		return recipientIds
			.map((id) => recipientNameMap.get(id) ?? "Unknown member")
			.join(", ");
	}

	// Sort ascending for display
	const sorted = useMemo(
		() =>
			[...items].sort(
				(a, b) =>
					(a.createdAt ? a.createdAt.getTime() : 0) -
					(b.createdAt ? b.createdAt.getTime() : 0),
			),
		[items],
	);

	useEffect(() => {
		setItems(messages);
	}, [messages]);

	async function handleSend() {
		if (!input.trim()) return;
		if (recipientScope === "MEMBERS" && selectedRecipientIds.length === 0) return;
		setSending(true);
		const optimistic: ClientMessage = {
			id: `temp-${Date.now()}`,
			clientId,
			body: input.trim(),
			createdAt: new Date(),
			senderId: "me",
			senderRole: currentRole,
			recipientScope,
			recipientUserIds: JSON.stringify(
				recipientScope === "TEAM" ? [] : selectedRecipientIds,
			),
			readAt: null,
		};
		setItems((prev) => [...prev, optimistic]);
		setInput("");

		try {
			const res = await fetch("/api/messages", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					clientId,
					message: optimistic.body,
					recipientScope,
					recipientUserIds:
						recipientScope === "TEAM" ? [] : selectedRecipientIds,
				}),
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
								<span>•</span>
								<span>To: {getRecipientDisplay(msg)}</span>
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
					{recipientOptions.length > 0 && (
						<div className="space-y-2 rounded-md border border-border p-3">
							<p className="text-xs font-medium text-muted-foreground">Recipients</p>
							<div className="flex gap-2">
								<Button
									type="button"
									variant={recipientScope === "TEAM" ? "default" : "outline"}
									size="sm"
									onClick={() => {
										setRecipientScope("TEAM");
										setSelectedRecipientIds([]);
									}}
								>
									Whole team
								</Button>
								<Button
									type="button"
									variant={recipientScope === "MEMBERS" ? "default" : "outline"}
									size="sm"
									onClick={() => setRecipientScope("MEMBERS")}
								>
									Team members
								</Button>
							</div>
							{recipientScope === "MEMBERS" && (
								<div className="space-y-1">
									{recipientOptions.map((option) => {
										const checked = selectedRecipientIds.includes(option.id);
										return (
											<label
												key={option.id}
												className="flex items-center gap-2 text-xs"
											>
												<input
													type="checkbox"
													checked={checked}
													onChange={(event) => {
														setSelectedRecipientIds((prev) => {
															if (event.target.checked) {
																return [...prev, option.id];
															}
															return prev.filter((id) => id !== option.id);
														});
													}}
												/>
												<span>
													{option.name} ({option.email})
												</span>
											</label>
										);
									})}
								</div>
							)}
						</div>
					)}
					<Textarea
						id="message-input"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="Write your update or question..."
						rows={3}
					/>
					<Button
						onClick={handleSend}
						disabled={
							sending ||
							!input.trim() ||
							(recipientScope === "MEMBERS" && selectedRecipientIds.length === 0)
						}
					>
						{sending ? "Sending..." : "Send"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
