export const phase2FlagKeys = [
	"ff_ai_visibility_v1",
	"ff_ai_visibility_cron_v1",
	"ff_prompt_research_v1",
	"ff_lens_router_v2",
	"ff_ai_interactions_v1",
	"ff_eeat_v1",
	"ff_eeat_scoring_v1",
] as const;

export type Phase2Flag = (typeof phase2FlagKeys)[number];

interface FlagDefinition {
	envVar: string;
	defaultValue: boolean;
}

type FlagEnv = Record<string, string | undefined>;

export function getPhase2Flag(
	flag: Phase2Flag,
	_env: FlagEnv = process.env,
): boolean {
	void flag;
	return true;
}

export function getPhase2Flags(
	_env: FlagEnv = process.env,
): Record<Phase2Flag, boolean> {
	return {
		ff_ai_visibility_v1: true,
		ff_ai_visibility_cron_v1: true,
		ff_prompt_research_v1: true,
		ff_lens_router_v2: true,
		ff_ai_interactions_v1: true,
		ff_eeat_v1: true,
		ff_eeat_scoring_v1: true,
	};
}

export const phase2Flags = {
	aiVisibilityV1(env?: FlagEnv) {
		return getPhase2Flag("ff_ai_visibility_v1", env);
	},
	aiVisibilityCronV1(env?: FlagEnv) {
		return getPhase2Flag("ff_ai_visibility_cron_v1", env);
	},
	promptResearchV1(env?: FlagEnv) {
		return getPhase2Flag("ff_prompt_research_v1", env);
	},
	lensRouterV2(env?: FlagEnv) {
		return getPhase2Flag("ff_lens_router_v2", env);
	},
	aiInteractionsV1(env?: FlagEnv) {
		return getPhase2Flag("ff_ai_interactions_v1", env);
	},
	eeatV1(env?: FlagEnv) {
		return getPhase2Flag("ff_eeat_v1", env);
	},
	eeatScoringV1(env?: FlagEnv) {
		return getPhase2Flag("ff_eeat_scoring_v1", env);
	},
} as const;
