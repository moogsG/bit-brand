import { z } from "zod";

export const LENS_CONFIG_VERSION = "1.0.0" as const;

export const lensKeySchema = z.enum([
	"goal-planning",
	"keywords",
	"prompt-research",
	"technical",
	"reporting",
]);

export type LensKey = z.infer<typeof lensKeySchema>;

export const lensActionSchema = z.enum([
	"VIEW_CONTEXT",
	"RECOMMEND",
	"ANALYZE",
	"DRAFT",
]);

export type LensAction = z.infer<typeof lensActionSchema>;

export const lensConfigSchema = z.object({
	version: z.literal(LENS_CONFIG_VERSION),
	key: lensKeySchema,
	displayName: z.string().min(1),
	description: z.string().min(1),
	// Allowed actions are *non-mutating* capabilities.
	allowedActions: z.array(lensActionSchema).min(1),
	// Canonical module ids this lens may serve.
	moduleAliases: z.array(z.string().min(1)).min(1),
	// Safety: this platform is approval-gated; lens never executes directly.
	safePreviewOnly: z.literal(true),
});

export type LensConfig = z.infer<typeof lensConfigSchema>;

export const lensRegistry: Record<LensKey, LensConfig> = {
	"goal-planning": {
		version: LENS_CONFIG_VERSION,
		key: "goal-planning",
		displayName: "Goal Planning",
		description:
			"Strategic advisor focused on North Star alignment, levers, and milestones.",
		allowedActions: ["VIEW_CONTEXT", "ANALYZE", "RECOMMEND", "DRAFT"],
		moduleAliases: ["goal-planning", "onboarding", "dashboard"],
		safePreviewOnly: true,
	},
	keywords: {
		version: LENS_CONFIG_VERSION,
		key: "keywords",
		displayName: "Keyword Research",
		description:
			"Discovery, clustering, and opportunity scoring for keyword targeting.",
		allowedActions: ["VIEW_CONTEXT", "ANALYZE", "RECOMMEND", "DRAFT"],
		moduleAliases: ["keywords"],
		safePreviewOnly: true,
	},
	"prompt-research": {
		version: LENS_CONFIG_VERSION,
		key: "prompt-research",
		displayName: "Prompt Research",
		description:
			"Citation analysis and prompt-to-content gap identification for AI visibility.",
		allowedActions: ["VIEW_CONTEXT", "ANALYZE", "RECOMMEND"],
		moduleAliases: ["prompt-research", "ai-visibility"],
		safePreviewOnly: true,
	},
	technical: {
		version: LENS_CONFIG_VERSION,
		key: "technical",
		displayName: "Technical SEO",
		description:
			"Diagnostics and fix recommendations for crawl/indexability, schema, and performance.",
		allowedActions: ["VIEW_CONTEXT", "ANALYZE", "RECOMMEND"],
		moduleAliases: ["technical"],
		safePreviewOnly: true,
	},
	reporting: {
		version: LENS_CONFIG_VERSION,
		key: "reporting",
		displayName: "Reporting",
		description:
			"Narrative insight synthesis and anomaly detection for reports and analytics.",
		allowedActions: ["VIEW_CONTEXT", "ANALYZE", "DRAFT", "RECOMMEND"],
		moduleAliases: ["reports", "reporting", "strategy"],
		safePreviewOnly: true,
	},
} as const;

export function getLensConfig(key: LensKey): LensConfig {
	return lensRegistry[key];
}

export function resolveLensKeyFromModule(moduleId: string): LensKey {
	const normalized = moduleId.trim().toLowerCase();
	for (const [key, cfg] of Object.entries(lensRegistry) as Array<
		[LensKey, LensConfig]
	>) {
		if (cfg.moduleAliases.some((m) => m.toLowerCase() === normalized)) {
			return key;
		}
	}
	// Default to goal-planning to keep experience usable.
	return "goal-planning";
}

export function validateLensRegistry(): { ok: true } {
	for (const cfg of Object.values(lensRegistry)) {
		lensConfigSchema.parse(cfg);
	}
	return { ok: true };
}
