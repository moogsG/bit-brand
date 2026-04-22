import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/authorize", () => ({ can: vi.fn() }));
vi.mock("@/lib/auth/client-access", () => ({
	getClientAccessContext: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
		db: {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi.fn(),
			all: vi.fn(),
		},
	}));
vi.mock("@/lib/implementation-agent", () => ({
	createImplementationProposal: vi.fn(),
	listImplementationProposals: vi.fn(),
}));

describe("implementation queue proposals API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_TECHNICAL_AGENT_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { db } = await import("@/lib/db");
		const { createImplementationProposal, listImplementationProposals } =
			await import("@/lib/implementation-agent");

		vi.mocked(auth).mockResolvedValue({
			user: { id: "user-1", role: "ADMIN", rawRole: "AGENCY_OWNER" },
		} as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});

		const dbAny = db as any;
		dbAny.get.mockResolvedValue({ id: "client-1" });
		dbAny.all.mockResolvedValue([]);

		vi.mocked(listImplementationProposals).mockResolvedValue([
			{
				id: "proposal-2",
				clientId: "client-1",
				title: "Second",
				updatedAt: "2026-01-01T00:00:00.000Z",
				timeline: [
					{
						id: "approval-a",
						type: "APPROVAL",
						status: "PENDING",
						label: "Approval requested",
						occurredAt: "2026-01-01T00:00:00.000Z",
					},
				],
			},
			{
				id: "proposal-1",
				clientId: "client-1",
				title: "First",
				updatedAt: "2026-02-01T00:00:00.000Z",
				timeline: [
					{
						id: "execution-b",
						type: "EXECUTION",
						status: "SUCCEEDED",
						label: "Execution attempt",
						occurredAt: "2026-02-01T00:00:00.000Z",
					},
				],
			},
		] as any);

		vi.mocked(createImplementationProposal).mockResolvedValue({
			id: "proposal-new",
			clientId: "client-1",
			title: "New proposal",
			status: "DRAFT",
		} as any);
	});

	it.skip("returns 404 when feature flag is disabled", async () => {
		process.env.FF_TECHNICAL_AGENT_V1 = "false";
		const { GET } = await import(
			"@/app/api/implementation-queue/proposals/route"
		);

		const request = {
			nextUrl: new URL(
				"http://localhost/api/implementation-queue/proposals?clientId=client-1",
			),
		} as any;

		const response = await GET(request);
		expect(response.status).toBe(404);
		const json = await response.json();
		expect(json.error.code).toBe("MODULE_DISABLED");
	});

	it("returns 401 when unauthenticated", async () => {
		const { auth } = await import("@/lib/auth");
		vi.mocked(auth).mockResolvedValueOnce(null);

		const { GET } = await import(
			"@/app/api/implementation-queue/proposals/route"
		);
		const request = {
			nextUrl: new URL(
				"http://localhost/api/implementation-queue/proposals?clientId=client-1",
			),
		} as any;

		const response = await GET(request);
		expect(response.status).toBe(401);
		const json = await response.json();
		expect(json.error).toEqual({
			code: "UNAUTHORIZED",
			message: "Unauthorized",
		});
	});

	it("returns 403 when user is forbidden to view client proposals", async () => {
		const { can } = await import("@/lib/auth/authorize");
		vi.mocked(can).mockReturnValueOnce(false);

		const { GET } = await import(
			"@/app/api/implementation-queue/proposals/route"
		);
		const request = {
			nextUrl: new URL(
				"http://localhost/api/implementation-queue/proposals?clientId=client-1",
			),
		} as any;

		const response = await GET(request);
		expect(response.status).toBe(403);
		const json = await response.json();
		expect(json.error).toEqual({ code: "FORBIDDEN", message: "Forbidden" });
	});

	it("returns GET success envelope with sorted proposals", async () => {
		const { listImplementationProposals } = await import(
			"@/lib/implementation-agent"
		);
		const { GET } = await import(
			"@/app/api/implementation-queue/proposals/route"
		);

		const request = {
			nextUrl: new URL(
				"http://localhost/api/implementation-queue/proposals?clientId=client-1",
			),
		} as any;

		const response = await GET(request);
		expect(response.status).toBe(200);
		expect(vi.mocked(listImplementationProposals)).toHaveBeenCalledWith(
			"client-1",
		);

		const json = await response.json();
		expect(json).toEqual(
			expect.objectContaining({
				version: "1.0.0",
				success: true,
				error: null,
				data: {
					clientId: "client-1",
					proposals: [
						expect.objectContaining({
							id: "proposal-1",
							title: "First",
							timeline: expect.any(Array),
						}),
						expect.objectContaining({
							id: "proposal-2",
							title: "Second",
							timeline: expect.any(Array),
						}),
					],
				},
			}),
		);
		expect(json.data.proposals[0].timeline).toHaveLength(1);
		expect(json.data.proposals[1].timeline).toHaveLength(1);
	});

	it("returns POST success envelope for proposal creation", async () => {
		const { createImplementationProposal } = await import(
			"@/lib/implementation-agent"
		);
		const { POST } = await import(
			"@/app/api/implementation-queue/proposals/route"
		);

		const request = new Request(
			"http://localhost/api/implementation-queue/proposals",
			{
				method: "POST",
				body: JSON.stringify({
					clientId: "client-1",
					title: "New proposal",
					description: "description",
					proposal: { work: "items" },
				}),
			},
		);

		const response = await POST(request as any);
		expect(response.status).toBe(201);
		expect(vi.mocked(createImplementationProposal)).toHaveBeenCalledWith({
			clientId: "client-1",
			title: "New proposal",
			description: "description",
			proposal: { work: "items" },
			provider: undefined,
			requestedBy: "user-1",
			sourceTechnicalIssueId: undefined,
			sourceTechnicalAuditRunId: undefined,
		});

		const json = await response.json();
		expect(json).toEqual(
			expect.objectContaining({
				version: "1.0.0",
				success: true,
				error: null,
				data: expect.objectContaining({ id: "proposal-new", status: "DRAFT" }),
			}),
		);
	});

	it("rejects unsupported provider values on proposal creation", async () => {
		const { createImplementationProposal } = await import(
			"@/lib/implementation-agent"
		);
		const { POST } = await import(
			"@/app/api/implementation-queue/proposals/route"
		);

		const request = new Request(
			"http://localhost/api/implementation-queue/proposals",
			{
				method: "POST",
				body: JSON.stringify({
					clientId: "client-1",
					title: "Invalid provider",
					proposal: { work: "items" },
					provider: "custom",
				}),
			},
		);

		const response = await POST(request as any);
		expect(response.status).toBe(400);
		expect(vi.mocked(createImplementationProposal)).not.toHaveBeenCalled();

		const json = await response.json();
		expect(json.error.code).toBe("VALIDATION_ERROR");
	});

	it("creates proposal from technical issue with auto-populated defaults", async () => {
		const { db } = await import("@/lib/db");
		const { createImplementationProposal } = await import(
			"@/lib/implementation-agent"
		);
		const { POST } = await import(
			"@/app/api/implementation-queue/proposals/route"
		);

		const dbAny = db as any;
		dbAny.get
			.mockResolvedValueOnce({ id: "client-1" })
			.mockResolvedValueOnce({
				id: "issue-1",
				runId: "run-1",
				clientId: "client-1",
				url: "https://example.com/broken-page",
				issueType: "BROKEN_LINK",
				severity: "CRITICAL",
				message: "Broken internal link detected (404)",
				details: '{"status":404}',
				createdAt: "2026-03-01T00:00:00.000Z",
			})
			.mockResolvedValueOnce({
				id: "run-1",
				clientId: "client-1",
				status: "SUCCESS",
				startedAt: "2026-03-01T00:00:00.000Z",
				completedAt: "2026-03-01T00:05:00.000Z",
			});

		const request = new Request(
			"http://localhost/api/implementation-queue/proposals",
			{
				method: "POST",
				body: JSON.stringify({
					clientId: "client-1",
					technicalIssueId: "issue-1",
					technicalAuditRunId: "run-1",
				}),
			},
		);

		const response = await POST(request as any);
		expect(response.status).toBe(201);
		expect(vi.mocked(createImplementationProposal)).toHaveBeenCalledWith({
			clientId: "client-1",
			title: "[CRITICAL] BROKEN_LINK — https://example.com/broken-page",
			description:
				"Broken internal link detected (404)\n\nType: BROKEN_LINK\nURL: https://example.com/broken-page",
			proposal: expect.objectContaining({
				targetRef: "https://example.com/broken-page",
				beforeSnapshot: expect.objectContaining({
					source: "technical_issue",
					technicalIssueId: "issue-1",
					technicalAuditRunId: "run-1",
					issueType: "BROKEN_LINK",
					severity: "CRITICAL",
					message: "Broken internal link detected (404)",
					url: "https://example.com/broken-page",
					details: { status: 404 },
					auditRun: expect.objectContaining({
						status: "SUCCESS",
					}),
				}),
			}),
			provider: undefined,
			requestedBy: "user-1",
			sourceTechnicalIssueId: "issue-1",
			sourceTechnicalAuditRunId: "run-1",
		});
	});

	it("returns 404 with TECHNICAL_ISSUE_NOT_FOUND when technicalIssueId does not exist", async () => {
		const { db } = await import("@/lib/db");
		const { createImplementationProposal } = await import(
			"@/lib/implementation-agent"
		);
		const { POST } = await import(
			"@/app/api/implementation-queue/proposals/route"
		);

		const dbAny = db as any;
		dbAny.get
			.mockResolvedValueOnce({ id: "client-1" })
			.mockResolvedValueOnce(undefined);

		const request = new Request(
			"http://localhost/api/implementation-queue/proposals",
			{
				method: "POST",
				body: JSON.stringify({
					clientId: "client-1",
					technicalIssueId: "issue-missing",
				}),
			},
		);

		const response = await POST(request as any);
		expect(response.status).toBe(404);

		const json = await response.json();
		expect(json.error).toEqual({
			code: "TECHNICAL_ISSUE_NOT_FOUND",
			message: "Technical issue not found",
		});
		expect(vi.mocked(createImplementationProposal)).not.toHaveBeenCalled();
	});

	it("returns forbidden/not-found response when technicalIssueId belongs to a different client", async () => {
		const { db } = await import("@/lib/db");
		const { createImplementationProposal } = await import(
			"@/lib/implementation-agent"
		);
		const { POST } = await import(
			"@/app/api/implementation-queue/proposals/route"
		);

		const dbAny = db as any;
		dbAny.get
			.mockResolvedValueOnce({ id: "client-1" })
			.mockResolvedValueOnce({
				id: "issue-foreign",
				runId: "run-foreign",
				clientId: "client-2",
				url: "https://example.com/other-client",
				issueType: "BROKEN_LINK",
				severity: "HIGH",
				message: "Issue belongs to another client",
				details: "{}",
				createdAt: "2026-03-01T00:00:00.000Z",
			});

		const request = new Request(
			"http://localhost/api/implementation-queue/proposals",
			{
				method: "POST",
				body: JSON.stringify({
					clientId: "client-1",
					technicalIssueId: "issue-foreign",
				}),
			},
		);

		const response = await POST(request as any);
		expect([403, 404]).toContain(response.status);

		const json = await response.json();
		expect(["FORBIDDEN", "TECHNICAL_ISSUE_NOT_FOUND"]).toContain(
			json.error.code,
		);
		expect(vi.mocked(createImplementationProposal)).not.toHaveBeenCalled();
	});

	it("returns 404 with TECHNICAL_AUDIT_RUN_NOT_FOUND when technicalAuditRunId does not exist", async () => {
		const { db } = await import("@/lib/db");
		const { createImplementationProposal } = await import(
			"@/lib/implementation-agent"
		);
		const { POST } = await import(
			"@/app/api/implementation-queue/proposals/route"
		);

		const dbAny = db as any;
		dbAny.get
			.mockResolvedValueOnce({ id: "client-1" })
			.mockResolvedValueOnce({
				id: "issue-1",
				runId: "run-missing",
				clientId: "client-1",
				url: "https://example.com/missing-run",
				issueType: "BROKEN_LINK",
				severity: "CRITICAL",
				message: "Broken internal link detected (404)",
				details: '{"status":404}',
				createdAt: "2026-03-01T00:00:00.000Z",
			})
			.mockResolvedValueOnce(undefined);

		const request = new Request(
			"http://localhost/api/implementation-queue/proposals",
			{
				method: "POST",
				body: JSON.stringify({
					clientId: "client-1",
					technicalIssueId: "issue-1",
					technicalAuditRunId: "run-missing",
				}),
			},
		);

		const response = await POST(request as any);
		expect(response.status).toBe(404);

		const json = await response.json();
		expect(json.error).toEqual({
			code: "TECHNICAL_AUDIT_RUN_NOT_FOUND",
			message: "Technical audit run not found",
		});
		expect(vi.mocked(createImplementationProposal)).not.toHaveBeenCalled();
	});

	it("creates batch proposals from technical issues and returns mixed outcome summary", async () => {
		const { db } = await import("@/lib/db");
		const { createImplementationProposal } = await import(
			"@/lib/implementation-agent"
		);
		const { POST } = await import(
			"@/app/api/implementation-queue/proposals/route"
		);

		const dbAny = db as any;
		dbAny.get.mockResolvedValueOnce({ id: "client-1" });
		dbAny.all
			.mockResolvedValueOnce([
				{
					id: "issue-1",
					runId: "run-1",
					clientId: "client-1",
					url: "https://example.com/a",
					issueType: "BROKEN_LINK",
					severity: "CRITICAL",
					message: "Broken link",
					details: "{}",
					createdAt: "2026-03-01T00:00:00.000Z",
					proposable: true,
					proposableRationale: "ready",
				},
				{
					id: "issue-2",
					runId: "run-missing",
					clientId: "client-1",
					url: "https://example.com/b",
					issueType: "MISSING_TITLE",
					severity: "WARNING",
					message: "Missing title",
					details: "{}",
					createdAt: "2026-03-01T00:00:00.000Z",
					proposable: true,
					proposableRationale: "ready",
				},
			])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{
					id: "run-1",
					clientId: "client-1",
					status: "SUCCESS",
					startedAt: "2026-03-01T00:00:00.000Z",
					completedAt: "2026-03-01T00:05:00.000Z",
				},
			]);

		vi.mocked(createImplementationProposal).mockResolvedValueOnce({
			id: "proposal-issue-1",
		} as any);

		const request = new Request(
			"http://localhost/api/implementation-queue/proposals",
			{
				method: "POST",
				body: JSON.stringify({
					clientId: "client-1",
					technicalIssueIds: ["issue-1", "issue-2", "issue-missing"],
				}),
			},
		);

		const response = await POST(request as any);
		expect(response.status).toBe(201);
		expect(vi.mocked(createImplementationProposal)).toHaveBeenCalledTimes(1);

		const json = await response.json();
		expect(json.success).toBe(true);
		expect(json.data.summary).toEqual({
			totalRequested: 3,
			createdCount: 1,
			skippedCount: 0,
			failedCount: 2,
		});
		expect(json.data.created).toEqual([
			{ issueId: "issue-1", proposalId: "proposal-issue-1" },
		]);
		expect(json.data.failed).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					issueId: "issue-2",
					code: "TECHNICAL_AUDIT_RUN_NOT_FOUND",
				}),
				expect.objectContaining({
					issueId: "issue-missing",
					code: "TECHNICAL_ISSUE_NOT_FOUND",
				}),
			]),
		);
	});

	it("skips batch creation when issue already linked to a proposal", async () => {
		const { db } = await import("@/lib/db");
		const { createImplementationProposal } = await import(
			"@/lib/implementation-agent"
		);
		const { POST } = await import(
			"@/app/api/implementation-queue/proposals/route"
		);

		const dbAny = db as any;
		dbAny.get.mockResolvedValueOnce({ id: "client-1" });
		dbAny.all
			.mockResolvedValueOnce([
				{
					id: "issue-1",
					runId: "run-1",
					clientId: "client-1",
					url: "https://example.com/a",
					issueType: "BROKEN_LINK",
					severity: "CRITICAL",
					message: "Broken link",
					details: "{}",
					createdAt: "2026-03-01T00:00:00.000Z",
					proposable: true,
					proposableRationale: "ready",
				},
				{
					id: "issue-2",
					runId: "run-1",
					clientId: "client-1",
					url: "https://example.com/b",
					issueType: "MISSING_TITLE",
					severity: "WARNING",
					message: "Missing title",
					details: "{}",
					createdAt: "2026-03-01T00:00:00.000Z",
					proposable: true,
					proposableRationale: "ready",
				},
			])
			.mockResolvedValueOnce([{ sourceTechnicalIssueId: "issue-2" }])
			.mockResolvedValueOnce([
				{
					id: "run-1",
					clientId: "client-1",
					status: "SUCCESS",
					startedAt: "2026-03-01T00:00:00.000Z",
					completedAt: "2026-03-01T00:05:00.000Z",
				},
			]);

		vi.mocked(createImplementationProposal).mockResolvedValueOnce({
			id: "proposal-issue-1",
		} as any);

		const request = new Request(
			"http://localhost/api/implementation-queue/proposals",
			{
				method: "POST",
				body: JSON.stringify({
					clientId: "client-1",
					technicalIssueIds: ["issue-1", "issue-2"],
				}),
			},
		);

		const response = await POST(request as any);
		expect(response.status).toBe(201);
		expect(vi.mocked(createImplementationProposal)).toHaveBeenCalledTimes(1);

		const json = await response.json();
		expect(json.data.summary).toEqual({
			totalRequested: 2,
			createdCount: 1,
			skippedCount: 1,
			failedCount: 0,
		});
		expect(json.data.skipped).toEqual([
			expect.objectContaining({
				issueId: "issue-2",
				reason: "Proposal already exists for this technical issue",
			}),
		]);
	});
});
