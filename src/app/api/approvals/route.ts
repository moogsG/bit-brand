import { and, eq, inArray, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getApprovalDisplayContext } from "@/lib/approvals/metadata";
import { auth } from "@/lib/auth";
import { can, resolvePermissionRole } from "@/lib/auth/authorize";
import {
	getAssignedClientIdsForUser,
	getClientAccessContext,
} from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import type { NewApproval, NewAuditLog } from "@/lib/db/schema";
import {
	approvalPolicies,
	approvals,
	auditLogs,
	clientUsers,
} from "@/lib/db/schema";

const approvalStatusSchema = z.enum([
	"PENDING",
	"APPROVED",
	"REJECTED",
	"CANCELLED",
]);

// GET /api/approvals - List approvals (optionally filtered)
export async function GET(request: Request) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const status = searchParams.get("status");
	const clientId = searchParams.get("clientId");
	const resourceType = searchParams.get("resourceType");

	if (!can("approvals", "view", { session })) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const conditions: SQL[] = [];
	if (status) {
		const parsedStatus = approvalStatusSchema.safeParse(status);
		if (!parsedStatus.success) {
			return NextResponse.json({ error: "Invalid status" }, { status: 400 });
		}
		conditions.push(eq(approvals.status, parsedStatus.data));
	}

	if (clientId) {
		const accessContext = await getClientAccessContext(session, clientId);
		if (!can("approvals", "view", { session, clientId, ...accessContext })) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		conditions.push(eq(approvals.clientId, clientId));
	} else {
		const role = resolvePermissionRole({ session });
		if (role !== "ADMIN" && role !== "AGENCY_OWNER") {
			const [memberships, assignmentClientIds] = await Promise.all([
				db
					.select({ clientId: clientUsers.clientId })
					.from(clientUsers)
					.where(eq(clientUsers.userId, session.user.id))
					.all(),
				getAssignedClientIdsForUser(session.user.id),
			]);

			const scopedClientIds = new Set<string>([
				...memberships.map((membership) => membership.clientId),
				...assignmentClientIds,
			]);

			if (session.user.clientId) {
				scopedClientIds.add(session.user.clientId);
			}

			const allowedClientIds = [...scopedClientIds];
			if (allowedClientIds.length === 0) {
				return NextResponse.json([]);
			}

			conditions.push(inArray(approvals.clientId, allowedClientIds));
		}
	}

	if (resourceType) conditions.push(eq(approvals.resourceType, resourceType));

	const results =
		conditions.length > 0
			? await db
					.select()
					.from(approvals)
					.where(and(...conditions))
					.all()
			: await db.select().from(approvals).all();

	const enriched = results.map((approval) => {
		const display = getApprovalDisplayContext({
			resourceType: approval.resourceType,
			resourceId: approval.resourceId,
			metadata: approval.metadata,
		});

		return {
			...approval,
			resourceLabel: display.resourceLabel,
			contextTitle: display.title,
			contextSubtitle: display.subtitle,
		};
	});

	return NextResponse.json(enriched);
}

// POST /api/approvals - Create approval request
export async function POST(request: Request) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const {
			policyName,
			resourceType,
			resourceId,
			clientId,
			metadata = {},
		} = body;

		if (clientId) {
			const accessContext = await getClientAccessContext(session, clientId);
			if (!can("approvals", "edit", { session, clientId, ...accessContext })) {
				return NextResponse.json({ error: "Forbidden" }, { status: 403 });
			}
		} else if (!can("approvals", "edit", { session })) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		// Find the policy
		const policy = await db
			.select()
			.from(approvalPolicies)
			.where(eq(approvalPolicies.name, policyName))
			.get();

		if (!policy) {
			return NextResponse.json(
				{ error: "Approval policy not found" },
				{ status: 404 },
			);
		}

		if (!policy.isActive) {
			return NextResponse.json(
				{ error: "Approval policy is inactive" },
				{ status: 400 },
			);
		}

		// Create approval request
		const newApproval: NewApproval = {
			policyId: policy.id,
			resourceType,
			resourceId,
			clientId,
			requestedBy: session.user.id,
			status: "PENDING",
			metadata: JSON.stringify(metadata),
		};

		const result = await db.insert(approvals).values(newApproval).returning();

		// Audit log
		const auditEntry: NewAuditLog = {
			userId: session.user.id,
			action: "CREATE",
			resourceType: "APPROVAL",
			resourceId: result[0].id,
			clientId,
			changes: JSON.stringify({ approval: newApproval }),
		};
		await db.insert(auditLogs).values(auditEntry);

		return NextResponse.json(result[0], { status: 201 });
	} catch (error) {
		console.error("Error creating approval:", error);
		return NextResponse.json(
			{ error: "Failed to create approval" },
			{ status: 500 },
		);
	}
}
