"use client";

import { Loader2, RefreshCw, SearchX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KeywordOpportunity {
	id: string;
	keyword: string;
	monthlyVolume: number | null;
	difficulty: number | null;
	currentPosition: number | null;
	targetPosition: number | null;
	status: string | null;
	priority: string | null;
	intent: string | null;
	opportunityScore: number;
}

interface KeywordOpportunityCluster {
	clusterKey: string;
	label: string;
	size: number;
	avgOpportunityScore: number;
	topKeywords: string[];
}

interface KeywordOpportunitiesData {
	clientId: string;
	opportunities: KeywordOpportunity[];
	clusters: KeywordOpportunityCluster[];
	meta: {
		totalKeywords: number;
		returnedKeywords: number;
		totalClusters: number;
	};
}

interface OpportunitiesApiResponse {
	success: boolean;
	data: KeywordOpportunitiesData | null;
	error: {
		message: string;
	} | null;
}

interface KeywordOpportunitiesPanelProps {
	clientId: string;
}

function formatNumber(value: number | null): string {
	if (typeof value !== "number") {
		return "—";
	}
	return new Intl.NumberFormat("en-US").format(value);
}

export function KeywordOpportunitiesPanel({
	clientId,
}: KeywordOpportunitiesPanelProps) {
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [data, setData] = useState<KeywordOpportunitiesData | null>(null);

	const load = useCallback(
		async (mode: "initial" | "refresh" = "refresh") => {
			setError(null);
			if (mode === "initial") {
				setLoading(true);
			} else {
				setRefreshing(true);
			}

			try {
				const res = await fetch(
					`/api/keywords/opportunities?clientId=${encodeURIComponent(clientId)}`,
				);
				const json = (await res.json()) as OpportunitiesApiResponse;

				if (!res.ok || !json.success || !json.data) {
					throw new Error(
						json.error?.message ?? "Failed to load opportunities",
					);
				}

				setData(json.data);
			} catch (loadError) {
				setError(
					loadError instanceof Error
						? loadError.message
						: "Failed to load opportunities",
				);
			} finally {
				setLoading(false);
				setRefreshing(false);
			}
		},
		[clientId],
	);

	useEffect(() => {
		void load("initial");
	}, [load]);

	const topClusters = useMemo(() => data?.clusters.slice(0, 6) ?? [], [data]);

	if (loading) {
		return (
			<Card>
				<CardContent className="py-12">
					<div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading keyword opportunities…
					</div>
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card>
				<CardContent className="space-y-3 py-10 text-center">
					<p className="text-sm font-medium">
						Couldn&apos;t load opportunities
					</p>
					<p className="text-xs text-muted-foreground">{error}</p>
					<Button variant="outline" onClick={() => void load()}>
						Try again
					</Button>
				</CardContent>
			</Card>
		);
	}

	if (!data || data.opportunities.length === 0) {
		return (
			<Card>
				<CardContent className="space-y-2 py-12 text-center">
					<SearchX className="mx-auto h-8 w-8 text-muted-foreground" />
					<p className="text-sm font-medium">No keyword opportunities yet</p>
					<p className="text-xs text-muted-foreground">
						Add keyword research for this client to generate opportunities.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">Keywords Scored</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-semibold">
							{data.meta.returnedKeywords}
						</p>
						<p className="text-xs text-muted-foreground">
							From {data.meta.totalKeywords} total keywords
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">Opportunity Clusters</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-semibold">{data.meta.totalClusters}</p>
						<p className="text-xs text-muted-foreground">
							Theme groups detected
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">Actions</CardTitle>
					</CardHeader>
					<CardContent>
						<Button variant="outline" size="sm" onClick={() => void load()}>
							<RefreshCw
								className={`mr-2 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
							/>
							{refreshing ? "Refreshing…" : "Refresh"}
						</Button>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Top Opportunities</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					{data.opportunities.slice(0, 25).map((item) => (
						<div
							key={item.id}
							className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
						>
							<div className="min-w-0">
								<p className="truncate text-sm font-medium">{item.keyword}</p>
								<p className="text-xs text-muted-foreground">
									Vol {formatNumber(item.monthlyVolume)} · Diff{" "}
									{formatNumber(item.difficulty)} · Pos{" "}
									{formatNumber(item.currentPosition)} →{" "}
									{formatNumber(item.targetPosition)}
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-1.5">
								<Badge variant="default">Score {item.opportunityScore}</Badge>
								{item.status ? (
									<Badge variant="secondary">{item.status}</Badge>
								) : null}
								{item.priority ? (
									<Badge variant="outline">{item.priority}</Badge>
								) : null}
							</div>
						</div>
					))}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Opportunity Clusters</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
					{topClusters.map((cluster) => (
						<div key={cluster.clusterKey} className="rounded-md border p-3">
							<div className="mb-1 flex items-center justify-between gap-2">
								<p className="truncate text-sm font-medium">{cluster.label}</p>
								<Badge variant="secondary">{cluster.size}</Badge>
							</div>
							<p className="text-xs text-muted-foreground">
								Avg score: {cluster.avgOpportunityScore}
							</p>
							<p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
								{cluster.topKeywords.join(" • ")}
							</p>
						</div>
					))}
				</CardContent>
			</Card>
		</div>
	);
}
