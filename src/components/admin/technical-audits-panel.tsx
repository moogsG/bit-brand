"use client";

import { AlertTriangle, Loader2, Play, RefreshCw, SearchX } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface TechnicalIssue {
	id: string;
	runId?: string;
	url: string;
	issueType: string;
	severity: "INFO" | "WARNING" | "CRITICAL";
	message: string;
	priorityScore: number;
	priorityBand: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
	proposable: boolean;
	proposableRationale: string;
	createdAt: string | number | Date | null;
}

interface TechnicalAuditRun {
	id: string;
	status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
	seedUrls: string[];
	pagesCrawled: number;
	issuesFound: number;
	error: string | null;
	startedAt: string | number | Date | null;
	completedAt: string | number | Date | null;
	issues: TechnicalIssue[];
}

interface TechnicalAuditsData {
	clientId: string;
	runs: TechnicalAuditRun[];
}

interface TechnicalAuditsApiResponse {
	success: boolean;
	data: TechnicalAuditsData | null;
	error: {
		message: string;
	} | null;
}

interface BatchCreateProposalResponse {
	success: boolean;
	data: {
		mode: "batch_from_technical_issues";
		summary: {
			totalRequested: number;
			createdCount: number;
			skippedCount: number;
			failedCount: number;
		};
		created: Array<{ issueId: string; proposalId: string }>;
		skipped: Array<{ issueId: string; reason: string }>;
		failed: Array<{ issueId: string; reason: string; code: string }>;
	} | null;
	error: { message: string } | null;
}

interface TechnicalAuditsPanelProps {
	clientId: string;
	implementationQueueEnabled?: boolean;
}

function formatDateTime(value: string | number | Date | null): string {
	if (!value) {
		return "—";
	}
	return new Date(value).toLocaleString();
}

function parseUrls(input: string): string[] {
	return input
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.slice(0, 10);
}

export function TechnicalAuditsPanel({
	clientId,
	implementationQueueEnabled = false,
}: TechnicalAuditsPanelProps) {
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [running, setRunning] = useState(false);
	const [creatingProposalIssueId, setCreatingProposalIssueId] = useState<
		string | null
	>(null);
	const [creatingBatch, setCreatingBatch] = useState(false);
	const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
	const [proposalSuccess, setProposalSuccess] = useState<{
		proposalId: string;
		issueId: string;
	} | null>(null);
	const [batchProposalSummary, setBatchProposalSummary] = useState<{
		runId: string;
		totalRequested: number;
		createdCount: number;
		skippedCount: number;
		failedCount: number;
	} | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [urlsInput, setUrlsInput] = useState("");
	const [data, setData] = useState<TechnicalAuditsData | null>(null);

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
					`/api/technical/audits?clientId=${encodeURIComponent(clientId)}`,
				);
				const json = (await res.json()) as TechnicalAuditsApiResponse;

				if (!res.ok || !json.success || !json.data) {
					throw new Error(
						json.error?.message ?? "Failed to load technical audits",
					);
				}

				setData(json.data);
			} catch (loadError) {
				setError(
					loadError instanceof Error
						? loadError.message
						: "Failed to load technical audits",
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
		if (!data) {
			setSelectedIssueIds([]);
			return;
		}

		const issueIds = new Set(
			data.runs.flatMap((run) => run.issues.map((issue) => issue.id)),
		);
		setSelectedIssueIds((current) => current.filter((id) => issueIds.has(id)));
	}, [data]);

	const summary = useMemo(() => {
		const runs = data?.runs ?? [];
		const totalIssues = runs.reduce((sum, run) => sum + run.issuesFound, 0);
		const latestRun = runs[0] ?? null;
		return {
			runsCount: runs.length,
			totalIssues,
			latestRun,
		};
	}, [data]);

	const handleRunNow = async () => {
		setRunning(true);
		setError(null);
		try {
			const urls = parseUrls(urlsInput);
			const payload: { clientId: string; urls?: string[] } = { clientId };
			if (urls.length > 0) {
				payload.urls = urls;
			}

			const res = await fetch("/api/technical/audits", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const json = (await res.json()) as TechnicalAuditsApiResponse;
			if (!res.ok || !json.success) {
				throw new Error(json.error?.message ?? "Failed to run audit");
			}

			await load();
		} catch (runError) {
			setError(
				runError instanceof Error ? runError.message : "Failed to run audit",
			);
		} finally {
			setRunning(false);
		}
	};

	const implementationQueueHref = `/admin/clients/${clientId}/implementation-queue`;
	const selectedIssueSet = useMemo(
		() => new Set(selectedIssueIds),
		[selectedIssueIds],
	);

	const handleCreateProposalFromIssue = async (
		issueId: string,
		runId: string,
	) => {
		setCreatingProposalIssueId(issueId);
		setError(null);
		setProposalSuccess(null);

		try {
			const res = await fetch("/api/implementation-queue/proposals", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					clientId,
					technicalIssueId: issueId,
					technicalAuditRunId: runId,
				}),
			});

			const json = (await res.json()) as {
				success: boolean;
				data: { id: string } | null;
				error: { message: string } | null;
			};

			if (!res.ok || !json.success || !json.data) {
				throw new Error(
					json.error?.message ?? "Failed to create implementation proposal",
				);
			}

			setProposalSuccess({ proposalId: json.data.id, issueId });
			toast.success("Proposal created", {
				description:
					"Open Implementation Queue to review and request approval.",
			});
		} catch (createError) {
			setError(
				createError instanceof Error
					? createError.message
					: "Failed to create implementation proposal",
			);
		} finally {
			setCreatingProposalIssueId(null);
		}
	};

	const handleToggleIssueSelection = (issueId: string, checked: boolean) => {
		setSelectedIssueIds((current) => {
			if (checked) {
				if (current.includes(issueId)) {
					return current;
				}
				return [...current, issueId];
			}
			return current.filter((id) => id !== issueId);
		});
	};

	const handleToggleRunSelection = (
		run: TechnicalAuditRun,
		checked: boolean,
	) => {
		const runIssueIds = run.issues
			.filter((issue) => issue.proposable)
			.map((issue) => issue.id);

		setSelectedIssueIds((current) => {
			if (checked) {
				const merged = new Set([...current, ...runIssueIds]);
				return [...merged];
			}
			const runIssueIdSet = new Set(runIssueIds);
			return current.filter((id) => !runIssueIdSet.has(id));
		});
	};

	const handleBatchCreateFromRun = async (run: TechnicalAuditRun) => {
		const selectedInRun = run.issues
			.filter((issue) => issue.proposable && selectedIssueSet.has(issue.id))
			.map((issue) => issue.id);

		if (selectedInRun.length === 0) {
			toast.message("Select at least one proposable issue");
			return;
		}

		setCreatingBatch(true);
		setError(null);
		setBatchProposalSummary(null);

		try {
			const res = await fetch("/api/implementation-queue/proposals", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					clientId,
					technicalIssueIds: selectedInRun,
				}),
			});

			const json = (await res.json()) as BatchCreateProposalResponse;
			if (!res.ok || !json.success || !json.data) {
				throw new Error(
					json.error?.message ??
						"Failed to create implementation proposals from selected issues",
				);
			}

			const summary = json.data.summary;
			setBatchProposalSummary({
				runId: run.id,
				totalRequested: summary.totalRequested,
				createdCount: summary.createdCount,
				skippedCount: summary.skippedCount,
				failedCount: summary.failedCount,
			});

			toast.success("Batch proposal creation complete", {
				description: `${summary.createdCount} created, ${summary.skippedCount} skipped, ${summary.failedCount} failed.`,
			});
		} catch (createError) {
			setError(
				createError instanceof Error
					? createError.message
					: "Failed to create implementation proposals from selected issues",
			);
		} finally {
			setCreatingBatch(false);
		}
	};

	if (loading) {
		return (
			<Card>
				<CardContent className="py-12">
					<div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading technical audits…
					</div>
				</CardContent>
			</Card>
		);
	}

	if (error && !data) {
		return (
			<Card>
				<CardContent className="space-y-3 py-10 text-center">
					<p className="text-sm font-medium">
						Couldn&apos;t load technical audits
					</p>
					<p className="text-xs text-muted-foreground">{error}</p>
					<Button variant="outline" onClick={() => void load()}>
						Try again
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			{proposalSuccess ? (
				<div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
					Proposal {proposalSuccess.proposalId.slice(0, 8)} created from issue{" "}
					{proposalSuccess.issueId.slice(0, 8)}.{" "}
					<Link
						href={implementationQueueHref}
						className="font-medium underline"
					>
						Open Implementation Queue
					</Link>
					.
				</div>
			) : null}
			{batchProposalSummary ? (
				<div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
					Run {batchProposalSummary.runId.slice(0, 8)}: created{" "}
					{batchProposalSummary.createdCount} /{" "}
					{batchProposalSummary.totalRequested}.{" "}
					{batchProposalSummary.skippedCount} skipped,{" "}
					{batchProposalSummary.failedCount} failed.
				</div>
			) : null}

			<Card>
				<CardHeader>
					<CardTitle>Run Technical Audit</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{error ? (
						<div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
							{error}
						</div>
					) : null}
					<div className="space-y-1.5">
						<p className="text-sm font-medium">Optional seed URLs</p>
						<p className="text-xs text-muted-foreground">
							Add one URL per line. Leave blank to auto-seed from client domain.
						</p>
						<Textarea
							rows={4}
							value={urlsInput}
							onChange={(event) => setUrlsInput(event.target.value)}
							placeholder="https://example.com/\nhttps://example.com/services"
						/>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Button onClick={handleRunNow} disabled={running}>
							<Play className="mr-2 h-4 w-4" />
							{running ? "Running…" : "Run now"}
						</Button>
						<Button
							variant="outline"
							onClick={() => void load()}
							disabled={refreshing}
						>
							<RefreshCw
								className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
							/>
							{refreshing ? "Refreshing…" : "Refresh"}
						</Button>
					</div>
				</CardContent>
			</Card>

			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">Runs</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-semibold">{summary.runsCount}</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">Issues Found</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-semibold">{summary.totalIssues}</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">Last Run</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-xs text-muted-foreground">
							{summary.latestRun
								? formatDateTime(summary.latestRun.startedAt)
								: "No runs yet"}
						</p>
					</CardContent>
				</Card>
			</div>

			{!data || data.runs.length === 0 ? (
				<Card>
					<CardContent className="space-y-2 py-12 text-center">
						<SearchX className="mx-auto h-8 w-8 text-muted-foreground" />
						<p className="text-sm font-medium">No technical audits yet</p>
						<p className="text-xs text-muted-foreground">
							Run the first audit to capture baseline issues.
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-3">
					{data.runs.map((run) => {
						const runSelectableIssueIds = run.issues
							.filter((issue) => issue.proposable)
							.map((issue) => issue.id);
						const selectedInRunCount = runSelectableIssueIds.filter((id) =>
							selectedIssueSet.has(id),
						).length;
						const allSelectedInRun =
							runSelectableIssueIds.length > 0 &&
							selectedInRunCount === runSelectableIssueIds.length;

						return (
							<Card key={run.id}>
								<CardHeader className="pb-3">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<div>
											<CardTitle className="text-base">
												Run {run.id.slice(0, 8)}
											</CardTitle>
											<p className="text-xs text-muted-foreground">
												Started {formatDateTime(run.startedAt)}
											</p>
										</div>
										<Badge
											variant={
												run.status === "FAILED" ? "destructive" : "secondary"
											}
										>
											{run.status}
										</Badge>
									</div>
									{implementationQueueEnabled ? (
										<div className="flex flex-wrap items-center gap-2 pt-2">
											<label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
												<input
													type="checkbox"
													checked={allSelectedInRun}
													disabled={
														runSelectableIssueIds.length === 0 || creatingBatch
													}
													onChange={(event) =>
														handleToggleRunSelection(run, event.target.checked)
													}
												/>
												Select all proposable in run
											</label>
											<Button
												size="sm"
												variant="outline"
												disabled={selectedInRunCount === 0 || creatingBatch}
												onClick={() => void handleBatchCreateFromRun(run)}
											>
												{creatingBatch ? (
													<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
												) : null}
												Create proposals ({selectedInRunCount})
											</Button>
										</div>
									) : null}
								</CardHeader>
								<CardContent className="space-y-3">
									<div className="grid gap-2 text-xs md:grid-cols-4">
										<div className="rounded-md border p-2">
											<p className="text-muted-foreground">Pages crawled</p>
											<p className="text-sm font-semibold">
												{run.pagesCrawled}
											</p>
										</div>
										<div className="rounded-md border p-2">
											<p className="text-muted-foreground">Issues found</p>
											<p className="text-sm font-semibold">{run.issuesFound}</p>
										</div>
										<div className="rounded-md border p-2">
											<p className="text-muted-foreground">Seed URLs</p>
											<p className="text-sm font-semibold">
												{run.seedUrls.length}
											</p>
										</div>
										<div className="rounded-md border p-2">
											<p className="text-muted-foreground">Completed</p>
											<p className="text-sm font-semibold">
												{formatDateTime(run.completedAt)}
											</p>
										</div>
									</div>

									{run.error ? (
										<div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
											<AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
											<span>{run.error}</span>
										</div>
									) : null}

									{run.seedUrls.length > 0 ? (
										<div className="space-y-1">
											<p className="text-xs font-medium">Seed URLs</p>
											<div className="flex flex-wrap gap-1.5">
												{run.seedUrls.map((url) => (
													<Badge
														key={url}
														variant="outline"
														className="max-w-full truncate"
													>
														{url}
													</Badge>
												))}
											</div>
										</div>
									) : null}

									<div className="space-y-1">
										<p className="text-xs font-medium">Top issues</p>
										{run.issues.length === 0 ? (
											<p className="text-xs text-muted-foreground">
												No issues captured.
											</p>
										) : (
											<div className="space-y-1.5">
												{run.issues.map((issue) => (
													<div key={issue.id} className="rounded-md border p-2">
														<div className="mb-1 flex items-center gap-2">
															{implementationQueueEnabled ? (
																<input
																	type="checkbox"
																	checked={selectedIssueSet.has(issue.id)}
																	disabled={!issue.proposable || creatingBatch}
																	onChange={(event) =>
																		handleToggleIssueSelection(
																			issue.id,
																			event.target.checked,
																		)
																	}
																/>
															) : null}
															<Badge
																variant={
																	issue.severity === "CRITICAL"
																		? "destructive"
																		: "secondary"
																}
															>
																{issue.severity}
															</Badge>
															<Badge variant="outline">
																{issue.priorityBand} {issue.priorityScore}
															</Badge>
															<p className="text-xs font-medium">
																{issue.issueType}
															</p>
														</div>
														<p className="text-xs">{issue.message}</p>
														<p className="truncate text-[11px] text-muted-foreground">
															{issue.url}
														</p>
														{!issue.proposable ? (
															<p className="mt-1 text-[11px] text-muted-foreground">
																Not proposable: {issue.proposableRationale}
															</p>
														) : null}
														{implementationQueueEnabled ? (
															<div className="mt-2 flex items-center gap-2">
																<Button
																	size="sm"
																	variant="outline"
																	onClick={() =>
																		void handleCreateProposalFromIssue(
																			issue.id,
																			run.id,
																		)
																	}
																	disabled={
																		creatingProposalIssueId === issue.id ||
																		!issue.proposable
																	}
																>
																	{creatingProposalIssueId === issue.id ? (
																		<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
																	) : null}
																	Create Proposal
																</Button>
																<Link
																	href={implementationQueueHref}
																	className="text-[11px] text-muted-foreground underline"
																>
																	Queue
																</Link>
															</div>
														) : null}
													</div>
												))}
											</div>
										)}
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}
		</div>
	);
}
