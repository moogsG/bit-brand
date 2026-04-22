"use client";

import { FileDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	applyImplementationChangeFilters,
	type ClientSafeImplementationChange,
	deriveImplementationChangeStatus,
	deriveImplementationChangeType,
	type ImplementationChangeStatus,
	type ImplementationChangeType,
	implementationChangeStatuses,
	implementationChangeTypes,
	sortImplementationChangesByUpdatedAt,
} from "@/lib/implementation-agent/client-safe";
import { cn } from "@/lib/utils";

interface ImplementationChangesTableProps {
	changes: ClientSafeImplementationChange[];
	clientId: string;
}

function getStatusVariant(
	status: ImplementationChangeStatus | null,
): "default" | "destructive" | "secondary" | "outline" {
	if (!status) {
		return "outline";
	}

	switch (status) {
		case "APPROVED":
		case "SUCCEEDED":
			return "default";
		case "FAILED":
			return "destructive";
		case "RUNNING":
		case "ROLLED_BACK":
			return "secondary";
		default:
			return "outline";
	}
}

function formatDateTime(value: string | null): string {
	if (!value) {
		return "—";
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return "—";
	}

	return parsed.toLocaleString();
}

function formatDateInputValue(value: string): string {
	return value;
}

export function ImplementationChangesTable({
	changes,
	clientId,
}: ImplementationChangesTableProps) {
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<
		ImplementationChangeStatus | "all"
	>("all");
	const [typeFilter, setTypeFilter] = useState<
		ImplementationChangeType | "all"
	>("all");
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");

	const filtered = useMemo(() => {
		const rows = applyImplementationChangeFilters(changes, {
			search,
			status: statusFilter,
			type: typeFilter,
			from: from || undefined,
			to: to || undefined,
		});

		return sortImplementationChangesByUpdatedAt(rows);
	}, [changes, search, statusFilter, typeFilter, from, to]);

	const csvHref = useMemo(() => {
		const params = new URLSearchParams({
			type: "implementation_changes",
			clientId,
		});

		if (search.trim().length > 0) {
			params.set("search", search.trim());
		}

		if (statusFilter !== "all") {
			params.set("status", statusFilter);
		}

		if (typeFilter !== "all") {
			params.set("changeType", typeFilter);
		}

		if (from) {
			params.set("from", from);
		}

		if (to) {
			params.set("to", to);
		}

		return `/api/export/csv?${params.toString()}`;
	}, [clientId, search, statusFilter, typeFilter, from, to]);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-3">
				<div className="relative min-w-56 flex-1">
					<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search title or target..."
						className="pl-8"
					/>
				</div>

				<select
					value={statusFilter}
					onChange={(event) =>
						setStatusFilter(
							event.target.value as ImplementationChangeStatus | "all",
						)
					}
					className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm"
				>
					<option value="all">All statuses</option>
					{implementationChangeStatuses.map((status) => (
						<option key={status} value={status}>
							{status}
						</option>
					))}
				</select>

				<select
					value={typeFilter}
					onChange={(event) =>
						setTypeFilter(
							event.target.value as ImplementationChangeType | "all",
						)
					}
					className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm"
				>
					<option value="all">All types</option>
					{implementationChangeTypes.map((type) => (
						<option key={type} value={type}>
							{type}
						</option>
					))}
				</select>

				<label
					htmlFor="implementation-from"
					className="text-xs text-muted-foreground"
				>
					From
				</label>
				<Input
					id="implementation-from"
					type="date"
					value={formatDateInputValue(from)}
					onChange={(event) => setFrom(event.target.value)}
					className="w-40"
				/>
				<label
					htmlFor="implementation-to"
					className="text-xs text-muted-foreground"
				>
					To
				</label>
				<Input
					id="implementation-to"
					type="date"
					value={formatDateInputValue(to)}
					onChange={(event) => setTo(event.target.value)}
					className="w-40"
				/>

				<a
					href={csvHref}
					download
					className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
				>
					<FileDown className="mr-2 h-4 w-4" />
					Export CSV
				</a>
			</div>

			{filtered.length === 0 ? (
				<div className="py-8 text-center text-sm text-muted-foreground">
					{changes.length === 0
						? "No implementation changes are available yet."
						: "No implementation changes match your filters."}
				</div>
			) : (
				<div className="overflow-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-border">
								<th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
									Proposal
								</th>
								<th className="hidden h-10 px-4 text-left align-middle font-medium text-muted-foreground md:table-cell">
									Target
								</th>
								<th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
									Type
								</th>
								<th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
									Status
								</th>
								<th className="hidden h-10 px-4 text-left align-middle font-medium text-muted-foreground xl:table-cell">
									Last Updated
								</th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((change) => {
								const status = deriveImplementationChangeStatus(change);
								const type = deriveImplementationChangeType(change);

								return (
									<tr
										key={change.id}
										className="border-b border-border last:border-0"
									>
										<td className="px-4 py-3">
											<p className="font-medium">{change.title}</p>
											<p className="text-xs text-muted-foreground">
												Updated {formatDateTime(change.updatedAt)}
											</p>
										</td>
										<td className="hidden max-w-[280px] truncate px-4 py-3 text-muted-foreground md:table-cell">
											{change.targetRef ?? "—"}
										</td>
										<td className="px-4 py-3">
											{type ? <Badge variant="outline">{type}</Badge> : "—"}
										</td>
										<td className="px-4 py-3">
											{status ? (
												<Badge variant={getStatusVariant(status)}>
													{status}
												</Badge>
											) : (
												<span className="text-muted-foreground">—</span>
											)}
										</td>
										<td className="hidden px-4 py-3 text-xs text-muted-foreground xl:table-cell">
											{formatDateTime(change.updatedAt)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
