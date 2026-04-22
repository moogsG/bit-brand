import { db } from "@/lib/db";
import {
	approvals,
	approvalPolicies,
	roleAssignments,
	roles,
} from "@/lib/db/schema";
import { eq, and, or, isNull, desc } from "drizzle-orm";
import type { NewApproval } from "@/lib/db/schema";

/**
 * Check if an approval is required for a given action
 */
export async function requiresApproval(
	resourceType: string,
	action: string,
): Promise<boolean> {
	const policy = await db
		.select()
		.from(approvalPolicies)
		.where(
			and(
				eq(approvalPolicies.resourceType, resourceType),
				eq(approvalPolicies.action, action),
				eq(approvalPolicies.isActive, true),
			),
		)
		.get();

	return !!policy;
}

/**
 * Create an approval request
 */
export async function createApprovalRequest(params: {
	policyName: string;
	resourceType: string;
	resourceId: string;
	clientId: string;
	requestedBy: string;
	metadata?: Record<string, unknown>;
}): Promise<string> {
	const { policyName, resourceType, resourceId, clientId, requestedBy, metadata = {} } = params;

	// Find the policy
	const policy = await db
		.select()
		.from(approvalPolicies)
		.where(eq(approvalPolicies.name, policyName))
		.get();

	if (!policy) {
		throw new Error(`Approval policy not found: ${policyName}`);
	}

	if (!policy.isActive) {
		throw new Error(`Approval policy is inactive: ${policyName}`);
	}

	// Create approval request
	const newApproval: NewApproval = {
		policyId: policy.id,
		resourceType,
		resourceId,
		clientId,
		requestedBy,
		status: "PENDING",
		metadata: JSON.stringify(metadata),
	};

	const [result] = await db.insert(approvals).values(newApproval).returning();
	return result.id;
}

/**
 * Check if a user can approve a specific approval request
 */
export async function canApprove(
	approvalId: string,
	userId: string,
	userRole: "ADMIN" | "CLIENT",
): Promise<boolean> {
	// Admins can always approve
	if (userRole === "ADMIN") {
		return true;
	}

	const approval = await db
		.select()
		.from(approvals)
		.where(eq(approvals.id, approvalId))
		.get();

	if (!approval) {
		return false;
	}

	const policy = await db
		.select()
		.from(approvalPolicies)
		.where(eq(approvalPolicies.id, approval.policyId))
		.get();

	if (!policy) {
		return false;
	}

	const requiredRoles = JSON.parse(policy.requiredRoles) as string[];

	// Check if user has required role (global or client-scoped)
	const userRoles = await db
		.select({
			roleName: roles.name,
		})
		.from(roleAssignments)
		.innerJoin(roles, eq(roleAssignments.roleId, roles.id))
		.where(
			and(
				eq(roleAssignments.userId, userId),
				or(
					isNull(roleAssignments.clientId),
					eq(roleAssignments.clientId, approval.clientId),
				),
			),
		)
		.all();

	return userRoles.some((r) => requiredRoles.includes(r.roleName));
}

/**
 * Check if an approval is pending for a resource
 */
export async function hasPendingApproval(
	resourceType: string,
	resourceId: string,
): Promise<boolean> {
	const pending = await db
		.select()
		.from(approvals)
		.where(
			and(
				eq(approvals.resourceType, resourceType),
				eq(approvals.resourceId, resourceId),
				eq(approvals.status, "PENDING"),
			),
		)
		.get();

	return !!pending;
}

/**
 * Get approval status for a resource
 */
export async function getApprovalStatus(
	resourceType: string,
	resourceId: string,
): Promise<"APPROVED" | "PENDING" | "REJECTED" | "CANCELLED" | "NONE"> {
	const approval = await db
		.select()
		.from(approvals)
		.where(
			and(
				eq(approvals.resourceType, resourceType),
				eq(approvals.resourceId, resourceId),
			),
		)
		.orderBy(desc(approvals.createdAt))
		.get();

	if (!approval) {
		return "NONE";
	}

	return approval.status;
}
