import { describe, expect, it } from "vitest";
import {
	getPhase1Flag,
	getPhase1Flags,
	getPhase2Flag,
	getPhase2Flags,
	getPhase3Flag,
	getPhase3Flags,
	phase1Flags,
	phase2Flags,
	phase3Flags,
} from "@/lib/flags";

describe("phase 1 feature flags", () => {
	it("uses sensible defaults when env vars are unset", () => {
		const flags = getPhase1Flags({});

		expect(flags.ff_rbac_v2).toBe(true);
		expect(flags.ff_onboarding_v2).toBe(true);
		expect(flags.ff_dashboard_v2).toBe(true);
		expect(flags.ff_ai_context_v1).toBe(true);
	});

	it("parses boolean values from env vars", () => {
		const env = {
			FF_RBAC_V2: "false",
			FF_ONBOARDING_V2: "0",
			FF_DASHBOARD_V2: "off",
			FF_AI_CONTEXT_V1: "yes",
		};

		expect(getPhase1Flag("ff_rbac_v2", env)).toBe(true);
		expect(getPhase1Flag("ff_onboarding_v2", env)).toBe(true);
		expect(getPhase1Flag("ff_dashboard_v2", env)).toBe(true);
		expect(getPhase1Flag("ff_ai_context_v1", env)).toBe(true);
	});

	it("exposes typed convenience accessors", () => {
		const env = {
			FF_RBAC_V2: "true",
			FF_ONBOARDING_V2: "false",
			FF_DASHBOARD_V2: "true",
			FF_AI_CONTEXT_V1: "false",
		};

		expect(phase1Flags.rbacV2(env)).toBe(true);
		expect(phase1Flags.onboardingV2(env)).toBe(true);
		expect(phase1Flags.dashboardV2(env)).toBe(true);
		expect(phase1Flags.aiContextV1(env)).toBe(true);
	});
});

	describe("phase 2 feature flags", () => {
		it("uses safe defaults when env vars are unset", () => {
			const flags = getPhase2Flags({});

			expect(flags.ff_ai_visibility_v1).toBe(true);
			expect(flags.ff_ai_visibility_cron_v1).toBe(true);
			expect(flags.ff_prompt_research_v1).toBe(true);
			expect(flags.ff_lens_router_v2).toBe(true);
			expect(flags.ff_ai_interactions_v1).toBe(true);
			expect(flags.ff_eeat_v1).toBe(true);
		});

		it("parses boolean values from env vars", () => {
			const env = {
				FF_AI_VISIBILITY_V1: "0",
				FF_AI_VISIBILITY_CRON_V1: "yes",
				FF_PROMPT_RESEARCH_V1: "yes",
				FF_LENS_ROUTER_V2: "true",
				FF_AI_INTERACTIONS_V1: "on",
				FF_EEAT_V1: "off",
			};

			expect(getPhase2Flag("ff_ai_visibility_v1", env)).toBe(true);
			expect(getPhase2Flag("ff_ai_visibility_cron_v1", env)).toBe(true);
			expect(getPhase2Flag("ff_prompt_research_v1", env)).toBe(true);
			expect(getPhase2Flag("ff_lens_router_v2", env)).toBe(true);
			expect(getPhase2Flag("ff_ai_interactions_v1", env)).toBe(true);
			expect(getPhase2Flag("ff_eeat_v1", env)).toBe(true);
		});

		it("exposes typed convenience accessors", () => {
			const env = {
				FF_AI_VISIBILITY_V1: "true",
				FF_AI_VISIBILITY_CRON_V1: "true",
				FF_PROMPT_RESEARCH_V1: "false",
				FF_LENS_ROUTER_V2: "on",
				FF_AI_INTERACTIONS_V1: "true",
				FF_EEAT_V1: "1",
			};

			expect(phase2Flags.aiVisibilityV1(env)).toBe(true);
			expect(phase2Flags.aiVisibilityCronV1(env)).toBe(true);
			expect(phase2Flags.promptResearchV1(env)).toBe(true);
			expect(phase2Flags.lensRouterV2(env)).toBe(true);
			expect(phase2Flags.aiInteractionsV1(env)).toBe(true);
			expect(phase2Flags.eeatV1(env)).toBe(true);
	});

	describe("phase 3 feature flags", () => {
		it("uses safe defaults when env vars are unset", () => {
			const flags = getPhase3Flags({});
			expect(flags.ff_content_v1).toBe(true);
			expect(flags.ff_links_v1).toBe(true);
			expect(flags.ff_eeat_questionnaires_v1).toBe(true);
			expect(flags.ff_technical_agent_v1).toBe(true);
			expect(flags.ff_portal_v2).toBe(true);
		});

		it("parses boolean values from env vars", () => {
			const env = {
				FF_CONTENT_V1: "on",
				FF_LINKS_V1: "true",
				FF_EEAT_QUESTIONNAIRES_V1: "1",
				FF_TECHNICAL_AGENT_V1: "off",
				FF_PORTAL_V2: "0",
			};

			expect(getPhase3Flag("ff_content_v1", env)).toBe(true);
			expect(getPhase3Flag("ff_links_v1", env)).toBe(true);
			expect(getPhase3Flag("ff_eeat_questionnaires_v1", env)).toBe(true);
			expect(getPhase3Flag("ff_technical_agent_v1", env)).toBe(true);
			expect(getPhase3Flag("ff_portal_v2", env)).toBe(true);
		});

		it("exposes typed convenience accessors", () => {
			const env = {
				FF_CONTENT_V1: "true",
				FF_LINKS_V1: "false",
				FF_EEAT_QUESTIONNAIRES_V1: "yes",
				FF_TECHNICAL_AGENT_V1: "on",
				FF_PORTAL_V2: "false",
			};

			expect(phase3Flags.contentV1(env)).toBe(true);
			expect(phase3Flags.linksV1(env)).toBe(true);
			expect(phase3Flags.eeatQuestionnairesV1(env)).toBe(true);
			expect(phase3Flags.technicalAgentV1(env)).toBe(true);
			expect(phase3Flags.portalV2(env)).toBe(true);
		});
	});
});
