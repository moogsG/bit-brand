import type { ImplementationProvider } from "./types";

export const noopImplementationProvider: ImplementationProvider = {
	name: "noop",
	async execute({ proposal, context }) {
		return {
			success: true,
			output: {
				provider: "noop",
				dryRun: context.dryRun,
				note: "No-op execution completed. No code changes applied.",
				proposalId: proposal.id,
			},
		};
	},
	async rollback({ proposal, execution, reason }) {
		return {
			success: true,
			details: {
				provider: "noop",
				note: "No-op rollback completed. No code changes reverted.",
				proposalId: proposal.id,
				executionId: execution.id,
				reason: reason ?? null,
			},
		};
	},
};
