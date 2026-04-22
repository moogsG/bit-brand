import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { can } from "@/lib/auth/authorize";
import type { PermissionRole } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { approvalPolicies, approvals, roleAssignments, roles } from "@/lib/db/schema";

interface PendingApprovalRow {
	clientId: string;
	requiredRoles: string;
}

interface UserRoleRow {
	clientId: string | null;
	roleName: string;
}

export interface DashboardPendingApprovalCountOptions {
	clientIds: string[];
	userId: string;
	role: PermissionRole;
}

const fullAccessApprovalRoles = new Set<PermissionRole>(["ADMIN", "AGENCY_OWNER"]);

function parseRequiredRoles(requiredRoles: string): string[] {
	try {
		const parsed = JSON.parse(requiredRoles);
		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed.filter((role): role is string => typeof role === "string");
	} catch {
		return [];
	}
}

function mapUserRolesByScope(roleRows: UserRoleRow[]): {
	globalRoles: Set<string>;
	rolesByClientId: Map<string, Set<string>>;
} {
	const globalRoles = new Set<string>();
	const rolesByClientId = new Map<string, Set<string>>();

	for (const roleRow of roleRows) {
		if (roleRow.clientId === null) {
			globalRoles.add(roleRow.roleName);
			continue;
		}

		const existingRoles = rolesByClientId.get(roleRow.clientId) ?? new Set<string>();
		existingRoles.add(roleRow.roleName);
		rolesByClientId.set(roleRow.clientId, existingRoles);
	}

	return { globalRoles, rolesByClientId };
}

export function countPendingApprovalsByClientForRoles(
	pendingApprovals: PendingApprovalRow[],
	roleRows: UserRoleRow[],
): Map<string, number> {
	// Mirrors approvals module authorization behavior for non-admin users:
	// actionable only when policy.requiredRoles intersects with assigned roles
	// at either global scope (clientId=null) or the same client scope.
	const counts = new Map<string, number>();
	const { globalRoles, rolesByClientId } = mapUserRolesByScope(roleRows);

	for (const approval of pendingApprovals) {
		const requiredRoles = parseRequiredRoles(approval.requiredRoles);
		const clientRoles = rolesByClientId.get(approval.clientId);
		const isActionable = requiredRoles.some(
			(requiredRole) => globalRoles.has(requiredRole) || clientRoles?.has(requiredRole),
		);

		if (!isActionable) {
			continue;
		}

		counts.set(approval.clientId, (counts.get(approval.clientId) ?? 0) + 1);
	}

	return counts;
}

function countPendingApprovalsByClient(
	pendingApprovals: PendingApprovalRow[],
): Map<string, number> {
	const counts = new Map<string, number>();
	for (const approval of pendingApprovals) {
		counts.set(approval.clientId, (counts.get(approval.clientId) ?? 0) + 1);
	}

	return counts;
}

export async function getDashboardPendingApprovalCounts(
	options: DashboardPendingApprovalCountOptions,
): Promise<Map<string, number>> {
	if (options.clientIds.length === 0) {
		return new Map();
	}

	if (!can("approvals", "view", { role: options.role })) {
		return new Map();
	}

	const pendingApprovals = await db
		.select({
			clientId: approvals.clientId,
			requiredRoles: approvalPolicies.requiredRoles,
		})
		.from(approvals)
		.innerJoin(approvalPolicies, eq(approvalPolicies.id, approvals.policyId))
		.where(
			and(
				eq(approvals.status, "PENDING"),
				inArray(approvals.clientId, options.clientIds),
			),
		);

	if (pendingApprovals.length === 0) {
		return new Map();
	}

	if (fullAccessApprovalRoles.has(options.role)) {
		return countPendingApprovalsByClient(pendingApprovals);
	}

	if (!can("approvals", "approve", { role: options.role })) {
		return new Map();
	}

	const scopedRoleAssignments = await db
		.select({
			clientId: roleAssignments.clientId,
			roleName: roles.name,
		})
		.from(roleAssignments)
		.innerJoin(roles, eq(roles.id, roleAssignments.roleId))
		.where(
			and(
				eq(roleAssignments.userId, options.userId),
				or(
					isNull(roleAssignments.clientId),
					inArray(roleAssignments.clientId, options.clientIds),
				),
			),
		);

	return countPendingApprovalsByClientForRoles(
		pendingApprovals,
		scopedRoleAssignments,
	);
}
