import type { ImplementationProvider } from "./types";

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
	if (value === undefined) {
		return defaultValue;
	}

	switch (value.trim().toLowerCase()) {
		case "1":
		case "true":
		case "yes":
		case "on":
			return true;
		case "0":
		case "false":
		case "no":
		case "off":
			return false;
		default:
			return defaultValue;
	}
}

function parseProposalMetadata(proposalJson: string): {
	targetRef: string | null;
	operation: string | null;
} {
	try {
		const parsed = JSON.parse(proposalJson) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return { targetRef: null, operation: null };
		}

		const record = parsed as Record<string, unknown>;
		const targetRef =
			typeof record.targetRef === "string" && record.targetRef.trim().length > 0
				? record.targetRef.trim()
				: null;
		const operation =
			typeof record.operation === "string" && record.operation.trim().length > 0
				? record.operation.trim()
				: null;

		return { targetRef, operation };
	} catch {
		return { targetRef: null, operation: null };
	}
}

export const wordpressImplementationProvider: ImplementationProvider = {
	name: "wordpress",
	async execute({ proposal, context }) {
		const allowLiveWrite = parseBooleanEnv(
			process.env.IMPLEMENTATION_WP_ALLOW_LIVE_WRITE,
			false,
		);
		const providerMode = process.env.IMPLEMENTATION_WP_PROVIDER_MODE ?? "scaffold";
		const { targetRef, operation } = parseProposalMetadata(proposal.proposalJson);

		if (!context.dryRun && !allowLiveWrite) {
			const blockedReason =
				"Live WordPress writes are blocked. Set IMPLEMENTATION_WP_ALLOW_LIVE_WRITE=true to enable explicit write attempts.";
			return {
				success: false,
				error: blockedReason,
				output: {
					provider: "wordpress",
					dryRun: false,
					writeAttempted: false,
					writeApplied: false,
					blockedReason,
					targetRef,
					operation,
					providerMode,
				},
			};
		}

		if (context.dryRun) {
			return {
				success: true,
				output: {
					provider: "wordpress",
					dryRun: true,
					writeAttempted: false,
					writeApplied: false,
					blockedReason: null,
					targetRef,
					operation,
					providerMode,
					note: "WordPress provider dry-run scaffold executed. No remote changes were applied.",
				},
			};
		}

		const blockedReason =
			"WordPress live write scaffold is not implemented yet. No remote changes were applied.";
		return {
			success: false,
			error: blockedReason,
			output: {
				provider: "wordpress",
				dryRun: false,
				writeAttempted: true,
				writeApplied: false,
				blockedReason,
				targetRef,
				operation,
				providerMode,
			},
		};
	},
	async rollback({ proposal, execution, reason }) {
		return {
			success: false,
			error:
				"WordPress rollback scaffold is not implemented. No remote changes were reverted.",
			details: {
				provider: "wordpress",
				note: "Rollback scaffold only.",
				proposalId: proposal.id,
				executionId: execution.id,
				reason: reason ?? null,
			},
		};
	},
};
