"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface FilterOption {
	value: string;
	label: string;
}

interface DashboardFiltersProps {
	statusOptions: FilterOption[];
	managerOptions: FilterOption[];
	industryOptions: FilterOption[];
	current: {
		status: string;
		manager: string;
		industry: string;
	};
}

export function DashboardFilters({
	statusOptions,
	managerOptions,
	industryOptions,
	current,
}: DashboardFiltersProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	function updateFilter(key: string, value: string) {
		const params = new URLSearchParams(searchParams.toString());
		if (value === "ALL") {
			params.delete(key);
		} else {
			params.set(key, value);
		}

		const query = params.toString();
		router.replace(query ? `${pathname}?${query}` : pathname);
	}

	function clearFilters() {
		router.replace(pathname);
	}

	const hasActiveFilters =
		current.status !== "ALL" ||
		current.manager !== "ALL" ||
		current.industry !== "ALL";

	return (
		<Card>
			<CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end">
				<div className="flex flex-col gap-1">
					<label htmlFor="dashboard-filter-status" className="text-xs font-medium text-muted-foreground">
						Status
					</label>
					<select
						id="dashboard-filter-status"
						value={current.status}
						onChange={(event) => updateFilter("status", event.target.value)}
						className="h-9 rounded-md border bg-background px-3 text-sm"
					>
						{statusOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="dashboard-filter-manager" className="text-xs font-medium text-muted-foreground">
						Manager
					</label>
					<select
						id="dashboard-filter-manager"
						value={current.manager}
						onChange={(event) => updateFilter("manager", event.target.value)}
						className="h-9 rounded-md border bg-background px-3 text-sm"
					>
						{managerOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="dashboard-filter-industry" className="text-xs font-medium text-muted-foreground">
						Industry
					</label>
					<select
						id="dashboard-filter-industry"
						value={current.industry}
						onChange={(event) => updateFilter("industry", event.target.value)}
						className="h-9 rounded-md border bg-background px-3 text-sm"
					>
						{industryOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</div>

				<Button
					variant="outline"
					className="w-fit lg:ml-auto"
					disabled={!hasActiveFilters}
					onClick={clearFilters}
				>
					Clear filters
				</Button>
			</CardContent>
		</Card>
	);
}
