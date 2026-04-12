import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
	approvals,
	approvalPolicies,
	roleAssignments,
	roles,
	auditLogs,
} from "@/lib/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NewApproval, NewAuditLog } from "@/lib/db/schema";

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

	let query = db.select().from(approvals);

	const conditions = [];
	if (status) conditions.push(eq(approvals.status, status as any));
	if (clientId) conditions.push(eq(approvals.clientId, clientId));
	if (resourceType)
		conditions.push(eq(approvals.resourceType, resourceType as any));

	if (conditions.length > 0) {
		query = query.where(and(...conditions)) as any;
	}

	const results = await query.all();
	return NextResponse.json(results);
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
