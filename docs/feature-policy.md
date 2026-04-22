# Feature Policy: Flags Are Effectively Always-On

## Policy Statement

After recent phase expansions, feature flags in this codebase are treated as **always-on** for runtime behavior.

In practice:

- phase flag helpers return `true`
- production/runtime paths assume expanded modules are enabled
- “flag disabled” behavior is no longer an actively supported runtime mode

## Current Implementation

Flag helpers live in:

- `src/lib/flags/phase-1.ts`
- `src/lib/flags/phase-2.ts`
- `src/lib/flags/phase-3.ts`

Each `getPhase*Flag(...)` currently returns `true`, and `getPhase*Flags(...)` returns all-true maps.

## Testing Policy

Legacy tests that assert disabled-flag behavior are intentionally retained as historical artifacts and marked `it.skip(...)`.

Why we keep skipped tests:

- preserves historical intent and rollout context
- documents prior contract behavior without blocking current CI
- allows future teams to re-evaluate if true runtime gating returns

Why we skip them:

- they no longer represent supported runtime operation
- enabling them would create false failures against current policy

## Contributor Rules

When adding or changing features:

1. Assume modules are enabled by default.
2. Do not add new “disabled-path” behavior/tests unless there is explicit product or architecture approval.
3. If you touch legacy flag-off tests, keep them skipped unless policy changes.
4. Prefer permission-based controls (`can(...)`) over rollout flags for access behavior.

## If Policy Changes Later

If the team decides to restore true runtime toggles:

1. update flag helpers to read env/config-driven values,
2. unskip and repair disabled-path tests,
3. update this policy and architecture docs in the same PR.

## Verification with Axon

```bash
# Verify always-on flag implementation
axon_context "getPhase1Flag"
axon_context "getPhase2Flag"
axon_context "getPhase3Flag"

# Find legacy skipped tests
axon_query "it.skip returns 404 when"
```
