export const phase1FlagKeys = [
	"ff_rbac_v2",
	"ff_onboarding_v2",
	"ff_dashboard_v2",
	"ff_ai_context_v1",
	"ff_technical_baseline_v1",
] as const;

export type Phase1Flag = (typeof phase1FlagKeys)[number];

type FlagEnv = Record<string, string | undefined>;

export function getPhase1Flag(
	flag: Phase1Flag,
	_env: FlagEnv = process.env,
): boolean {
	void flag;
	return true;
}

export function getPhase1Flags(
	_env: FlagEnv = process.env,
): Record<Phase1Flag, boolean> {
	return {
		ff_rbac_v2: true,
		ff_onboarding_v2: true,
		ff_dashboard_v2: true,
		ff_ai_context_v1: true,
		ff_technical_baseline_v1: true,
	};
}

export const phase1Flags = {
	rbacV2(env?: FlagEnv) {
		return getPhase1Flag("ff_rbac_v2", env);
	},
	onboardingV2(env?: FlagEnv) {
		return getPhase1Flag("ff_onboarding_v2", env);
	},
	dashboardV2(env?: FlagEnv) {
		return getPhase1Flag("ff_dashboard_v2", env);
	},
	aiContextV1(env?: FlagEnv) {
		return getPhase1Flag("ff_ai_context_v1", env);
	},
	technicalBaselineV1(env?: FlagEnv) {
		return getPhase1Flag("ff_technical_baseline_v1", env);
	},
} as const;
