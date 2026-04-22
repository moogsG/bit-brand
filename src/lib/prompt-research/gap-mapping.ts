import { z } from "zod";

export const GAP_MAPPING_VERSION = "1.0.0" as const;

const promptSchema = z.object({
	id: z.string().min(1),
	text: z.string().min(1),
	isActive: z.boolean().optional(),
});

const keywordSchema = z.object({
	id: z.string().min(1),
	keyword: z.string().min(1),
	priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional().nullable(),
	status: z.enum(["OPPORTUNITY", "TARGETING", "RANKING", "WON"]).optional().nullable(),
	targetUrl: z.string().optional().nullable(),
	tags: z.string().optional().nullable(),
});

export type GapPromptInput = z.infer<typeof promptSchema>;
export type GapKeywordInput = z.infer<typeof keywordSchema>;

export interface GapMappingReason {
	type:
		| "SUBSTRING_MATCH"
		| "TOKEN_OVERLAP"
		| "TAG_MATCH"
		| "HAS_TARGET_URL";
	message: string;
	keywordId?: string;
	keyword?: string;
	score?: number;
}

export interface GapMappingItem {
	promptId: string;
	promptText: string;
	covered: boolean;
	matchScore: number; // 0..1
	matchedKeywordIds: string[];
	reasons: GapMappingReason[];
}

export interface GapMappingOutput {
	version: typeof GAP_MAPPING_VERSION;
	covered: GapMappingItem[];
	uncovered: GapMappingItem[];
}

function normalizeText(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function tokenize(value: string): string[] {
	const normalized = normalizeText(value);
	if (!normalized) return [];
	return normalized.split(" ").filter((t) => t.length >= 3);
}

function jaccard(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 || b.size === 0) return 0;
	let inter = 0;
	for (const v of a) if (b.has(v)) inter += 1;
	const union = a.size + b.size - inter;
	return union === 0 ? 0 : inter / union;
}

function parseTags(tagsJson: string | null | undefined): string[] {
	if (!tagsJson) return [];
	try {
		const parsed = JSON.parse(tagsJson);
		if (Array.isArray(parsed)) {
			return parsed
				.filter((t) => typeof t === "string")
				.map((t) => normalizeText(t))
				.filter(Boolean);
		}
		return [];
	} catch {
		return [];
	}
}

export function mapPromptsToKeywordCoverage(args: {
	prompts: GapPromptInput[];
	keywords: GapKeywordInput[];
}): GapMappingOutput {
	const prompts = args.prompts.map((p) => promptSchema.parse(p));
	const keywords = args.keywords.map((k) => keywordSchema.parse(k));

	const keywordIndex = keywords.map((k) => {
		const keywordNorm = normalizeText(k.keyword);
		return {
			...k,
			keywordNorm,
			keywordTokens: new Set(tokenize(k.keyword)),
			tagsNorm: parseTags(k.tags),
		};
	});

	const items: GapMappingItem[] = prompts.map((p) => {
		const promptNorm = normalizeText(p.text);
		const promptTokens = new Set(tokenize(p.text));

		let bestScore = 0;
		const matchedKeywordIds: string[] = [];
		const reasons: GapMappingReason[] = [];

		for (const k of keywordIndex) {
			let score = 0;
			let reason: GapMappingReason | null = null;

			// 1) Strong signal: substring match.
			if (k.keywordNorm && (promptNorm.includes(k.keywordNorm) || k.keywordNorm.includes(promptNorm))) {
				score = 1;
				reason = {
					type: "SUBSTRING_MATCH",
					message: `Prompt text overlaps keyword phrase: "${k.keyword}"`,
					keywordId: k.id,
					keyword: k.keyword,
					score,
				};
			} else {
				// 2) Token overlap heuristic.
				const overlap = jaccard(promptTokens, k.keywordTokens);
				score = overlap;
				if (overlap >= 0.35) {
					reason = {
						type: "TOKEN_OVERLAP",
						message: `Prompt shares topic tokens with keyword: "${k.keyword}"`,
						keywordId: k.id,
						keyword: k.keyword,
						score,
					};
				}
			}

			// 3) Tags match as weak supporting signal.
			const tagHit = k.tagsNorm.find((t) => t && promptNorm.includes(t));
			if (tagHit && score < 0.35) {
				score = Math.max(score, 0.35);
				reason = {
					type: "TAG_MATCH",
					message: `Prompt matches keyword tag: "${tagHit}"`,
					keywordId: k.id,
					keyword: k.keyword,
					score,
				};
			}

			if (reason) {
				// Capture all above-threshold matches; prefer best for score.
				matchedKeywordIds.push(k.id);
				reasons.push(reason);
				bestScore = Math.max(bestScore, score);
				// Explicit coverage if keyword already mapped to a URL.
				if (k.targetUrl) {
					reasons.push({
						type: "HAS_TARGET_URL",
						message: `Keyword has a target URL set (${k.targetUrl})`,
						keywordId: k.id,
						keyword: k.keyword,
					});
				}
			}
		}

		const covered = bestScore >= 0.35 && matchedKeywordIds.length > 0;

		return {
			promptId: p.id,
			promptText: p.text,
			covered,
			matchScore: Math.max(0, Math.min(1, bestScore)),
			matchedKeywordIds: Array.from(new Set(matchedKeywordIds)),
			reasons,
		};
	});

	const covered = items.filter((i) => i.covered).sort((a, b) => b.matchScore - a.matchScore);
	const uncovered = items.filter((i) => !i.covered).sort((a, b) => b.matchScore - a.matchScore);

	return { version: GAP_MAPPING_VERSION, covered, uncovered };
}
