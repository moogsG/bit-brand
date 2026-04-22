"use client";

import {
	Copy,
	Loader2,
	Play,
	RefreshCw,
	RotateCcw,
	ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

interface ExecutionSummary {
	id: string;
	status: "RUNNING" | "SUCCEEDED" | "FAILED" | "ROLLED_BACK";
	error: string | null;
	startedAt: string | Date;
	completedAt: string | Date | null;
}

interface RollbackSummary {
	id: string;
	status: "RUNNING" | "SUCCEEDED" | "FAILED";
	error: string | null;
	createdAt: string | Date;
	completedAt: string | Date | null;
}

interface ProposalTimelineEvent {
	id: string;
	type: "APPROVAL" | "EXECUTION" | "ROLLBACK";
	status: string;
	label: string;
	occurredAt: string | Date | null;
	message?: string | null;
}

interface ProposalApprovalSummary {
	id: string;
	status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
	metadata?: Record<string, unknown>;
	requestedAt: string | Date | null;
	resolvedAt: string | Date | null;
}

interface ProposalRow {
	id: string;
	provider: string;
	title: string;
	description: string | null;
	status:
		| "DRAFT"
		| "PENDING_APPROVAL"
		| "APPROVED"
		| "EXECUTING"
		| "EXECUTED"
		| "FAILED"
		| "ROLLED_BACK";
	approvalStatus: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "NONE";
	approval?: ProposalApprovalSummary | null;
	operation?: string | null;
	proposal?: Record<string, unknown>;
	beforeSnapshot?: Record<string, unknown> | null;
	afterPreview?: Record<string, unknown> | null;
	proposedPayload?: Record<string, unknown> | null;
	latestExecution: ExecutionSummary | null;
	latestRollback?: RollbackSummary | null;
	targetRef?: string | null;
	executionHistory?: ExecutionSummary[];
	rollbackHistory?: RollbackSummary[];
	timeline?: ProposalTimelineEvent[];
	updatedAt: string | Date;
}

interface QueueResponse {
	success: boolean;
	data: {
		clientId: string;
		proposals: ProposalRow[];
	} | null;
	error: {
		message: string;
	} | null;
}

interface ProposalDetailResponse {
	success: boolean;
	data: {
		clientId: string;
		proposal: ProposalRow;
	} | null;
	error: {
		message: string;
	} | null;
}

interface ActionResponse {
	success: boolean;
	data?: {
		sharedApprovalId?: string | null;
		requestedCount?: number;
		skippedCount?: number;
		results?: Array<{
			proposalId: string;
			status: "REQUESTED" | "SKIPPED" | "SUCCEEDED" | "FAILED";
			reason?: string;
			message?: string;
			errorCode?: string;
		}>;
		summary?: {
			total: number;
			succeeded: number;
			failed: number;
		};
	};
	error?: {
		message?: string;
	};
}

interface ImplementationQueuePanelProps {
	clientId: string;
}

function toDateString(value: string | Date | null | undefined): string {
	if (!value) {
		return "—";
	}
	return new Date(value).toLocaleString();
}

function parseProposalJson(value: string): Record<string, unknown> {
	const trimmed = value.trim();
	if (!trimmed) {
		return {};
	}

	const parsed = JSON.parse(trimmed) as unknown;
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error("Proposal JSON must be an object");
	}

	return parsed as Record<string, unknown>;
}

function toPrettyJson(value: unknown): string {
	return JSON.stringify(value ?? {}, null, 2);
}

export function ImplementationQueuePanel({
	clientId,
}: ImplementationQueuePanelProps) {
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [proposals, setProposals] = useState<ProposalRow[]>([]);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [detailsProposalId, setDetailsProposalId] = useState<string | null>(
		null,
	);
	const [detailsProposal, setDetailsProposal] = useState<ProposalRow | null>(
		null,
	);
	const [detailsLoading, setDetailsLoading] = useState(false);
	const [detailsError, setDetailsError] = useState<string | null>(null);
	const [allowRerun, setAllowRerun] = useState(false);
	const [dryRun, setDryRun] = useState(true);

	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [proposalJson, setProposalJson] = useState("{}");

	const load = useCallback(
		async (mode: "initial" | "refresh" = "refresh") => {
			setError(null);
			if (mode === "initial") {
				setLoading(true);
			} else {
				setRefreshing(true);
			}

			try {
				const res = await fetch(
					`/api/implementation-queue/proposals?clientId=${encodeURIComponent(clientId)}`,
				);
				const json = (await res.json()) as QueueResponse;
				if (!res.ok || !json.success || !json.data) {
					throw new Error(
						json.error?.message ?? "Failed to load implementation queue",
					);
				}

				setProposals(json.data.proposals);
				setSelectedIds((current) =>
					current.filter((proposalId) =>
						json.data?.proposals.some((proposal) => proposal.id === proposalId),
					),
				);
			} catch (loadError) {
				setError(
					loadError instanceof Error
						? loadError.message
						: "Failed to load implementation queue",
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

	useEffect(() => {
		if (
			detailsProposalId &&
			!proposals.some((proposal) => proposal.id === detailsProposalId)
		) {
			setDetailsProposalId(null);
			setDetailsProposal(null);
		}
	}, [detailsProposalId, proposals]);

	useEffect(() => {
		if (!detailsProposalId) {
			setDetailsProposal(null);
			setDetailsLoading(false);
			setDetailsError(null);
			return;
		}

		let cancelled = false;
		const loadDetails = async () => {
			setDetailsLoading(true);
			setDetailsError(null);
			try {
				const res = await fetch(
					`/api/implementation-queue/proposals/${encodeURIComponent(detailsProposalId)}?clientId=${encodeURIComponent(clientId)}`,
				);
				const json = (await res.json()) as ProposalDetailResponse;
				if (!res.ok || !json.success || !json.data?.proposal) {
					throw new Error(
						json.error?.message ??
							"Failed to load implementation proposal details",
					);
				}

				if (!cancelled) {
					setDetailsProposal(json.data.proposal);
				}
			} catch (loadDetailsError) {
				if (!cancelled) {
					setDetailsError(
						loadDetailsError instanceof Error
							? loadDetailsError.message
							: "Failed to load implementation proposal details",
					);
				}
			} finally {
				if (!cancelled) {
					setDetailsLoading(false);
				}
			}
		};

		void loadDetails();

		return () => {
			cancelled = true;
		};
	}, [clientId, detailsProposalId]);

	const selectedCount = selectedIds.length;
	const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
	const selectedProposals = useMemo(
		() => proposals.filter((proposal) => selectedSet.has(proposal.id)),
		[proposals, selectedSet],
	);
	const selectedApprovedCount = useMemo(
		() =>
			selectedProposals.filter(
				(proposal) => proposal.approvalStatus === "APPROVED",
			).length,
		[selectedProposals],
	);
	const selectedApprovedIds = useMemo(
		() =>
			selectedProposals
				.filter((proposal) => proposal.approvalStatus === "APPROVED")
				.map((proposal) => proposal.id),
		[selectedProposals],
	);

	const copyJson = async (value: unknown, label: string) => {
		try {
			await navigator.clipboard.writeText(toPrettyJson(value));
			setNotice(`${label} copied to clipboard.`);
		} catch {
			setError(`Failed to copy ${label.toLowerCase()}.`);
		}
	};

	const handleCreateProposal = async () => {
		setSubmitting(true);
		setError(null);
		setNotice(null);
		try {
			const parsedProposal = parseProposalJson(proposalJson);
			const res = await fetch("/api/implementation-queue/proposals", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					clientId,
					title,
					description,
					proposal: parsedProposal,
				}),
			});

			const json = (await res.json()) as QueueResponse;
			if (!res.ok || !json.success) {
				throw new Error(json.error?.message ?? "Failed to create proposal");
			}

			setTitle("");
			setDescription("");
			setProposalJson("{}");
			setNotice("Implementation proposal created.");
			await load();
		} catch (createError) {
			setError(
				createError instanceof Error
					? createError.message
					: "Failed to create proposal",
			);
		} finally {
			setSubmitting(false);
		}
	};

	const handleRequestApproval = async (proposalIds: string[]) => {
		setSubmitting(true);
		setError(null);
		setNotice(null);
		try {
			const res = await fetch(
				"/api/implementation-queue/proposals/request-approval",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ clientId, proposalIds }),
				},
			);
			const json = (await res.json()) as ActionResponse;
			if (!res.ok || !json.success) {
				throw new Error(json.error?.message ?? "Failed to request approval");
			}

			const requestedCount = json.data?.requestedCount ?? 0;
			const skippedCount = json.data?.skippedCount ?? 0;
			const sharedApprovalId = json.data?.sharedApprovalId;
			setNotice(
				requestedCount > 0
					? `Approval requested for ${requestedCount} proposal${requestedCount === 1 ? "" : "s"}${sharedApprovalId ? ` (shared approval ${sharedApprovalId.slice(0, 8)})` : ""}${skippedCount > 0 ? `. ${skippedCount} skipped.` : "."}`
					: `No approvals requested. ${skippedCount} proposal${skippedCount === 1 ? "" : "s"} skipped.`,
			);

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

	const handleExecute = async (proposalId: string, rerun = false) => {
		setSubmitting(true);
		setError(null);
		setNotice(null);
		try {
			const res = await fetch(
				`/api/implementation-queue/proposals/${proposalId}/execute`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ rerun, dryRun }),
				},
			);
			const json = (await res.json()) as ActionResponse;
			if (!res.ok || !json.success) {
				throw new Error(json.error?.message ?? "Failed to execute proposal");
			}

			setNotice(
				rerun
					? "Proposal re-run started/executed successfully."
					: "Proposal execution started/executed successfully.",
			);

			await load();
		} catch (executeError) {
			setError(
				executeError instanceof Error
					? executeError.message
					: "Failed to execute proposal",
			);
		} finally {
			setSubmitting(false);
		}
	};

	const handleRollback = async (executionId: string) => {
		setSubmitting(true);
		setError(null);
		setNotice(null);
		try {
			const res = await fetch(
				`/api/implementation-queue/executions/${executionId}/rollback`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ reason: "Manual admin rollback" }),
				},
			);
			const json = (await res.json()) as QueueResponse;
			if (!res.ok || !json.success) {
				throw new Error(json.error?.message ?? "Failed to rollback execution");
			}

			setNotice("Rollback request completed.");

			await load();
		} catch (rollbackError) {
			setError(
				rollbackError instanceof Error
					? rollbackError.message
					: "Failed to rollback execution",
			);
		} finally {
			setSubmitting(false);
		}
	};

	const handleBatchExecute = async (proposalIds: string[]) => {
		setSubmitting(true);
		setError(null);
		setNotice(null);

		try {
			const res = await fetch("/api/implementation-queue/proposals/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					clientId,
					proposalIds,
					rerun: allowRerun,
					dryRun,
				}),
			});

			const json = (await res.json()) as ActionResponse;
			if (!res.ok || !json.success || !json.data?.summary) {
				throw new Error(
					json.error?.message ?? "Failed to execute selected proposals",
				);
			}

			const summary = json.data.summary;
			setNotice(
				`Batch execution finished. ${summary.succeeded}/${summary.total} succeeded, ${summary.failed} failed.`,
			);
			await load();
		} catch (batchError) {
			setError(
				batchError instanceof Error
					? batchError.message
					: "Failed to execute selected proposals",
			);
		} finally {
			setSubmitting(false);
		}
	};

	if (loading) {
		return (
			<Card>
				<CardContent className="py-12">
					<div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading implementation queue…
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>Create Proposal</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{error ? (
						<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
							{error}
						</div>
					) : null}
					{notice ? (
						<div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
							{notice}
						</div>
					) : null}
					<div className="space-y-1.5">
						<Label htmlFor="implementation-title">Title</Label>
						<Input
							id="implementation-title"
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							placeholder="Phase 3 kickoff slice"
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="implementation-description">Description</Label>
						<Textarea
							id="implementation-description"
							rows={3}
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							placeholder="Small, safe implementation slice for rollout."
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="implementation-json">Proposal JSON</Label>
						<Textarea
							id="implementation-json"
							rows={5}
							value={proposalJson}
							onChange={(event) => setProposalJson(event.target.value)}
							placeholder='{"scope":"phase-3-kickoff"}'
						/>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							onClick={handleCreateProposal}
							disabled={submitting || !title.trim()}
						>
							{submitting ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : null}
							Create Proposal
						</Button>
						<Button
							variant="outline"
							onClick={() => void load()}
							disabled={refreshing || submitting}
						>
							<RefreshCw
								className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
							/>
							{refreshing ? "Refreshing…" : "Refresh"}
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="space-y-2">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<CardTitle>Implementation Queue</CardTitle>
						<div className="flex flex-wrap items-center gap-2">
							<Button
								variant="outline"
								disabled={selectedCount === 0 || submitting}
								onClick={() => void handleRequestApproval(selectedIds)}
							>
								<ShieldCheck className="mr-2 h-4 w-4" />
								Request approval ({selectedCount})
							</Button>
							<Button
								disabled={selectedApprovedCount === 0 || submitting}
								onClick={() => void handleBatchExecute(selectedApprovedIds)}
							>
								<Play className="mr-2 h-4 w-4" />
								Execute approved ({selectedApprovedCount})
							</Button>
						</div>
					</div>
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<input
							id="dry-run"
							type="checkbox"
							checked={dryRun}
							onChange={(event) => setDryRun(event.target.checked)}
						/>
						<Label htmlFor="dry-run" className="text-xs font-normal">
							Dry run mode (recommended; no live provider writes)
						</Label>
					</div>
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<input
							id="allow-rerun"
							type="checkbox"
							checked={allowRerun}
							onChange={(event) => setAllowRerun(event.target.checked)}
						/>
						<Label htmlFor="allow-rerun" className="text-xs font-normal">
							Allow explicit re-run for already executed proposals
						</Label>
					</div>
				</CardHeader>
				<CardContent>
					{proposals.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No proposals yet. Create your first proposal above.
						</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-border text-left">
										<th className="px-2 py-2 font-medium text-muted-foreground">
											Sel
										</th>
										<th className="px-2 py-2 font-medium text-muted-foreground">
											Proposal
										</th>
										<th className="px-2 py-2 font-medium text-muted-foreground">
											Status
										</th>
										<th className="px-2 py-2 font-medium text-muted-foreground">
											Approval
										</th>
										<th className="px-2 py-2 font-medium text-muted-foreground">
											Timeline
										</th>
										<th className="px-2 py-2 font-medium text-muted-foreground">
											Actions
										</th>
									</tr>
								</thead>
								<tbody>
									{proposals.map((proposal) => (
										<tr
											key={proposal.id}
											className="border-b border-border/60 align-top"
										>
											<td className="px-2 py-3">
												<input
													type="checkbox"
													checked={selectedSet.has(proposal.id)}
													onChange={(event) => {
														setSelectedIds((current) => {
															if (event.target.checked) {
																return [...current, proposal.id];
															}
															return current.filter((id) => id !== proposal.id);
														});
													}}
												/>
											</td>
											<td className="px-2 py-3">
												<p className="font-medium">{proposal.title}</p>
												{proposal.description ? (
													<p className="text-xs text-muted-foreground">
														{proposal.description}
													</p>
												) : null}
												{proposal.targetRef ? (
													<p className="text-xs text-muted-foreground">
														Target: {proposal.targetRef}
													</p>
												) : null}
												<p className="text-xs text-muted-foreground">
													Updated {toDateString(proposal.updatedAt)}
												</p>
											</td>
											<td className="px-2 py-3">
												<Badge variant="secondary">{proposal.status}</Badge>
											</td>
											<td className="px-2 py-3">
												<Badge
													variant={
														proposal.approvalStatus === "APPROVED"
															? "default"
															: "outline"
													}
												>
													{proposal.approvalStatus}
												</Badge>
											</td>
											<td className="px-2 py-3 text-xs text-muted-foreground">
												{proposal.timeline && proposal.timeline.length > 0 ? (
													<div className="space-y-1">
														{proposal.timeline.slice(0, 4).map((event) => (
															<div
																key={event.id}
																className="rounded border border-border/60 px-2 py-1"
															>
																<p className="font-medium text-foreground">
																	{event.label} • {event.status}
																</p>
																<p>{toDateString(event.occurredAt)}</p>
																{event.message ? (
																	<p className="text-destructive">
																		{event.message}
																	</p>
																) : null}
															</div>
														))}
													</div>
												) : (
													"—"
												)}
											</td>
											<td className="px-2 py-3">
												<div className="flex flex-col gap-1.5">
													<Button
														size="sm"
														variant="ghost"
														onClick={() => setDetailsProposalId(proposal.id)}
													>
														Details
													</Button>
													<Button
														size="sm"
														variant="outline"
														onClick={() =>
															void handleRequestApproval([proposal.id])
														}
														disabled={submitting}
													>
														<ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
														Request Approval
													</Button>
													<Button
														size="sm"
														onClick={() =>
															void handleExecute(
																proposal.id,
																proposal.status === "EXECUTED" ||
																	proposal.status === "ROLLED_BACK",
															)
														}
														disabled={
															submitting ||
															proposal.approvalStatus !== "APPROVED" ||
															proposal.status === "EXECUTING"
														}
													>
														<Play className="mr-1.5 h-3.5 w-3.5" />
														{proposal.status === "EXECUTED" ||
														proposal.status === "ROLLED_BACK"
															? "Re-run"
															: "Execute"}
													</Button>
													<Button
														size="sm"
														variant="secondary"
														onClick={() =>
															proposal.latestExecution
																? void handleRollback(
																		proposal.latestExecution.id,
																	)
																: undefined
														}
														disabled={
															submitting ||
															!proposal.latestExecution ||
															proposal.latestExecution.status !== "SUCCEEDED"
														}
													>
														<RotateCcw className="mr-1.5 h-3.5 w-3.5" />
														Rollback
													</Button>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</CardContent>
			</Card>

			<Sheet
				open={Boolean(detailsProposalId)}
				onOpenChange={(open) => {
					if (!open) {
						setDetailsProposalId(null);
						setDetailsProposal(null);
					}
				}}
			>
				<SheetContent side="right" className="w-full sm:max-w-3xl">
					{detailsLoading ? (
						<div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin" />
							Loading proposal details…
						</div>
					) : detailsError ? (
						<div className="space-y-3 px-4 py-6 text-sm">
							<p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
								{detailsError}
							</p>
						</div>
					) : detailsProposal ? (
						<>
							<SheetHeader className="border-b border-border">
								<SheetTitle>Proposal Details</SheetTitle>
								<SheetDescription>
									Review before/after context and full audit trail.
								</SheetDescription>
							</SheetHeader>

							<div className="space-y-6 overflow-y-auto px-4 pb-6 text-sm">
								<section className="space-y-2 pt-2">
									<h3 className="font-medium">Metadata</h3>
									<div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-2">
										<div>
											<p className="text-xs text-muted-foreground">Title</p>
											<p className="font-medium">{detailsProposal.title}</p>
										</div>
										<div>
											<p className="text-xs text-muted-foreground">Target</p>
											<p>{detailsProposal.targetRef ?? "—"}</p>
										</div>
										<div>
											<p className="text-xs text-muted-foreground">Status</p>
											<p>{detailsProposal.status}</p>
										</div>
										<div>
											<p className="text-xs text-muted-foreground">Approval</p>
											<p>{detailsProposal.approvalStatus}</p>
										</div>
										<div>
											<p className="text-xs text-muted-foreground">Provider</p>
											<p>{detailsProposal.provider}</p>
										</div>
										<div>
											<p className="text-xs text-muted-foreground">Operation</p>
											<p>{detailsProposal.operation ?? "—"}</p>
										</div>
										<div>
											<p className="text-xs text-muted-foreground">Updated</p>
											<p>{toDateString(detailsProposal.updatedAt)}</p>
										</div>
										<div>
											<p className="text-xs text-muted-foreground">
												Approval requested at
											</p>
											<p>
												{toDateString(detailsProposal.approval?.requestedAt)}
											</p>
										</div>
									</div>
								</section>

								<section className="space-y-3">
									<h3 className="font-medium">Approval Context</h3>
									<div className="space-y-2 rounded-md border border-border p-3">
										<div className="flex items-center justify-between gap-2">
											<p className="font-medium">Approval Metadata</p>
											<Button
												variant="ghost"
												size="sm"
												onClick={() =>
													void copyJson(
														detailsProposal.approval?.metadata ?? {},
														"Approval metadata",
													)
												}
											>
												<Copy className="mr-1.5 h-3.5 w-3.5" />
												Copy
											</Button>
										</div>
										<pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs">
											{toPrettyJson(detailsProposal.approval?.metadata ?? {})}
										</pre>
									</div>
								</section>

								<section className="space-y-3">
									<h3 className="font-medium">Change Context</h3>
									<div className="grid gap-3 md:grid-cols-2">
										<div className="space-y-2 rounded-md border border-border p-3">
											<div className="flex items-center justify-between gap-2">
												<p className="font-medium">Before Snapshot</p>
												<Button
													variant="ghost"
													size="sm"
													onClick={() =>
														void copyJson(
															detailsProposal.beforeSnapshot ?? {},
															"Before snapshot",
														)
													}
												>
													<Copy className="mr-1.5 h-3.5 w-3.5" />
													Copy
												</Button>
											</div>
											<pre className="max-h-72 overflow-auto rounded bg-muted p-2 text-xs">
												{toPrettyJson(detailsProposal.beforeSnapshot ?? {})}
											</pre>
										</div>

										<div className="space-y-2 rounded-md border border-border p-3">
											<div className="flex items-center justify-between gap-2">
												<p className="font-medium">After Preview</p>
												<Button
													variant="ghost"
													size="sm"
													onClick={() =>
														void copyJson(
															detailsProposal.afterPreview ?? {},
															"After preview",
														)
													}
												>
													<Copy className="mr-1.5 h-3.5 w-3.5" />
													Copy
												</Button>
											</div>
											<pre className="max-h-72 overflow-auto rounded bg-muted p-2 text-xs">
												{toPrettyJson(detailsProposal.afterPreview ?? {})}
											</pre>
										</div>
									</div>

									<div className="space-y-2 rounded-md border border-border p-3">
										<div className="flex items-center justify-between gap-2">
											<p className="font-medium">Proposed Payload</p>
											<Button
												variant="ghost"
												size="sm"
												onClick={() =>
													void copyJson(
														detailsProposal.proposedPayload ??
															detailsProposal.proposal ??
															{},
														"Proposed payload",
													)
												}
											>
												<Copy className="mr-1.5 h-3.5 w-3.5" />
												Copy
											</Button>
										</div>
										<pre className="max-h-80 overflow-auto rounded bg-muted p-2 text-xs">
											{toPrettyJson(
												detailsProposal.proposedPayload ??
													detailsProposal.proposal ??
													{},
											)}
										</pre>
									</div>
								</section>

								<section className="space-y-2">
									<h3 className="font-medium">Audit Timeline</h3>
									{detailsProposal.timeline &&
									detailsProposal.timeline.length > 0 ? (
										<div className="space-y-2">
											{detailsProposal.timeline.map((event) => (
												<div
													key={event.id}
													className="rounded-md border border-border p-3"
												>
													<div className="flex flex-wrap items-center justify-between gap-2">
														<p className="font-medium">
															{event.label} • {event.status}
														</p>
														<p className="text-xs text-muted-foreground">
															{toDateString(event.occurredAt)}
														</p>
													</div>
													<p className="text-xs text-muted-foreground">
														{event.type}
													</p>
													{event.message ? (
														<p className="text-xs text-destructive">
															{event.message}
														</p>
													) : null}
												</div>
											))}
										</div>
									) : (
										<p className="text-sm text-muted-foreground">
											No audit events yet.
										</p>
									)}
								</section>

								<section className="space-y-2">
									<h3 className="font-medium">Execution History</h3>
									{detailsProposal.executionHistory &&
									detailsProposal.executionHistory.length > 0 ? (
										<div className="space-y-2">
											{detailsProposal.executionHistory.map((execution) => (
												<div
													key={execution.id}
													className="rounded-md border border-border p-3"
												>
													<div className="flex flex-wrap items-center justify-between gap-2">
														<p className="font-medium">{execution.status}</p>
														<p className="text-xs text-muted-foreground">
															Started {toDateString(execution.startedAt)}
														</p>
													</div>
													<p className="text-xs text-muted-foreground">
														Completed {toDateString(execution.completedAt)}
													</p>
													{execution.error ? (
														<p className="text-xs text-destructive">
															{execution.error}
														</p>
													) : null}
												</div>
											))}
										</div>
									) : (
										<p className="text-sm text-muted-foreground">
											No execution attempts yet.
										</p>
									)}
								</section>

								<section className="space-y-2">
									<h3 className="font-medium">Rollback History</h3>
									{detailsProposal.rollbackHistory &&
									detailsProposal.rollbackHistory.length > 0 ? (
										<div className="space-y-2">
											{detailsProposal.rollbackHistory.map((rollback) => (
												<div
													key={rollback.id}
													className="rounded-md border border-border p-3"
												>
													<div className="flex flex-wrap items-center justify-between gap-2">
														<p className="font-medium">{rollback.status}</p>
														<p className="text-xs text-muted-foreground">
															Created {toDateString(rollback.createdAt)}
														</p>
													</div>
													<p className="text-xs text-muted-foreground">
														Completed {toDateString(rollback.completedAt)}
													</p>
													{rollback.error ? (
														<p className="text-xs text-destructive">
															{rollback.error}
														</p>
													) : null}
												</div>
											))}
										</div>
									) : (
										<p className="text-sm text-muted-foreground">
											No rollback attempts yet.
										</p>
									)}
								</section>
							</div>
						</>
					) : null}
				</SheetContent>
			</Sheet>
		</div>
	);
}
