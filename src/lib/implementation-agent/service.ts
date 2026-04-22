import { and, desc, eq, inArray } from "drizzle-orm";
import { createApprovalRequest } from "@/lib/approvals";
import { db } from "@/lib/db";
import {
	approvalPolicies,
	approvals,
	clients,
	implementationExecutions,
	implementationProposals,
	implementationRollbacks,
	implementationSnapshots,
} from "@/lib/db/schema";
import {
	findImplementationProvider,
	isImplementationProviderName,
	type ImplementationExecutionResult,
} from "@/lib/implementation-agent/providers";

const IMPLEMENTATION_APPROVAL_POLICY_NAME =
	"implementation_proposal_execute" as const;
const IMPLEMENTATION_RESOURCE_TYPE = "IMPLEMENTATION_PROPOSAL" as const;

type ApprovalStatus =
	| "PENDING"
	| "APPROVED"
	| "REJECTED"
	| "CANCELLED"
	| "NONE";

export class ImplementationAgentError extends Error {
	constructor(
		public readonly code:
			| "NOT_FOUND"
			| "APPROVAL_REQUIRED"
			| "ALREADY_EXECUTED"
			| "INVALID_STATE"
			| "VALIDATION_ERROR",
		message: string,
	) {
		super(message);
		this.name = "ImplementationAgentError";
	}
}

function toJsonString(value: unknown): string {
	try {
		return JSON.stringify(value ?? {});
	} catch {
		return "{}";
	}
}

function parseJsonRecord(
	value: string | null | undefined,
): Record<string, unknown> {
	if (!value) {
		return {};
	}
	try {
		const parsed = JSON.parse(value) as unknown;
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
		return {};
	} catch {
		return {};
	}
}

function getProposalTargetRef(
	proposal: Record<string, unknown>,
): string | null {
	const targetRef = proposal.targetRef;
	if (typeof targetRef === "string" && targetRef.trim().length > 0) {
		return targetRef.trim();
	}

	return null;
}

function getProposalObjectField(
	proposal: Record<string, unknown>,
	field: string,
): Record<string, unknown> | null {
	const value = proposal[field];
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}

	return null;
}

function getProposalStringField(
	proposal: Record<string, unknown>,
	field: string,
): string | null {
	const value = proposal[field];
	if (typeof value === "string" && value.trim().length > 0) {
		return value.trim();
	}

	return null;
}

function resolveProviderName(provider: string | null | undefined): string {
	if (!provider) {
		return "noop";
	}

	return isImplementationProviderName(provider) ? provider : "noop";
}

interface SnapshotPayload {
	provider: string;
	dryRun?: boolean;
	status?: string;
	error?: string | null;
	proposalStatus?: string;
	outputSummary?: {
		keys: string[];
		hasOutput: boolean;
	};
	rollbackSummary?: {
		hasDetails: boolean;
		detailKeys: string[];
	};
}

function summarizeRecordKeys(value: unknown): string[] {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return [];
	}

	return Object.keys(value as Record<string, unknown>).slice(0, 20);
}

async function createImplementationSnapshot(params: {
	proposalId: string;
	clientId: string;
	type: (typeof implementationSnapshots.$inferInsert)["type"];
	payload: SnapshotPayload;
	executionId?: string | null;
	rollbackId?: string | null;
	createdBy?: string | null;
}) {
	await db.insert(implementationSnapshots).values({
		proposalId: params.proposalId,
		clientId: params.clientId,
		type: params.type,
		payload: toJsonString(params.payload),
		executionId: params.executionId ?? null,
		rollbackId: params.rollbackId ?? null,
		createdBy: params.createdBy ?? null,
		createdAt: new Date(),
	});
}

type ProposalTimelineEventType = "APPROVAL" | "EXECUTION" | "ROLLBACK";

interface ProposalTimelineEvent {
	id: string;
	type: ProposalTimelineEventType;
	status: string;
	label: string;
	occurredAt: Date | string | null;
	message?: string | null;
}

export interface ClientSafeImplementationChange {
	id: string;
	title: string;
	targetRef: string | null;
	approvalStatus: "APPROVED" | null;
	execution: {
		status: "RUNNING" | "SUCCEEDED" | "FAILED" | "ROLLED_BACK";
		executedAt: string | null;
	} | null;
	rollback: {
		status: "RUNNING" | "SUCCEEDED" | "FAILED";
		rolledBackAt: string | null;
	} | null;
	updatedAt: string | null;
}

function toIsoString(
	value: Date | string | number | null | undefined,
): string | null {
	if (!value) {
		return null;
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	return parsed.toISOString();
}

function sanitizeTargetRef(
	targetRef: string | null | undefined,
): string | null {
	if (!targetRef || targetRef.trim().length === 0) {
		return null;
	}

	const trimmed = targetRef.trim();

	try {
		const parsed = new URL(trimmed);
		return `${parsed.origin}${parsed.pathname}`;
	} catch {
		const [withoutQuery] = trimmed.split(/[?#]/, 1);
		return withoutQuery.length > 0 ? withoutQuery : null;
	}
}

async function ensureImplementationApprovalPolicy(): Promise<void> {
	const existing = await db
		.select({ id: approvalPolicies.id })
		.from(approvalPolicies)
		.where(eq(approvalPolicies.name, IMPLEMENTATION_APPROVAL_POLICY_NAME))
		.get();

	if (existing) {
		return;
	}

	await db.insert(approvalPolicies).values({
		name: IMPLEMENTATION_APPROVAL_POLICY_NAME,
		description:
			"Approval required before executing implementation queue proposals",
		resourceType: IMPLEMENTATION_RESOURCE_TYPE,
		action: "EXECUTE",
		requiredRoles: JSON.stringify([
			"AGENCY_OWNER",
			"ACCOUNT_MANAGER",
			"STRATEGIST",
		]),
		isActive: true,
	});
}

export async function createImplementationProposal(params: {
	clientId: string;
	title: string;
	description?: string;
	proposal: Record<string, unknown>;
	requestedBy: string;
	provider?: string;
	sourceTechnicalIssueId?: string;
	sourceTechnicalAuditRunId?: string;
}) {
	const now = new Date();
	const [created] = await db
		.insert(implementationProposals)
		.values({
			clientId: params.clientId,
			title: params.title,
			description: params.description ?? null,
			proposalJson: toJsonString(params.proposal),
			status: "DRAFT",
			provider: resolveProviderName(params.provider),
			requestedBy: params.requestedBy,
			sourceTechnicalIssueId: params.sourceTechnicalIssueId ?? null,
			sourceTechnicalAuditRunId: params.sourceTechnicalAuditRunId ?? null,
			createdAt: now,
			updatedAt: now,
		})
		.returning();

	return created;
}

export async function listImplementationProposals(clientId: string) {
	const rows = await db
		.select()
		.from(implementationProposals)
		.where(eq(implementationProposals.clientId, clientId))
		.orderBy(desc(implementationProposals.updatedAt))
		.all();

	return hydrateImplementationProposalRows(rows);
}

export async function listClientSafeImplementationChanges(
	clientId: string,
): Promise<ClientSafeImplementationChange[]> {
	const proposals = await listImplementationProposals(clientId);
	const changes: ClientSafeImplementationChange[] = proposals.map(
		(proposal) => {
			const approvalStatus: ClientSafeImplementationChange["approvalStatus"] =
				proposal.approvalStatus === "APPROVED" ? "APPROVED" : null;

			return {
				id: proposal.id,
				title: proposal.title,
				targetRef: sanitizeTargetRef(proposal.targetRef),
				approvalStatus,
				execution: proposal.latestExecution
					? {
							status: proposal.latestExecution.status,
							executedAt: toIsoString(
								proposal.latestExecution.completedAt ??
									proposal.latestExecution.startedAt,
							),
						}
					: null,
				rollback: proposal.latestRollback
					? {
							status: proposal.latestRollback.status,
							rolledBackAt: toIsoString(
								proposal.latestRollback.completedAt ??
									proposal.latestRollback.createdAt,
							),
						}
					: null,
				updatedAt: toIsoString(proposal.updatedAt),
			};
		},
	);

	return changes.filter(
		(change) =>
			change.approvalStatus === "APPROVED" ||
			Boolean(change.execution) ||
			Boolean(change.rollback),
	);
}

async function hydrateImplementationProposalRows(
	rows: Array<typeof implementationProposals.$inferSelect>,
) {
	if (rows.length === 0) {
		return [];
	}

	const proposalIds = rows.map((row) => row.id);
	const approvalIds = rows
		.map((row) => row.approvalId)
		.filter((value): value is string => Boolean(value));

	const [executionRows, rollbackRows, approvalRows] = await Promise.all([
		db
			.select()
			.from(implementationExecutions)
			.where(inArray(implementationExecutions.proposalId, proposalIds))
			.orderBy(desc(implementationExecutions.startedAt))
			.all(),
		db
			.select()
			.from(implementationRollbacks)
			.where(inArray(implementationRollbacks.proposalId, proposalIds))
			.orderBy(desc(implementationRollbacks.createdAt))
			.all(),
		approvalIds.length === 0
			? Promise.resolve([])
			: db
					.select({
						id: approvals.id,
						status: approvals.status,
						metadata: approvals.metadata,
						createdAt: approvals.createdAt,
						approvedAt: approvals.approvedAt,
						rejectedAt: approvals.rejectedAt,
					})
					.from(approvals)
					.where(inArray(approvals.id, approvalIds))
					.all(),
	]);

	const latestExecutionByProposal = new Map<
		string,
		(typeof executionRows)[number]
	>();
	const executionHistoryByProposal = new Map<
		string,
		Array<(typeof executionRows)[number]>
	>();
	for (const execution of executionRows) {
		const history = executionHistoryByProposal.get(execution.proposalId) ?? [];
		history.push(execution);
		executionHistoryByProposal.set(execution.proposalId, history);

		if (!latestExecutionByProposal.has(execution.proposalId)) {
			latestExecutionByProposal.set(execution.proposalId, execution);
		}
	}

	const latestRollbackByProposal = new Map<
		string,
		(typeof rollbackRows)[number]
	>();
	const rollbackHistoryByProposal = new Map<
		string,
		Array<(typeof rollbackRows)[number]>
	>();
	for (const rollback of rollbackRows) {
		const history = rollbackHistoryByProposal.get(rollback.proposalId) ?? [];
		history.push(rollback);
		rollbackHistoryByProposal.set(rollback.proposalId, history);

		if (!latestRollbackByProposal.has(rollback.proposalId)) {
			latestRollbackByProposal.set(rollback.proposalId, rollback);
		}
	}

	const approvalById = new Map<string, (typeof approvalRows)[number]>();
	const approvalStatusById = new Map<string, ApprovalStatus>();
	for (const approval of approvalRows) {
		approvalById.set(approval.id, approval);
		approvalStatusById.set(approval.id, approval.status);
	}

	return rows.map((row) => {
		const parsedProposal = parseJsonRecord(row.proposalJson);
		const beforeSnapshot = getProposalObjectField(
			parsedProposal,
			"beforeSnapshot",
		);
		const afterPreview = getProposalObjectField(parsedProposal, "afterPreview");
		const proposedPayload = getProposalObjectField(
			parsedProposal,
			"proposedPayload",
		);
		const operation = getProposalStringField(parsedProposal, "operation");
		const approvalRecord = row.approvalId
			? approvalById.get(row.approvalId)
			: null;
		const executionHistory = executionHistoryByProposal.get(row.id) ?? [];
		const rollbackHistory = rollbackHistoryByProposal.get(row.id) ?? [];

		const timelineEvents: ProposalTimelineEvent[] = [];
		if (approvalRecord) {
			timelineEvents.push({
				id: `approval-${approvalRecord.id}-requested`,
				type: "APPROVAL",
				status: "PENDING",
				label: "Approval requested",
				occurredAt: approvalRecord.createdAt,
			});

			if (approvalRecord.status === "APPROVED") {
				timelineEvents.push({
					id: `approval-${approvalRecord.id}-approved`,
					type: "APPROVAL",
					status: "APPROVED",
					label: "Approval approved",
					occurredAt: approvalRecord.approvedAt,
				});
			}

			if (approvalRecord.status === "REJECTED") {
				timelineEvents.push({
					id: `approval-${approvalRecord.id}-rejected`,
					type: "APPROVAL",
					status: "REJECTED",
					label: "Approval rejected",
					occurredAt: approvalRecord.rejectedAt,
				});
			}
		}

		for (const execution of executionHistory) {
			timelineEvents.push({
				id: `execution-${execution.id}`,
				type: "EXECUTION",
				status: execution.status,
				label: "Execution attempt",
				occurredAt: execution.startedAt,
				message: execution.error,
			});
		}

		for (const rollback of rollbackHistory) {
			timelineEvents.push({
				id: `rollback-${rollback.id}`,
				type: "ROLLBACK",
				status: rollback.status,
				label: "Rollback attempt",
				occurredAt: rollback.createdAt,
				message: rollback.error,
			});
		}

		timelineEvents.sort((a, b) => {
			const aTs = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
			const bTs = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
			return bTs - aTs;
		});

		return {
			...row,
			proposal: parsedProposal,
			beforeSnapshot,
			afterPreview,
			proposedPayload,
			operation,
			approvalStatus: row.approvalId
				? (approvalStatusById.get(row.approvalId) ?? "NONE")
				: "NONE",
			targetRef: getProposalTargetRef(parsedProposal),
			approval: approvalRecord
				? {
						id: approvalRecord.id,
						status: approvalRecord.status,
						metadata: parseJsonRecord(approvalRecord.metadata),
						requestedAt: approvalRecord.createdAt,
						resolvedAt:
							approvalRecord.approvedAt ?? approvalRecord.rejectedAt ?? null,
					}
				: null,
			executionHistory,
			rollbackHistory,
			timeline: timelineEvents,
			latestExecution: latestExecutionByProposal.get(row.id) ?? null,
			latestRollback: latestRollbackByProposal.get(row.id) ?? null,
		};
	});
}

export async function getImplementationProposalDetail(params: {
	clientId: string;
	proposalId: string;
}) {
	const row = await db
		.select()
		.from(implementationProposals)
		.where(
			and(
				eq(implementationProposals.clientId, params.clientId),
				eq(implementationProposals.id, params.proposalId),
			),
		)
		.get();

	if (!row) {
		return null;
	}

	const [proposal] = await hydrateImplementationProposalRows([row]);
	return proposal ?? null;
}

export async function requestImplementationProposalApprovals(params: {
	clientId: string;
	proposalIds: string[];
	requestedBy: string;
}) {
	await ensureImplementationApprovalPolicy();

	const rows = await db
		.select()
		.from(implementationProposals)
		.where(
			and(
				eq(implementationProposals.clientId, params.clientId),
				inArray(implementationProposals.id, params.proposalIds),
			),
		)
		.all();

	const rowById = new Map(rows.map((row) => [row.id, row]));
	const existingApprovalIds = rows
		.map((row) => row.approvalId)
		.filter((value): value is string => Boolean(value));
	const existingApprovalRows =
		existingApprovalIds.length === 0
			? []
			: await db
					.select({ id: approvals.id, status: approvals.status })
					.from(approvals)
					.where(inArray(approvals.id, existingApprovalIds))
					.all();

	const existingApprovalById = new Map(
		existingApprovalRows.map((row) => [row.id, row]),
	);
	const results: Array<{
		proposalId: string;
		status: "REQUESTED" | "SKIPPED";
		reason?: string;
		approvalId?: string;
	}> = [];
	const requestableProposals: typeof rows = [];

	for (const proposalId of params.proposalIds) {
		const proposal = rowById.get(proposalId);
		if (!proposal) {
			results.push({
				proposalId,
				status: "SKIPPED",
				reason: "Proposal not found",
			});
			continue;
		}

		if (proposal.status === "EXECUTING") {
			results.push({
				proposalId,
				status: "SKIPPED",
				reason: "Proposal is currently executing",
			});
			continue;
		}

		if (proposal.approvalId) {
			const existingApproval = existingApprovalById.get(proposal.approvalId);
			if (
				existingApproval &&
				(existingApproval.status === "PENDING" ||
					existingApproval.status === "APPROVED")
			) {
				results.push({
					proposalId,
					status: "SKIPPED",
					reason: `Approval already ${existingApproval.status.toLowerCase()}`,
					approvalId: proposal.approvalId,
				});
				continue;
			}
		}

		requestableProposals.push(proposal);
	}

	if (requestableProposals.length === 0) {
		return {
			results,
			sharedApprovalId: null,
			requestedCount: 0,
			skippedCount: results.length,
		};
	}

	const proposalMetadata = requestableProposals.map((proposal) => {
		const parsedProposal = parseJsonRecord(proposal.proposalJson);
		return {
			id: proposal.id,
			title: proposal.title,
			targetRef: getProposalTargetRef(parsedProposal),
		};
	});

	const client = await db
		.select({ name: clients.name })
		.from(clients)
		.where(eq(clients.id, params.clientId))
		.get();

	const sharedApprovalId = await createApprovalRequest({
		policyName: IMPLEMENTATION_APPROVAL_POLICY_NAME,
		resourceType: IMPLEMENTATION_RESOURCE_TYPE,
		resourceId: requestableProposals[0].id,
		clientId: params.clientId,
		requestedBy: params.requestedBy,
		metadata: {
			title:
				requestableProposals.length === 1
					? proposalMetadata[0].title
					: `Implementation proposal batch (${requestableProposals.length} proposals)`,
			proposalTitle: proposalMetadata[0].title,
			proposalCount: requestableProposals.length,
			proposalIds: proposalMetadata.map((proposal) => proposal.id),
			proposalTitles: proposalMetadata.map((proposal) => proposal.title),
			targetRef: proposalMetadata[0].targetRef,
			targetRefs: proposalMetadata
				.map((proposal) => proposal.targetRef)
				.filter((value): value is string => Boolean(value)),
			provider:
				requestableProposals.length === 1
					? requestableProposals[0].provider
					: "batch",
			resourceLabel:
				requestableProposals.length === 1
					? "Implementation proposal approval"
					: "Implementation proposal batch approval",
			clientId: params.clientId,
			clientName: client?.name ?? null,
		},
	});

	await db
		.update(implementationProposals)
		.set({
			approvalId: sharedApprovalId,
			status: "PENDING_APPROVAL",
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(implementationProposals.clientId, params.clientId),
				inArray(
					implementationProposals.id,
					requestableProposals.map((proposal) => proposal.id),
				),
			),
		);

	for (const proposal of requestableProposals) {
		results.push({
			proposalId: proposal.id,
			status: "REQUESTED",
			approvalId: sharedApprovalId,
		});
	}

	return {
		results,
		sharedApprovalId,
		requestedCount: requestableProposals.length,
		skippedCount: results.length - requestableProposals.length,
	};
}

export async function executeImplementationProposal(params: {
	proposalId: string;
	startedBy: string;
	rerun?: boolean;
	dryRun?: boolean;
}) {
	const proposal = await db
		.select()
		.from(implementationProposals)
		.where(eq(implementationProposals.id, params.proposalId))
		.get();

	if (!proposal) {
		throw new ImplementationAgentError(
			"NOT_FOUND",
			"Implementation proposal not found",
		);
	}

	if (!proposal.approvalId) {
		throw new ImplementationAgentError(
			"APPROVAL_REQUIRED",
			"Proposal requires approval before execution",
		);
	}

	const approval = await db
		.select({ status: approvals.status })
		.from(approvals)
		.where(eq(approvals.id, proposal.approvalId))
		.get();

	if (!approval || approval.status !== "APPROVED") {
		throw new ImplementationAgentError(
			"APPROVAL_REQUIRED",
			"Proposal approval is required before execution",
		);
	}

	if (proposal.status === "EXECUTING") {
		throw new ImplementationAgentError(
			"INVALID_STATE",
			"Proposal is already executing",
		);
	}

	if (
		(proposal.status === "EXECUTED" || proposal.status === "ROLLED_BACK") &&
		!params.rerun
	) {
		throw new ImplementationAgentError(
			"ALREADY_EXECUTED",
			"Proposal was already executed. Re-run requires explicit rerun=true intent.",
		);
	}

	const provider = findImplementationProvider(proposal.provider);
	if (!provider) {
		throw new ImplementationAgentError(
			"VALIDATION_ERROR",
			`Unsupported implementation provider: ${proposal.provider}`,
		);
	}
	const dryRun = params.dryRun ?? provider.name === "wordpress";
	const now = new Date();
	const [execution] = await db
		.insert(implementationExecutions)
		.values({
			proposalId: proposal.id,
			clientId: proposal.clientId,
			provider: provider.name,
			status: "RUNNING",
			startedBy: params.startedBy,
			startedAt: now,
		})
		.returning();

	await db
		.update(implementationProposals)
		.set({ status: "EXECUTING", updatedAt: now })
		.where(eq(implementationProposals.id, proposal.id));

	await createImplementationSnapshot({
		proposalId: proposal.id,
		clientId: proposal.clientId,
		executionId: execution.id,
		type: "PRE_EXECUTION",
		createdBy: params.startedBy,
		payload: {
			provider: provider.name,
			dryRun,
			status: "RUNNING",
			proposalStatus: proposal.status,
			outputSummary: {
				hasOutput: false,
				keys: summarizeRecordKeys(parseJsonRecord(proposal.proposalJson)),
			},
		},
	});

	let result: ImplementationExecutionResult;
	try {
		result = await provider.execute({
			proposal,
			context: {
				dryRun,
				executionMetadata: {
					executionId: execution.id,
					proposalId: proposal.id,
					startedBy: params.startedBy,
				},
			},
		});
	} catch (error) {
		const completedAt = new Date();
		const errorMessage =
			error instanceof Error
				? error.message
				: "Provider execution failed unexpectedly";

		const [failedExecution] = await db
			.update(implementationExecutions)
			.set({
				status: "FAILED",
				output: toJsonString({
					provider: provider.name,
					dryRun,
					writeApplied: false,
					failureType: "PROVIDER_EXCEPTION",
				}),
				error: errorMessage,
				completedAt,
			})
			.where(eq(implementationExecutions.id, execution.id))
			.returning();

		await db
			.update(implementationProposals)
			.set({ status: "FAILED", updatedAt: completedAt })
			.where(eq(implementationProposals.id, proposal.id));

		await createImplementationSnapshot({
			proposalId: proposal.id,
			clientId: proposal.clientId,
			executionId: execution.id,
			type: "POST_EXECUTION",
			createdBy: params.startedBy,
			payload: {
				provider: provider.name,
				dryRun,
				status: "FAILED",
				error: errorMessage,
				outputSummary: {
					hasOutput: true,
					keys: summarizeRecordKeys({
						failureType: "PROVIDER_EXCEPTION",
						writeApplied: false,
					}),
				},
			},
		});

		return {
			execution: failedExecution,
			proposalId: proposal.id,
			clientId: proposal.clientId,
			provider: provider.name,
			effectiveDryRun: dryRun,
		};
	}
	const completedAt = new Date();

	if (result.success) {
		const [updatedExecution] = await db
			.update(implementationExecutions)
			.set({
				status: "SUCCEEDED",
				output: toJsonString(result.output ?? {}),
				completedAt,
			})
			.where(eq(implementationExecutions.id, execution.id))
			.returning();

		await db
			.update(implementationProposals)
			.set({ status: "EXECUTED", updatedAt: completedAt })
			.where(eq(implementationProposals.id, proposal.id));

		await createImplementationSnapshot({
			proposalId: proposal.id,
			clientId: proposal.clientId,
			executionId: execution.id,
			type: "POST_EXECUTION",
			createdBy: params.startedBy,
			payload: {
				provider: provider.name,
				dryRun,
				status: "SUCCEEDED",
				outputSummary: {
					hasOutput: true,
					keys: summarizeRecordKeys(result.output),
				},
			},
		});

		return {
			execution: updatedExecution,
			proposalId: proposal.id,
			clientId: proposal.clientId,
			provider: provider.name,
			effectiveDryRun: dryRun,
		};
	}

	const [failedExecution] = await db
		.update(implementationExecutions)
		.set({
			status: "FAILED",
			output: toJsonString(result.output ?? {}),
			error: result.error ?? "Implementation execution failed",
			completedAt,
		})
		.where(eq(implementationExecutions.id, execution.id))
		.returning();

	await db
		.update(implementationProposals)
		.set({ status: "FAILED", updatedAt: completedAt })
		.where(eq(implementationProposals.id, proposal.id));

	await createImplementationSnapshot({
		proposalId: proposal.id,
		clientId: proposal.clientId,
		executionId: execution.id,
		type: "POST_EXECUTION",
		createdBy: params.startedBy,
		payload: {
			provider: provider.name,
			dryRun,
			status: "FAILED",
			error: result.error ?? "Implementation execution failed",
			outputSummary: {
				hasOutput: true,
				keys: summarizeRecordKeys(result.output),
			},
		},
	});

	return {
		execution: failedExecution,
		proposalId: proposal.id,
		clientId: proposal.clientId,
		provider: provider.name,
		effectiveDryRun: dryRun,
	};
}

export async function executeImplementationProposalsBatch(params: {
	clientId: string;
	proposalIds: string[];
	startedBy: string;
	rerun?: boolean;
	dryRun?: boolean;
}) {
	const results: Array<{
		proposalId: string;
		status: "SUCCEEDED" | "FAILED";
		message: string;
		executionId?: string;
		errorCode?: string;
		provider?: string;
		effectiveDryRun?: boolean;
	}> = [];

	const dedupedProposalIds = [...new Set(params.proposalIds)];

	for (const proposalId of dedupedProposalIds) {
		const proposal = await db
			.select({
				id: implementationProposals.id,
				clientId: implementationProposals.clientId,
			})
			.from(implementationProposals)
			.where(eq(implementationProposals.id, proposalId))
			.get();

		if (!proposal || proposal.clientId !== params.clientId) {
			results.push({
				proposalId,
				status: "FAILED",
				message: "Proposal not found for this client",
				errorCode: "NOT_FOUND",
			});
			continue;
		}

		try {
			const executionResult = await executeImplementationProposal({
				proposalId,
				startedBy: params.startedBy,
				rerun: params.rerun,
				dryRun: params.dryRun,
			});

			if (executionResult.execution.status === "FAILED") {
				results.push({
					proposalId,
					status: "FAILED",
					message:
						executionResult.execution.error ??
						"Execution failed for this proposal",
					executionId: executionResult.execution.id,
					errorCode: "EXECUTION_FAILED",
					provider: executionResult.provider,
					effectiveDryRun: executionResult.effectiveDryRun,
				});
				continue;
			}

			results.push({
				proposalId,
				status: "SUCCEEDED",
				message: "Executed successfully",
				executionId: executionResult.execution.id,
				provider: executionResult.provider,
				effectiveDryRun: executionResult.effectiveDryRun,
			});
		} catch (error) {
			if (error instanceof ImplementationAgentError) {
				results.push({
					proposalId,
					status: "FAILED",
					message: error.message,
					errorCode: error.code,
				});
				continue;
			}

			results.push({
				proposalId,
				status: "FAILED",
				message: "Unexpected error during execution",
				errorCode: "INTERNAL_ERROR",
			});
		}
	}

	return {
		results,
		summary: {
			total: results.length,
			succeeded: results.filter((result) => result.status === "SUCCEEDED")
				.length,
			failed: results.filter((result) => result.status === "FAILED").length,
		},
	};
}

export async function rollbackImplementationExecution(params: {
	executionId: string;
	requestedBy: string;
	reason?: string;
}) {
	const execution = await db
		.select()
		.from(implementationExecutions)
		.where(eq(implementationExecutions.id, params.executionId))
		.get();

	if (!execution) {
		throw new ImplementationAgentError("NOT_FOUND", "Execution not found");
	}

	if (execution.status !== "SUCCEEDED") {
		throw new ImplementationAgentError(
			"INVALID_STATE",
			"Only successful executions can be rolled back",
		);
	}

	const proposal = await db
		.select()
		.from(implementationProposals)
		.where(eq(implementationProposals.id, execution.proposalId))
		.get();

	if (!proposal) {
		throw new ImplementationAgentError(
			"NOT_FOUND",
			"Related proposal not found",
		);
	}

	const providerName = execution.provider || proposal.provider;
	const provider = findImplementationProvider(providerName);
	if (!provider) {
		throw new ImplementationAgentError(
			"VALIDATION_ERROR",
			`Unsupported implementation provider: ${providerName}`,
		);
	}
	const now = new Date();
	const [rollbackRecord] = await db
		.insert(implementationRollbacks)
		.values({
			executionId: execution.id,
			proposalId: proposal.id,
			clientId: proposal.clientId,
			requestedBy: params.requestedBy,
			reason: params.reason ?? null,
			status: "RUNNING",
			createdAt: now,
		})
		.returning();

	await createImplementationSnapshot({
		proposalId: proposal.id,
		clientId: proposal.clientId,
		executionId: execution.id,
		rollbackId: rollbackRecord.id,
		type: "PRE_ROLLBACK",
		createdBy: params.requestedBy,
		payload: {
			provider: provider.name,
			status: "RUNNING",
			proposalStatus: proposal.status,
			rollbackSummary: {
				hasDetails: false,
				detailKeys: [],
			},
		},
	});

	const result = await provider.rollback({
		proposal,
		execution,
		reason: params.reason,
	});
	const completedAt = new Date();

	if (result.success) {
		const [updatedRollback] = await db
			.update(implementationRollbacks)
			.set({
				status: "SUCCEEDED",
				details: toJsonString(result.details ?? {}),
				completedAt,
			})
			.where(eq(implementationRollbacks.id, rollbackRecord.id))
			.returning();

		await db
			.update(implementationExecutions)
			.set({ status: "ROLLED_BACK" })
			.where(eq(implementationExecutions.id, execution.id));

		await db
			.update(implementationProposals)
			.set({ status: "ROLLED_BACK", updatedAt: completedAt })
			.where(eq(implementationProposals.id, proposal.id));

		await createImplementationSnapshot({
			proposalId: proposal.id,
			clientId: proposal.clientId,
			executionId: execution.id,
			rollbackId: rollbackRecord.id,
			type: "POST_ROLLBACK",
			createdBy: params.requestedBy,
			payload: {
				provider: provider.name,
				status: "SUCCEEDED",
				rollbackSummary: {
					hasDetails: Boolean(result.details),
					detailKeys: summarizeRecordKeys(result.details),
				},
			},
		});

		return {
			rollback: updatedRollback,
			executionId: execution.id,
			proposalId: proposal.id,
			clientId: proposal.clientId,
		};
	}

	const [failedRollback] = await db
		.update(implementationRollbacks)
		.set({
			status: "FAILED",
			details: toJsonString(result.details ?? {}),
			error: result.error ?? "Rollback failed",
			completedAt,
		})
		.where(eq(implementationRollbacks.id, rollbackRecord.id))
		.returning();

	await createImplementationSnapshot({
		proposalId: proposal.id,
		clientId: proposal.clientId,
		executionId: execution.id,
		rollbackId: rollbackRecord.id,
		type: "POST_ROLLBACK",
		createdBy: params.requestedBy,
		payload: {
			provider: provider.name,
			status: "FAILED",
			error: result.error ?? "Rollback failed",
			rollbackSummary: {
				hasDetails: Boolean(result.details),
				detailKeys: summarizeRecordKeys(result.details),
			},
		},
	});

	return {
		rollback: failedRollback,
		executionId: execution.id,
		proposalId: proposal.id,
		clientId: proposal.clientId,
	};
}
