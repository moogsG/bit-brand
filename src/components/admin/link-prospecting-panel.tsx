"use client";

import { Loader2, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface LinkProspect {
	id: string;
	domain: string;
	url: string | null;
	lifecycleState: string;
	deterministicScore: number;
	contactName: string | null;
	contactEmail: string | null;
}

interface LinkOutreachDraft {
	id: string;
	prospectId: string;
	prospectDomain: string;
	subject: string;
	status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "SENT" | "FAILED";
	approvalId: string | null;
	sentAt: string | null;
}

interface ApiResponse<T> {
	success: boolean;
	data: T | null;
	error: { message?: string } | null;
}

interface LinkProspectingPanelProps {
	clientId: string;
}

export function LinkProspectingPanel({ clientId }: LinkProspectingPanelProps) {
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [prospects, setProspects] = useState<LinkProspect[]>([]);
	const [drafts, setDrafts] = useState<LinkOutreachDraft[]>([]);

	const [newDomain, setNewDomain] = useState("");
	const [newUrl, setNewUrl] = useState("");
	const [newRelevance, setNewRelevance] = useState("70");
	const [newAuthority, setNewAuthority] = useState("60");

	const [selectedProspectId, setSelectedProspectId] = useState("");
	const [newSubject, setNewSubject] = useState("");
	const [newBody, setNewBody] = useState("");

	const load = useCallback(
		async (mode: "initial" | "refresh" = "refresh") => {
			setError(null);
			if (mode === "initial") {
				setLoading(true);
			} else {
				setRefreshing(true);
			}

			try {
				const [prospectsRes, draftsRes] = await Promise.all([
					fetch(`/api/links/prospects?clientId=${encodeURIComponent(clientId)}`),
					fetch(`/api/links/outreach?clientId=${encodeURIComponent(clientId)}`),
				]);

				const prospectsJson =
					(await prospectsRes.json()) as ApiResponse<LinkProspect[]>;
				const draftsJson = (await draftsRes.json()) as ApiResponse<LinkOutreachDraft[]>;

				if (!prospectsRes.ok || !prospectsJson.success || !prospectsJson.data) {
					throw new Error(prospectsJson.error?.message ?? "Failed to load prospects");
				}
				if (!draftsRes.ok || !draftsJson.success || !draftsJson.data) {
					throw new Error(draftsJson.error?.message ?? "Failed to load outreach drafts");
				}

				const prospectsData = prospectsJson.data;
				const draftsData = draftsJson.data;

				setProspects(prospectsData);
				setDrafts(draftsData);
				setSelectedProspectId((current) => {
					if (current && prospectsData.some((prospect) => prospect.id === current)) {
						return current;
					}
					return prospectsData[0]?.id ?? "";
				});
			} catch (loadError) {
				setError(
					loadError instanceof Error ? loadError.message : "Failed to load links data",
				);
			} finally {
				setLoading(false);
				setRefreshing(false);
			}
		},
		[clientId],
	);

	useEffect(() => {
		void load("initial");
	}, [load]);

	const prospectById = useMemo(
		() => new Map(prospects.map((prospect) => [prospect.id, prospect])),
		[prospects],
	);

	const handleCreateProspect = async () => {
		setSubmitting(true);
		setError(null);
		setNotice(null);

		try {
			const res = await fetch("/api/links/prospects", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					clientId,
					domain: newDomain,
					url: newUrl || null,
					relevanceScore: Number(newRelevance),
					authorityScore: Number(newAuthority),
				}),
			});

			const json = (await res.json()) as ApiResponse<LinkProspect>;
			if (!res.ok || !json.success) {
				throw new Error(json.error?.message ?? "Failed to create prospect");
			}

			setNewDomain("");
			setNewUrl("");
			setNotice("Link prospect created.");
			await load();
		} catch (createError) {
			setError(
				createError instanceof Error
					? createError.message
					: "Failed to create prospect",
			);
		} finally {
			setSubmitting(false);
		}
	};

	const handleCreateDraft = async () => {
		if (!selectedProspectId) {
			setError("Select a prospect before creating a draft.");
			return;
		}

		setSubmitting(true);
		setError(null);
		setNotice(null);

		try {
			const res = await fetch("/api/links/outreach", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					clientId,
					prospectId: selectedProspectId,
					subject: newSubject,
					body: newBody,
				}),
			});

			const json = (await res.json()) as ApiResponse<LinkOutreachDraft>;
			if (!res.ok || !json.success) {
				throw new Error(json.error?.message ?? "Failed to create outreach draft");
			}

			setNewSubject("");
			setNewBody("");
			setNotice("Outreach draft created.");
			await load();
		} catch (createError) {
			setError(
				createError instanceof Error
					? createError.message
					: "Failed to create outreach draft",
			);
		} finally {
			setSubmitting(false);
		}
	};

	const handleRequestApproval = async (draftId: string) => {
		setSubmitting(true);
		setError(null);
		setNotice(null);

		try {
			const res = await fetch(
				`/api/links/outreach/${encodeURIComponent(draftId)}/request-approval`,
				{ method: "POST" },
			);
			const json = (await res.json()) as ApiResponse<{
				approvalId?: string;
			}>;
			if (!res.ok || !json.success) {
				throw new Error(json.error?.message ?? "Failed to request approval");
			}

			setNotice("Approval requested for outreach send.");
			await load();
		} catch (requestError) {
			setError(
				requestError instanceof Error
					? requestError.message
					: "Failed to request approval",
			);
		} finally {
			setSubmitting(false);
		}
	};

	const handleSend = async (draftId: string) => {
		setSubmitting(true);
		setError(null);
		setNotice(null);

		try {
			const res = await fetch(`/api/links/outreach/${encodeURIComponent(draftId)}/send`, {
				method: "POST",
			});
			const json = (await res.json()) as ApiResponse<{ sent: boolean }>;
			if (!res.ok || !json.success) {
				throw new Error(json.error?.message ?? "Failed to send outreach draft");
			}

			setNotice("Outreach draft sent (safe stub).");
			await load();
		} catch (sendError) {
			setError(
				sendError instanceof Error ? sendError.message : "Failed to send outreach draft",
			);
		} finally {
			setSubmitting(false);
		}
	};

	if (loading) {
		return (
			<Card>
				<CardContent className="py-10 text-sm text-muted-foreground">
					Loading links workflow...
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			{error ? (
				<div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{error}
				</div>
			) : null}
			{notice ? (
				<div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
					{notice}
				</div>
			) : null}

			<Card>
				<CardHeader className="flex flex-row items-center justify-between gap-3">
					<CardTitle>Prospects</CardTitle>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => void load()}
						disabled={refreshing || submitting}
					>
						{refreshing ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<RefreshCw className="mr-2 h-4 w-4" />
						)}
						Refresh
					</Button>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-3 md:grid-cols-2">
						<div>
							<Label htmlFor="new-domain">Domain</Label>
							<Input
								id="new-domain"
								placeholder="example.com"
								value={newDomain}
								onChange={(event) => setNewDomain(event.target.value)}
							/>
						</div>
						<div>
							<Label htmlFor="new-url">URL (optional)</Label>
							<Input
								id="new-url"
								placeholder="https://example.com/guest-posts"
								value={newUrl}
								onChange={(event) => setNewUrl(event.target.value)}
							/>
						</div>
						<div>
							<Label htmlFor="new-relevance">Relevance Score (0-100)</Label>
							<Input
								id="new-relevance"
								type="number"
								min={0}
								max={100}
								value={newRelevance}
								onChange={(event) => setNewRelevance(event.target.value)}
							/>
						</div>
						<div>
							<Label htmlFor="new-authority">Authority Score (0-100)</Label>
							<Input
								id="new-authority"
								type="number"
								min={0}
								max={100}
								value={newAuthority}
								onChange={(event) => setNewAuthority(event.target.value)}
							/>
						</div>
					</div>
					<Button
						type="button"
						onClick={() => void handleCreateProspect()}
						disabled={submitting || !newDomain.trim()}
					>
						{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
						Create Prospect
					</Button>

					<div className="overflow-x-auto rounded-md border">
						<table className="min-w-full text-sm">
							<thead className="bg-muted/50">
								<tr>
									<th className="px-3 py-2 text-left font-medium">Domain</th>
									<th className="px-3 py-2 text-left font-medium">Lifecycle</th>
									<th className="px-3 py-2 text-left font-medium">Score</th>
								</tr>
							</thead>
							<tbody>
								{prospects.length === 0 ? (
									<tr>
										<td className="px-3 py-4 text-muted-foreground" colSpan={3}>
											No prospects yet.
										</td>
									</tr>
								) : (
									prospects.map((prospect) => (
										<tr key={prospect.id} className="border-t">
											<td className="px-3 py-2">
												<div className="font-medium">{prospect.domain}</div>
												<div className="text-xs text-muted-foreground">
													{prospect.url ?? "—"}
												</div>
											</td>
											<td className="px-3 py-2">
												<Badge variant="outline">{prospect.lifecycleState}</Badge>
											</td>
											<td className="px-3 py-2">{prospect.deterministicScore}</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Outreach Drafts</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-3">
						<div>
							<Label htmlFor="prospect-select">Prospect</Label>
							<select
								id="prospect-select"
								className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
								value={selectedProspectId}
								onChange={(event) => setSelectedProspectId(event.target.value)}
							>
								<option value="">Select prospect</option>
								{prospects.map((prospect) => (
									<option key={prospect.id} value={prospect.id}>
										{prospect.domain} (score {prospect.deterministicScore})
									</option>
								))}
							</select>
						</div>
						<div>
							<Label htmlFor="draft-subject">Subject</Label>
							<Input
								id="draft-subject"
								placeholder="Quick collaboration idea for your audience"
								value={newSubject}
								onChange={(event) => setNewSubject(event.target.value)}
							/>
						</div>
						<div>
							<Label htmlFor="draft-body">Body</Label>
							<Textarea
								id="draft-body"
								placeholder="Hi team, we noticed your resource page on..."
								rows={6}
								value={newBody}
								onChange={(event) => setNewBody(event.target.value)}
							/>
						</div>
					</div>
					<Button
						type="button"
						onClick={() => void handleCreateDraft()}
						disabled={
							submitting || !selectedProspectId || !newSubject.trim() || !newBody.trim()
						}
					>
						{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
						Create Draft
					</Button>

					<div className="overflow-x-auto rounded-md border">
						<table className="min-w-full text-sm">
							<thead className="bg-muted/50">
								<tr>
									<th className="px-3 py-2 text-left font-medium">Prospect</th>
									<th className="px-3 py-2 text-left font-medium">Subject</th>
									<th className="px-3 py-2 text-left font-medium">Status</th>
									<th className="px-3 py-2 text-left font-medium">Actions</th>
								</tr>
							</thead>
							<tbody>
								{drafts.length === 0 ? (
									<tr>
										<td className="px-3 py-4 text-muted-foreground" colSpan={4}>
											No outreach drafts yet.
										</td>
									</tr>
								) : (
									drafts.map((draft) => {
										const approved = draft.status === "APPROVED" || draft.status === "SENT";
										const prospect = prospectById.get(draft.prospectId);
										return (
											<tr key={draft.id} className="border-t">
												<td className="px-3 py-2">{prospect?.domain ?? draft.prospectDomain}</td>
												<td className="px-3 py-2">{draft.subject}</td>
												<td className="px-3 py-2">
													<Badge variant="outline">{draft.status}</Badge>
												</td>
												<td className="px-3 py-2">
													<div className="flex flex-wrap gap-2">
														<Button
															type="button"
															size="sm"
															variant="outline"
															onClick={() => void handleRequestApproval(draft.id)}
															disabled={
																submitting || draft.status === "PENDING_APPROVAL" || draft.status === "SENT"
															}
														>
															<ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
															Request Approval
														</Button>
														<Button
															type="button"
															size="sm"
															onClick={() => void handleSend(draft.id)}
															disabled={submitting || !approved || draft.status === "SENT"}
														>
															<Send className="mr-1.5 h-3.5 w-3.5" />
															Send
														</Button>
													</div>
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
