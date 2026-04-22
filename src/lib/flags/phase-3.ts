export const phase3FlagKeys = [
	"ff_content_v1",
	"ff_links_v1",
	"ff_eeat_questionnaires_v1",
	"ff_technical_agent_v1",
	"ff_portal_v2",
] as const;

export type Phase3Flag = (typeof phase3FlagKeys)[number];

interface FlagDefinition {
	envVar: string;
	defaultValue: boolean;
}

type FlagEnv = Record<string, string | undefined>;

export function getPhase3Flag(
	flag: Phase3Flag,
	_env: FlagEnv = process.env,
): boolean {
	void flag;
	return true;
}

export function getPhase3Flags(
	_env: FlagEnv = process.env,
): Record<Phase3Flag, boolean> {
	return {
		ff_content_v1: true,
		ff_links_v1: true,
		ff_eeat_questionnaires_v1: true,
		ff_technical_agent_v1: true,
		ff_portal_v2: true,
	};
}

export const phase3Flags = {
	contentV1(env?: FlagEnv) {
		return getPhase3Flag("ff_content_v1", env);
	},
	linksV1(env?: FlagEnv) {
		return getPhase3Flag("ff_links_v1", env);
	},
	eeatQuestionnairesV1(env?: FlagEnv) {
		return getPhase3Flag("ff_eeat_questionnaires_v1", env);
	},
	technicalAgentV1(env?: FlagEnv) {
		return getPhase3Flag("ff_technical_agent_v1", env);
	},
	portalV2(env?: FlagEnv) {
		return getPhase3Flag("ff_portal_v2", env);
	},
} as const;
