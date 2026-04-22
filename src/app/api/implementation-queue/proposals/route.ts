import { and, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import {
	clients,
	implementationProposals,
	technicalAuditRuns,
	technicalIssues,
} from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";
import {
	createImplementationProposal,
	listImplementationProposals,
} from "@/lib/implementation-agent";
import { isImplementationProviderName } from "@/lib/implementation-agent/providers";

const IMPLEMENTATION_QUEUE_PROPOSALS_API_VERSION = "1.0.0" as const;

type ImplementationQueueProposalsErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "CLIENT_NOT_FOUND"
	| "TECHNICAL_ISSUE_NOT_FOUND"
	| "TECHNICAL_AUDIT_RUN_NOT_FOUND"
	| "INTERNAL_ERROR";

interface ImplementationQueueProposalsError {
	code: ImplementationQueueProposalsErrorCode;
	message: string;
	details?: unknown;
}

interface ImplementationQueueProposalsEnvelope<TData> {
	version: typeof IMPLEMENTATION_QUEUE_PROPOSALS_API_VERSION;
	success: boolean;
	data: TData | null;
	error: ImplementationQueueProposalsError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<ImplementationQueueProposalsEnvelope<TData>>(
		{
			version: IMPLEMENTATION_QUEUE_PROPOSALS_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: ImplementationQueueProposalsError) {
	return NextResponse.json<ImplementationQueueProposalsEnvelope<never>>(
		{
			version: IMPLEMENTATION_QUEUE_PROPOSALS_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const getQuerySchema = z.object({
	clientId: z.string().min(1),
});

const createProposalSchema = z
	.object({
		clientId: z.string().min(1),
		title: z.string().trim().min(1).max(180).optional(),
		description: z.string().trim().max(4_000).optional(),
		proposal: z.record(z.string(), z.unknown()).optional(),
		provider: z
			.string()
			.trim()
			.min(1)
			.max(64)
			.refine((value) => isImplementationProviderName(value), {
				message: "Unsupported provider",
			})
			.optional(),
		technicalIssueId: z.string().trim().min(1).optional(),
		technicalIssueIds: z
			.array(z.string().trim().min(1))
			.min(1)
			.max(100)
			.optional(),
		technicalAuditRunId: z.string().trim().min(1).optional(),
	})
	.superRefine((value, context) => {
		const hasSingleIssue = Boolean(value.technicalIssueId);
		const hasIssueBatch = (value.technicalIssueIds?.length ?? 0) > 0;

		if (!value.title && !hasSingleIssue && !hasIssueBatch) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["title"],
				message:
					"title is required unless technicalIssueId is provided for auto-population",
			});
		}

		if (hasSingleIssue && hasIssueBatch) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["technicalIssueIds"],
				message:
					"Provide either technicalIssueId or technicalIssueIds, not both",
			});
		}

		if (hasIssueBatch && value.technicalAuditRunId) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["technicalAuditRunId"],
				message: "technicalAuditRunId is only supported with technicalIssueId",
			});
		}
	});

function parseJsonRecord(value: string): Record<string, unknown> {
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

function toIsoString(
	value: Date | string | number | null | undefined,
): string | null {
	if (!value) {
		return null;
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return null;
	}

	return date.toISOString();
}

function buildIssueDefaultTitle(issue: {
	severity: string;
	issueType: string;
	url: string;
}) {
	return `[${issue.severity}] ${issue.issueType} — ${issue.url}`;
}

function withTechnicalIssueDefaults(params: {
	issue: {
		id: string;
		runId: string;
		url: string;
		issueType: string;
		severity: string;
		message: string;
		details: string;
		createdAt: Date | string | number | null;
	};
	run: {
		id: string;
		status: string;
		startedAt: Date | string | number | null;
		completedAt: Date | string | number | null;
	};
	proposal: Record<string, unknown>;
	title?: string;
	description?: string;
}) {
	const title = params.title ?? buildIssueDefaultTitle(params.issue);
	const description =
		params.description ??
		`${params.issue.message}\n\nType: ${params.issue.issueType}\nURL: ${params.issue.url}`;

	const beforeSnapshotDefault = {
		source: "technical_issue",
		technicalIssueId: params.issue.id,
		technicalAuditRunId: params.run.id,
		issueType: params.issue.issueType,
		severity: params.issue.severity,
		message: params.issue.message,
		url: params.issue.url,
		details: parseJsonRecord(params.issue.details),
		capturedAt: toIsoString(params.issue.createdAt),
		auditRun: {
			status: params.run.status,
			startedAt: toIsoString(params.run.startedAt),
			completedAt: toIsoString(params.run.completedAt),
		},
	};

	const existingBeforeSnapshot =
		params.proposal.beforeSnapshot &&
		typeof params.proposal.beforeSnapshot === "object" &&
		!Array.isArray(params.proposal.beforeSnapshot)
			? (params.proposal.beforeSnapshot as Record<string, unknown>)
			: {};

	return {
		title,
		description,
		proposal: {
			...params.proposal,
			targetRef:
				typeof params.proposal.targetRef === "string" &&
				params.proposal.targetRef.trim()
					? params.proposal.targetRef
					: params.issue.url,
			beforeSnapshot: {
				...beforeSnapshotDefault,
				...existingBeforeSnapshot,
			},
		},
	};
}

async function assertClientExists(clientId: string) {
	const client = await db
		.select({ id: clients.id })
		.from(clients)
		.where(eq(clients.id, clientId))
		.get();

	return Boolean(client);
}

export async function GET(request: NextRequest) {
	if (!phase3Flags.technicalAgentV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message:
				"Implementation queue APIs are disabled in this environment (FF_TECHNICAL_AGENT_V1=false)",
		});
	}

	const session = await auth();
	if (!session) {
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
	}

	const parsedQuery = getQuerySchema.safeParse({
		clientId: request.nextUrl.searchParams.get("clientId") ?? undefined,
	});

	if (!parsedQuery.success) {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Invalid query parameters",
			details: parsedQuery.error.flatten(),
		});
	}

	const { clientId } = parsedQuery.data;
	if (!(await assertClientExists(clientId))) {
		return fail(404, { code: "CLIENT_NOT_FOUND", message: "Client not found" });
	}

	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("technical", "view", { session, clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const proposals = await listImplementationProposals(clientId);
		return ok(
			{
				clientId,
				proposals: proposals.sort((a, b) => {
					const aTs = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
					const bTs = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
					return bTs - aTs;
				}),
			},
			200,
		);
	} catch (error) {
		console.error("[implementation-queue.proposals] list failed", {
			clientId,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to load implementation proposals",
		});
	}
}

export async function POST(request: NextRequest) {
	if (!phase3Flags.technicalAgentV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message:
				"Implementation queue APIs are disabled in this environment (FF_TECHNICAL_AGENT_V1=false)",
		});
	}

	const session = await auth();
	if (!session) {
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
	}

	let parsed: z.infer<typeof createProposalSchema>;
	try {
		const body = (await request.json()) as unknown;
		const validation = createProposalSchema.safeParse(body);
		if (!validation.success) {
			return fail(400, {
				code: "VALIDATION_ERROR",
				message: "Invalid request payload",
				details: validation.error.flatten(),
			});
		}
		parsed = validation.data;
	} catch {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Request body must be valid JSON",
		});
	}

	if (!(await assertClientExists(parsed.clientId))) {
		return fail(404, { code: "CLIENT_NOT_FOUND", message: "Client not found" });
	}

	const accessContext = await getClientAccessContext(session, parsed.clientId);
	if (
		!can("technical", "edit", {
			session,
			clientId: parsed.clientId,
			...accessContext,
		})
	) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const issueIds = parsed.technicalIssueIds
			? [...new Set(parsed.technicalIssueIds)]
			: [];

		if (issueIds.length > 0) {
			const [issues, existingLinkedProposals] = await Promise.all([
				db
					.select({
						id: technicalIssues.id,
						runId: technicalIssues.runId,
						clientId: technicalIssues.clientId,
						url: technicalIssues.url,
						issueType: technicalIssues.issueType,
						severity: technicalIssues.severity,
						message: technicalIssues.message,
						details: technicalIssues.details,
						createdAt: technicalIssues.createdAt,
						proposable: technicalIssues.proposable,
						proposableRationale: technicalIssues.proposableRationale,
					})
					.from(technicalIssues)
					.where(inArray(technicalIssues.id, issueIds))
					.all(),
				db
					.select({
						sourceTechnicalIssueId:
							implementationProposals.sourceTechnicalIssueId,
					})
					.from(implementationProposals)
					.where(
						and(
							eq(implementationProposals.clientId, parsed.clientId),
							inArray(implementationProposals.sourceTechnicalIssueId, issueIds),
						),
					)
					.all(),
			]);

			const issueById = new Map(issues.map((issue) => [issue.id, issue]));
			const existingIssueIds = new Set(
				existingLinkedProposals
					.map((proposal) => proposal.sourceTechnicalIssueId)
					.filter((value): value is string => Boolean(value)),
			);

			const runIds = [
				...new Set(issues.map((issue) => issue.runId).filter(Boolean)),
			];
			const runs =
				runIds.length > 0
					? await db
							.select({
								id: technicalAuditRuns.id,
								clientId: technicalAuditRuns.clientId,
								status: technicalAuditRuns.status,
								startedAt: technicalAuditRuns.startedAt,
								completedAt: technicalAuditRuns.completedAt,
							})
							.from(technicalAuditRuns)
							.where(inArray(technicalAuditRuns.id, runIds))
							.all()
					: [];
			const runById = new Map(runs.map((run) => [run.id, run]));

			const created: Array<{ issueId: string; proposalId: string }> = [];
			const skipped: Array<{ issueId: string; reason: string }> = [];
			const failed: Array<{ issueId: string; reason: string; code: string }> =
				[];

			for (const issueId of issueIds) {
				if (existingIssueIds.has(issueId)) {
					skipped.push({
						issueId,
						reason: "Proposal already exists for this technical issue",
					});
					continue;
				}

				const issue = issueById.get(issueId);
				if (!issue || issue.clientId !== parsed.clientId) {
					failed.push({
						issueId,
						reason: "Technical issue not found",
						code: "TECHNICAL_ISSUE_NOT_FOUND",
					});
					continue;
				}

				if (!issue.proposable) {
					skipped.push({
						issueId,
						reason:
							issue.proposableRationale ||
							"Issue is currently not marked proposable",
					});
					continue;
				}

				const run = runById.get(issue.runId);
				if (!run || run.clientId !== parsed.clientId) {
					failed.push({
						issueId,
						reason: "Technical audit run not found",
						code: "TECHNICAL_AUDIT_RUN_NOT_FOUND",
					});
					continue;
				}

				const seeded = withTechnicalIssueDefaults({
					issue,
					run,
					proposal: parsed.proposal ?? {},
					title: parsed.title,
					description: parsed.description,
				});

				const createdProposal = await createImplementationProposal({
					clientId: parsed.clientId,
					title: seeded.title,
					description: seeded.description,
					proposal: seeded.proposal,
					provider: parsed.provider,
					requestedBy: session.user.id,
					sourceTechnicalIssueId: issue.id,
					sourceTechnicalAuditRunId: run.id,
				});

				created.push({ issueId, proposalId: createdProposal.id });
			}

			return ok(
				{
					clientId: parsed.clientId,
					mode: "batch_from_technical_issues",
					summary: {
						totalRequested: issueIds.length,
						createdCount: created.length,
						skippedCount: skipped.length,
						failedCount: failed.length,
					},
					created,
					skipped,
					failed,
				},
				201,
			);
		}

		let title = parsed.title;
		let description = parsed.description;
		let proposal = parsed.proposal ?? {};
		let sourceTechnicalIssueId: string | undefined;
		let sourceTechnicalAuditRunId: string | undefined;

		if (parsed.technicalIssueId) {
			const issue = await db
				.select({
					id: technicalIssues.id,
					runId: technicalIssues.runId,
					clientId: technicalIssues.clientId,
					url: technicalIssues.url,
					issueType: technicalIssues.issueType,
					severity: technicalIssues.severity,
					message: technicalIssues.message,
					details: technicalIssues.details,
					createdAt: technicalIssues.createdAt,
				})
				.from(technicalIssues)
				.where(eq(technicalIssues.id, parsed.technicalIssueId))
				.get();

			if (!issue || issue.clientId !== parsed.clientId) {
				return fail(404, {
					code: "TECHNICAL_ISSUE_NOT_FOUND",
					message: "Technical issue not found",
				});
			}

			const resolvedRunId = parsed.technicalAuditRunId ?? issue.runId;
			if (
				parsed.technicalAuditRunId &&
				parsed.technicalAuditRunId !== issue.runId
			) {
				return fail(400, {
					code: "VALIDATION_ERROR",
					message:
						"technicalAuditRunId does not match the run associated with technicalIssueId",
				});
			}

			const run = await db
				.select({
					id: technicalAuditRuns.id,
					clientId: technicalAuditRuns.clientId,
					status: technicalAuditRuns.status,
					startedAt: technicalAuditRuns.startedAt,
					completedAt: technicalAuditRuns.completedAt,
				})
				.from(technicalAuditRuns)
				.where(eq(technicalAuditRuns.id, resolvedRunId))
				.get();

			if (!run || run.clientId !== parsed.clientId) {
				return fail(404, {
					code: "TECHNICAL_AUDIT_RUN_NOT_FOUND",
					message: "Technical audit run not found",
				});
			}

			const seeded = withTechnicalIssueDefaults({
				issue,
				run,
				proposal,
				title,
				description,
			});

			title = seeded.title;
			description = seeded.description;
			proposal = seeded.proposal;
			sourceTechnicalIssueId = issue.id;
			sourceTechnicalAuditRunId = run.id;
		}

		const created = await createImplementationProposal({
			clientId: parsed.clientId,
			title: title ?? "Untitled implementation proposal",
			description,
			proposal,
			provider: parsed.provider,
			requestedBy: session.user.id,
			sourceTechnicalIssueId,
			sourceTechnicalAuditRunId,
		});

		return ok(created, 201);
	} catch (error) {
		console.error("[implementation-queue.proposals] create failed", {
			clientId: parsed.clientId,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to create implementation proposal",
		});
	}
}
