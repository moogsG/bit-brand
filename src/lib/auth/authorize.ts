import {
	appUserRoles,
	toLegacyRole,
	type AppUserRole,
	type LegacyRole,
} from "./role-mapping";
import {
	permissionMatrix,
	type PermissionAction,
	type PermissionModule,
	type PermissionRole,
} from "./permissions";

const fullClientAccessRoles: readonly PermissionRole[] = ["ADMIN", "AGENCY_OWNER"];

interface SessionLikeUser {
	id?: string;
	role?: string;
	rawRole?: string;
	clientId?: string;
}

interface SessionLike {
	user?: SessionLikeUser;
}

export interface AuthorizationContext {
	session?: SessionLike | null;
	role?: string | null;
	rawRole?: string | null;
	userClientId?: string | null;
	clientId?: string | null;
	isClientMember?: boolean;
	assignedClientIds?: string[];
}

function isKnownRole(role: string): role is PermissionRole {
	return (appUserRoles as readonly string[]).includes(role);
}

export function resolvePermissionRole(
	context: AuthorizationContext = {},
): PermissionRole {
	const candidate =
		context.rawRole ??
		context.session?.user?.rawRole ??
		context.role ??
		context.session?.user?.role;

	if (!candidate) {
		return "CLIENT";
	}

	if (isKnownRole(candidate)) {
		return candidate as AppUserRole;
	}

	return toLegacyRole(candidate) as LegacyRole;
}

export function canAccessClient(
	clientId: string,
	context: AuthorizationContext = {},
): boolean {
	if (!clientId) {
		return false;
	}

	const role = resolvePermissionRole(context);
	if (fullClientAccessRoles.includes(role)) {
		return true;
	}

	const userClientId = context.userClientId ?? context.session?.user?.clientId;
	if (userClientId && userClientId === clientId) {
		return true;
	}

	if (context.isClientMember) {
		return true;
	}

	if (context.assignedClientIds?.includes(clientId)) {
		return true;
	}

	return false;
}

const clientScopedModules = new Set<PermissionModule>([
	"clients",
	"dataSources",
	"keywords",
	"strategies",
	"reports",
	"aiVisibility",
	"promptResearch",
	"technical",
	"content",
	"links",
	"notifications",
	"messages",
	"approvals",
	"tasks",
	"kanban",
	"sync",
	"export",
	"onboarding",
]);

export function can(
	module: PermissionModule,
	action: PermissionAction,
	context: AuthorizationContext = {},
): boolean {
	const role = resolvePermissionRole(context);
	const allowedActions = permissionMatrix[role]?.[module] ?? [];
	if (!allowedActions.includes(action)) {
		return false;
	}

	if (clientScopedModules.has(module) && context.clientId) {
		return canAccessClient(context.clientId, context);
	}

	return true;
}
