import { and, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getApprovalDisplayContext } from "@/lib/approvals/metadata";
import { auth } from "@/lib/auth";
import { can, resolvePermissionRole } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import type { NewAuditLog } from "@/lib/db/schema";
import {
	approvalPolicies,
	approvals,
	auditLogs,
	contentBriefs,
	roleAssignments,
	roles,
} from "@/lib/db/schema";

interface RouteContext {
	params: Promise<{ id: string }>;
}

// GET /api/approvals/[id] - Get single approval
export async function GET(request: Request, context: RouteContext) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await context.params;

	const approval = await db
		.select()
		.from(approvals)
		.where(eq(approvals.id, id))
		.get();

	if (!approval) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const accessContext = await getClientAccessContext(
		session,
		approval.clientId,
	);
	if (
		!can("approvals", "view", {
			session,
			clientId: approval.clientId,
			...accessContext,
		})
	) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const display = getApprovalDisplayContext({
		resourceType: approval.resourceType,
		resourceId: approval.resourceId,
		metadata: approval.metadata,
	});

	return NextResponse.json({
		...approval,
		resourceLabel: display.resourceLabel,
		contextTitle: display.title,
		contextSubtitle: display.subtitle,
	});
}

// PATCH /api/approvals/[id] - Approve or reject
export async function PATCH(request: Request, context: RouteContext) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await context.params;

	try {
		const body = await request.json();
		const { action, reason } = body; // action: "approve" | "reject" | "cancel"

		const approval = await db
			.select()
			.from(approvals)
			.where(eq(approvals.id, id))
			.get();

		if (!approval) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

		const accessContext = await getClientAccessContext(
			session,
			approval.clientId,
		);
		if (
			!can("approvals", "view", {
				session,
				clientId: approval.clientId,
				...accessContext,
			})
		) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		if (approval.status !== "PENDING") {
			return NextResponse.json(
				{ error: "Approval is not pending" },
				{ status: 400 },
			);
		}

		// Check if user has permission to approve
		const policy = await db
			.select()
			.from(approvalPolicies)
			.where(eq(approvalPolicies.id, approval.policyId))
			.get();

		if (!policy) {
			return NextResponse.json({ error: "Policy not found" }, { status: 404 });
		}

		const requiredRoles = JSON.parse(policy.requiredRoles) as string[];
		const role = resolvePermissionRole({ session });
		const isFullAccessRole = role === "ADMIN" || role === "AGENCY_OWNER";

		if (
			action !== "cancel" &&
			!can("approvals", "approve", {
				session,
				clientId: approval.clientId,
				...accessContext,
			})
		) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		// Check if user has required role (global or client-scoped)
		const userRoles = await db
			.select({
				roleName: roles.name,
			})
			.from(roleAssignments)
			.innerJoin(roles, eq(roleAssignments.roleId, roles.id))
			.where(
				and(
					eq(roleAssignments.userId, session.user.id),
					or(
						isNull(roleAssignments.clientId),
						eq(roleAssignments.clientId, approval.clientId),
					),
				),
			)
			.all();

		const hasPermission =
			isFullAccessRole ||
			userRoles.some((r) => requiredRoles.includes(r.roleName));

		if (!hasPermission && action !== "cancel") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		// Update approval
		let updateData: Partial<typeof approvals.$inferInsert> = {};
		if (action === "approve") {
			updateData = {
				status: "APPROVED",
				approvedBy: session.user.id,
				approvedAt: new Date(),
			};
		} else if (action === "reject") {
			updateData = {
				status: "REJECTED",
				rejectedBy: session.user.id,
				rejectedAt: new Date(),
				rejectionReason: reason || null,
			};
		} else if (action === "cancel") {
			// Only requester can cancel
			if (approval.requestedBy !== session.user.id) {
				return NextResponse.json({ error: "Forbidden" }, { status: 403 });
			}
			updateData = {
				status: "CANCELLED",
			};
		} else {
			return NextResponse.json({ error: "Invalid action" }, { status: 400 });
		}

		const updated = await db
			.update(approvals)
			.set(updateData)
			.where(eq(approvals.id, id))
			.returning();

		if (approval.resourceType === "CONTENT_BRIEF") {
			const syncedBriefStatus =
				action === "approve"
					? "APPROVED"
					: action === "reject"
						? "AWAITING_CLIENT_INPUT"
						: null;

			if (syncedBriefStatus) {
				await db
					.update(contentBriefs)
					.set({
						status: syncedBriefStatus,
						updatedBy: session.user.id,
						updatedAt: new Date(),
					})
					.where(
						and(
							eq(contentBriefs.id, approval.resourceId),
							eq(contentBriefs.clientId, approval.clientId),
						),
					)
					.run();
			}
		}

		// Audit log
		const auditEntry: NewAuditLog = {
			userId: session.user.id,
			action: action.toUpperCase(),
			resourceType: "APPROVAL",
			resourceId: id,
			clientId: approval.clientId,
			changes: JSON.stringify({ action, reason }),
		};
		await db.insert(auditLogs).values(auditEntry);

		return NextResponse.json(updated[0]);
	} catch (error) {
		console.error("Error updating approval:", error);
		return NextResponse.json(
			{ error: "Failed to update approval" },
			{ status: 500 },
		);
	}
}
