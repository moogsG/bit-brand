import type { Session } from "next-auth";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientUsers, userClientAssignments } from "@/lib/db/schema";
import {
	resolvePermissionRole,
	type AuthorizationContext,
} from "@/lib/auth/authorize";

export async function getAssignedClientIdsForUser(
	userId: string,
): Promise<string[]> {
	const rows = await db
		.select({ clientId: userClientAssignments.clientId })
		.from(userClientAssignments)
		.where(eq(userClientAssignments.userId, userId));

	return rows.map((row) => row.clientId);
}

export async function getClientAccessContext(
	session: Session,
	clientId: string,
): Promise<Pick<AuthorizationContext, "isClientMember" | "assignedClientIds">> {
	const role = resolvePermissionRole({ session });
	if (role === "ADMIN" || role === "AGENCY_OWNER") {
		return { isClientMember: false, assignedClientIds: [] };
	}

	const [membership, assignment] = await Promise.all([
		db
			.select({ id: clientUsers.id })
			.from(clientUsers)
			.where(
				and(
					eq(clientUsers.clientId, clientId),
					eq(clientUsers.userId, session.user.id),
				),
			)
			.get(),
		db
			.select({ clientId: userClientAssignments.clientId })
			.from(userClientAssignments)
			.where(
				and(
					eq(userClientAssignments.clientId, clientId),
					eq(userClientAssignments.userId, session.user.id),
				),
			)
			.get(),
	]);

	return {
		isClientMember: Boolean(membership),
		assignedClientIds: assignment ? [assignment.clientId] : [],
	};
}
