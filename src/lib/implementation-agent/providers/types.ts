import type {
	ImplementationExecution,
	ImplementationProposal,
} from "@/lib/db/schema";

export interface ImplementationExecutionResult {
	success: boolean;
	output?: Record<string, unknown>;
	error?: string;
}

export interface ImplementationExecuteContext {
	dryRun: boolean;
	executionMetadata?: Record<string, unknown>;
}

export interface ImplementationRollbackResult {
	success: boolean;
	details?: Record<string, unknown>;
	error?: string;
}

export interface ImplementationProvider {
	name: string;
	execute(params: {
		proposal: ImplementationProposal;
		context: ImplementationExecuteContext;
	}): Promise<ImplementationExecutionResult>;
	rollback(params: {
		proposal: ImplementationProposal;
		execution: ImplementationExecution;
		reason?: string;
	}): Promise<ImplementationRollbackResult>;
}
