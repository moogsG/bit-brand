import { noopImplementationProvider } from "./noop";
import { wordpressImplementationProvider } from "./wordpress";
import type { ImplementationProvider } from "./types";

export const implementationProviderNames = ["noop", "wordpress"] as const;
export type ImplementationProviderName =
	(typeof implementationProviderNames)[number];

const providers: Record<string, ImplementationProvider> = {
	noop: noopImplementationProvider,
	wordpress: wordpressImplementationProvider,
};

export function findImplementationProvider(
	name: string,
): ImplementationProvider | null {
	return providers[name] ?? null;
}

export function isImplementationProviderName(
	value: string,
): value is ImplementationProviderName {
	return (implementationProviderNames as readonly string[]).includes(value);
}

export function getImplementationProvider(
	name: string,
): ImplementationProvider {
	return findImplementationProvider(name) ?? noopImplementationProvider;
}

export { noopImplementationProvider };
export { wordpressImplementationProvider };
export type {
	ImplementationExecuteContext,
	ImplementationExecutionResult,
	ImplementationProvider,
	ImplementationRollbackResult,
} from "./types";
