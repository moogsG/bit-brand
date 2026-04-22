import type { ContentAsset } from "@/lib/db/schema";

export type ContentAuditRecommendationType = "REFRESH" | "CONSOLIDATE" | "DELETE" | "RETARGET";
export type ContentAuditSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface ComputedContentAuditFinding {
	assetId: string;
	recommendationType: ContentAuditRecommendationType;
	severity: ContentAuditSeverity;
	reason: string;
	proposedChanges: Record<string, unknown>;
}

function daysBetween(a: Date, b: Date) {
	const ms = Math.abs(a.getTime() - b.getTime());
	return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function safeParseMetadata(metadata: string | null | undefined): Record<string, unknown> {
	if (!metadata) return {};
	try {
		const value = JSON.parse(metadata) as unknown;
		if (value && typeof value === "object" && !Array.isArray(value)) {
			return value as Record<string, unknown>;
		}
		return {};
	} catch {
		return {};
	}
}

function isProbablyTaxonomyUrl(url: string) {
	const lowered = url.toLowerCase();
	return (
		lowered.includes("/tag/") ||
		lowered.includes("/category/") ||
		lowered.includes("/topics/") ||
		lowered.includes("/topic/")
	);
}

export function computeContentAuditFindings(params: {
	assets: readonly ContentAsset[];
	now?: Date;
}): ComputedContentAuditFinding[] {
	const now = params.now ?? new Date();

	const findings: ComputedContentAuditFinding[] = [];

	for (const asset of params.assets) {
		if (!asset?.id) continue;
		if ((asset.status ?? "ACTIVE") !== "ACTIVE") continue;

		const metadata = safeParseMetadata(asset.metadata);
		const duplicateGroupKey = metadata.duplicateGroupKey;
		const lowTraffic = metadata.lowTraffic === true;
		const isThin = metadata.isThin === true;

		// 1) Canonical mismatch → consolidate.
		if (asset.canonicalUrl && asset.canonicalUrl !== asset.url) {
			findings.push({
				assetId: asset.id,
				recommendationType: "CONSOLIDATE",
				severity: "WARNING",
				reason: "URL appears non-canonical (canonicalUrl differs from url)",
				proposedChanges: {
					canonicalUrl: asset.canonicalUrl,
					action: "Consolidate signals to canonical and review redirects/internal links",
				},
			});
		}

		// 2) Duplicate group hint → consolidate.
		if (typeof duplicateGroupKey === "string" && duplicateGroupKey.trim().length > 0) {
			findings.push({
				assetId: asset.id,
				recommendationType: "CONSOLIDATE",
				severity: "WARNING",
				reason: "Asset marked as part of a duplicate cluster",
				proposedChanges: {
					duplicateGroupKey: duplicateGroupKey.trim(),
					action: "Consolidate overlapping pages into a single primary asset",
				},
			});
		}

		// 3) Taxonomy-like URLs → retarget.
		if (isProbablyTaxonomyUrl(asset.url)) {
			findings.push({
				assetId: asset.id,
				recommendationType: "RETARGET",
				severity: "INFO",
				reason: "Taxonomy or archive-style URL detected (often thin/duplicative)",
				proposedChanges: {
					action: "Consider strengthening with unique intro, internal links, and index/noindex policy",
				},
			});
		}

		// 4) Title quality → refresh.
		const title = (asset.title ?? "").trim();
		if (title.length === 0 || title.length < 15) {
			findings.push({
				assetId: asset.id,
				recommendationType: "REFRESH",
				severity: "WARNING",
				reason: "Missing or low-signal title",
				proposedChanges: {
					action: "Rewrite title for clarity, intent match, and differentiation",
				},
			});
		}

		// 5) Crawl freshness → refresh.
		if (!asset.lastCrawledAt) {
			findings.push({
				assetId: asset.id,
				recommendationType: "REFRESH",
				severity: "INFO",
				reason: "Asset has not been crawled yet",
				proposedChanges: {
					action: "Schedule a crawl or ingest crawl data to validate metadata/structure",
				},
			});
		} else {
			const daysOld = daysBetween(now, new Date(asset.lastCrawledAt));
			if (daysOld >= 180) {
				findings.push({
					assetId: asset.id,
					recommendationType: "REFRESH",
					severity: "WARNING",
					reason: "Crawl data is stale (>= 180 days)",
					proposedChanges: {
						daysSinceCrawl: daysOld,
						action: "Re-crawl and refresh content/metadata based on current intent",
					},
				});
			}
		}

		// 6) Low-traffic/thin hints → retarget or delete (deterministic rule).
		if (lowTraffic && isThin) {
			findings.push({
				assetId: asset.id,
				recommendationType: "DELETE",
				severity: "INFO",
				reason: "Asset marked low-traffic and thin",
				proposedChanges: {
					action: "Consider removal or merge into a stronger page; validate with analytics before execution",
				},
			});
		} else if (lowTraffic) {
			findings.push({
				assetId: asset.id,
				recommendationType: "RETARGET",
				severity: "INFO",
				reason: "Asset marked low-traffic",
				proposedChanges: {
					action: "Retarget keyword/intent and improve internal linking; validate with Search Console",
				},
			});
		}
	}

	// Stable output ordering.
	const byKey = (f: ComputedContentAuditFinding) => `${f.assetId}:${f.recommendationType}:${f.severity}:${f.reason}`;
	return [...findings].sort((a, b) => byKey(a).localeCompare(byKey(b)));
}
