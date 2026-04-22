const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const implementationChangeStatuses = [
	"APPROVED",
	"RUNNING",
	"SUCCEEDED",
	"FAILED",
	"ROLLED_BACK",
] as const;

export const implementationChangeTypes = [
	"APPROVAL",
	"EXECUTION",
	"ROLLBACK",
] as const;

export type ImplementationChangeStatus =
	(typeof implementationChangeStatuses)[number];
export type ImplementationChangeType =
	(typeof implementationChangeTypes)[number];

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

export interface ClientSafeImplementationChangeFilters {
	search?: string;
	status?: ImplementationChangeStatus | "all";
	type?: ImplementationChangeType | "all";
	from?: string;
	to?: string;
}

function getTimestamp(value: string | null | undefined): number {
	if (!value) {
		return 0;
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return 0;
	}

	return parsed.getTime();
}

function getDateOnlyTimestamp(value: string | null | undefined): number | null {
	if (!value) {
		return null;
	}

	if (datePattern.test(value)) {
		const parsed = new Date(`${value}T00:00:00.000Z`);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed.getTime();
		}
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	return Date.UTC(
		parsed.getUTCFullYear(),
		parsed.getUTCMonth(),
		parsed.getUTCDate(),
	);
}

export function deriveImplementationChangeStatus(
	change: ClientSafeImplementationChange,
): ImplementationChangeStatus | null {
	if (change.rollback) {
		return change.rollback.status;
	}

	if (change.execution) {
		return change.execution.status;
	}

	if (change.approvalStatus) {
		return change.approvalStatus;
	}

	return null;
}

export function deriveImplementationChangeType(
	change: ClientSafeImplementationChange,
): ImplementationChangeType | null {
	if (change.rollback) {
		return "ROLLBACK";
	}

	if (change.execution) {
		return "EXECUTION";
	}

	if (change.approvalStatus) {
		return "APPROVAL";
	}

	return null;
}

function hasChangeType(
	change: ClientSafeImplementationChange,
	type: ImplementationChangeType,
): boolean {
	return deriveImplementationChangeType(change) === type;
}

export function sortImplementationChangesByUpdatedAt(
	changes: readonly ClientSafeImplementationChange[],
): ClientSafeImplementationChange[] {
	return [...changes].sort((a, b) => {
		return getTimestamp(b.updatedAt) - getTimestamp(a.updatedAt);
	});
}

export function applyImplementationChangeFilters(
	changes: readonly ClientSafeImplementationChange[],
	filters: ClientSafeImplementationChangeFilters,
): ClientSafeImplementationChange[] {
	const search = filters.search?.trim().toLowerCase() ?? "";
	const statusFilter = filters.status ?? "all";
	const typeFilter = filters.type ?? "all";
	const fromTs = getDateOnlyTimestamp(filters.from ?? null);
	const toTs = getDateOnlyTimestamp(filters.to ?? null);

	return changes.filter((change) => {
		if (search.length > 0) {
			const haystack =
				`${change.title} ${change.targetRef ?? ""}`.toLowerCase();
			if (!haystack.includes(search)) {
				return false;
			}
		}

		if (statusFilter !== "all") {
			if (deriveImplementationChangeStatus(change) !== statusFilter) {
				return false;
			}
		}

		if (typeFilter !== "all") {
			if (!hasChangeType(change, typeFilter)) {
				return false;
			}
		}

		if (fromTs !== null || toTs !== null) {
			const updatedTs = getDateOnlyTimestamp(change.updatedAt);
			if (updatedTs === null) {
				return false;
			}

			if (fromTs !== null && updatedTs < fromTs) {
				return false;
			}

			if (toTs !== null && updatedTs > toTs) {
				return false;
			}
		}

		return true;
	});
}
