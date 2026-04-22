export const VISIBILITY_EXECUTOR_VERSION = "1.0.0" as const;

export type VisibilityExecutorMode = "placeholder" | "provider";
export type VisibilityExecutorEngine = "CHATGPT" | "PERPLEXITY" | "GEMINI";

export interface VisibilityExecutionMetadata {
	version: typeof VISIBILITY_EXECUTOR_VERSION;
	requestedMode: VisibilityExecutorMode;
	effectiveMode: VisibilityExecutorMode;
	source: "placeholder-deterministic" | "provider-stub";
	usedFallback: boolean;
	fallbackReason: string | null;
}

export interface VisibilityExecutorInput {
	engine: VisibilityExecutorEngine;
	promptText: string;
}

export interface VisibilityExecutorOutput {
	isVisible: boolean;
	position: number | null;
	responseSnippet: string;
	citationDomain: string | null;
	citationSnippet: string | null;
	metadata: VisibilityExecutionMetadata;
}

type VisibilityExecutorEnv = Record<string, string | undefined>;

function stableHash(input: string): number {
	let hash = 0;
	for (let i = 0; i < input.length; i += 1) {
		hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
	}
	return hash;
}

function computeDeterministicResult(args: {
	engine: VisibilityExecutorEngine;
	promptText: string;
	seedPrefix: string;
}): {
	isVisible: boolean;
	position: number | null;
	responseSnippet: string;
} {
	const seed = stableHash(`${args.seedPrefix}:${args.engine}:${args.promptText}`);
	// Deterministic placeholder-style behavior: ~20% visibility.
	const isVisible = seed % 10 < 2;
	const position = isVisible ? (seed % 5) + 1 : null;
	const responseSnippet = isVisible
		? `Visible in ${args.engine} at position ${position}.`
		: `Not visible in ${args.engine}.`;

	return { isVisible, position, responseSnippet };
}

function getExecutorMode(env: VisibilityExecutorEnv = process.env): VisibilityExecutorMode {
	const raw = env.AI_VISIBILITY_EXECUTOR_MODE?.trim().toLowerCase();
	if (raw === "provider") return "provider";
	return "placeholder";
}

function hasProviderCredentials(env: VisibilityExecutorEnv = process.env): boolean {
	// Phase 2 helper: when provider mode is selected, we require provider env to be present.
	// If missing, executor gracefully falls back to deterministic placeholder mode.
	const apiKey = env.AI_VISIBILITY_PROVIDER_API_KEY?.trim();
	const providerName = env.AI_VISIBILITY_PROVIDER_NAME?.trim();
	return Boolean(apiKey && providerName);
}

export function executeVisibilityPrompt(
	input: VisibilityExecutorInput,
	env: VisibilityExecutorEnv = process.env,
): VisibilityExecutorOutput {
	const requestedMode = getExecutorMode(env);

	if (requestedMode === "provider") {
		if (!hasProviderCredentials(env)) {
			const fallback = computeDeterministicResult({
				engine: input.engine,
				promptText: input.promptText,
				seedPrefix: "placeholder",
			});

			const metadata: VisibilityExecutionMetadata = {
				version: VISIBILITY_EXECUTOR_VERSION,
				requestedMode,
				effectiveMode: "placeholder",
				source: "placeholder-deterministic",
				usedFallback: true,
				fallbackReason:
					"Provider mode requested but AI_VISIBILITY_PROVIDER_NAME / AI_VISIBILITY_PROVIDER_API_KEY is missing",
			};

			return {
				isVisible: fallback.isVisible,
				position: fallback.position,
				responseSnippet: `[executor:${metadata.effectiveMode}/${metadata.source}] ${fallback.responseSnippet}`,
				citationDomain: null,
				citationSnippet: JSON.stringify({ executor: metadata }),
				metadata,
			};
		}

		// Stub-safe provider mode for Phase 2 closure: deterministic output without external calls.
		const providerStub = computeDeterministicResult({
			engine: input.engine,
			promptText: input.promptText,
			seedPrefix: "provider",
		});

		const metadata: VisibilityExecutionMetadata = {
			version: VISIBILITY_EXECUTOR_VERSION,
			requestedMode,
			effectiveMode: "provider",
			source: "provider-stub",
			usedFallback: false,
			fallbackReason: null,
		};

		return {
			isVisible: providerStub.isVisible,
			position: providerStub.position,
			responseSnippet: `[executor:${metadata.effectiveMode}/${metadata.source}] ${providerStub.responseSnippet}`,
			citationDomain: null,
			citationSnippet: JSON.stringify({ executor: metadata }),
			metadata,
		};
	}

	const placeholder = computeDeterministicResult({
		engine: input.engine,
		promptText: input.promptText,
		seedPrefix: "placeholder",
	});

	const metadata: VisibilityExecutionMetadata = {
		version: VISIBILITY_EXECUTOR_VERSION,
		requestedMode,
		effectiveMode: "placeholder",
		source: "placeholder-deterministic",
		usedFallback: false,
		fallbackReason: null,
	};

	return {
		isVisible: placeholder.isVisible,
		position: placeholder.position,
		responseSnippet: `[executor:${metadata.effectiveMode}/${metadata.source}] ${placeholder.responseSnippet}`,
		citationDomain: null,
		citationSnippet: JSON.stringify({ executor: metadata }),
		metadata,
	};
}

export function getVisibilityExecutorMode(env: VisibilityExecutorEnv = process.env) {
	return getExecutorMode(env);
}
