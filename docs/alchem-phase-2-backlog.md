# Alchem Phase 2 Execution Backlog

**Scope:** Differentiation phase  
**Source plan:** `docs/alchem-full-implementation-plan.md`  
**Goal:** Ship AI visibility + prompt research differentiation with lens router v2 and EEAT scoring baseline.

---

## 1) Phase 2 Outcomes

By the end of Phase 2, the platform must support:

1. In-house AI visibility tracking across target engines/prompts
2. Prompt research with citation insight and gap mapping
3. Lens router v2 with module-specific recommendation behavior
4. EEAT scoring baseline with actionable recommendations
5. Kanban/task integration improvements tied to module work

---

## 2) Epic Breakdown

- **EPIC-06:** AI Visibility Engine (in-house)
- **EPIC-07:** Prompt Research Module
- **EPIC-08:** AI Lens Router v2
- **EPIC-09:** EEAT Scoring v1
- **EPIC-10:** Kanban Integration Improvements
- **EPIC-11:** Phase 2 Quality, Pilot Rollout, and Safeguards

---

## 3) Story Backlog (Prioritized)

## EPIC-06 — AI Visibility Engine (In-house)

### Story 6.1 — Prompt set management model + APIs
**Priority:** P0  
**Estimate:** 3 days

**Status:** Complete

**Requirements**
- Add per-client prompt set entities (active/inactive) and prompt metadata.
- Support CRUD and prompt ordering.

**Implementation tasks**
- Add schema + migration for prompt sets/prompts.
- Add APIs under `/api/ai/visibility/prompt-sets/*`.
- Enforce RBAC + assignment scoping.

**Acceptance criteria**
- Agency users can create/manage prompt sets for assigned clients.
- Prompt sets are version-safe and queryable.

**Execution checklist (live status)**
- [x] Schema + migration added for prompt sets/prompts
- [x] CRUD APIs added under `/api/ai/visibility/prompt-sets/*`
- [x] RBAC + assignment scoping enforced
- [x] Feature-flag gating enforced via `FF_AI_VISIBILITY_V1`
- [x] Tests added for key endpoints and flag behavior
- [x] Story 6.1 complete

---

### Story 6.2 — Prompt execution run model (non-blocking orchestrated)
**Priority:** P0  
**Estimate:** 4 days

**Requirements**
- Execute prompt batches and store per-engine response metadata.
- Support manual run trigger and future scheduler compatibility.

**Implementation tasks**
- Add run tables (`visibility_runs`, `visibility_run_results`).
- Add run trigger endpoint + status endpoint.
- Persist: engine, visibility yes/no, position estimate, citation snippet.

**Acceptance criteria**
- Run can be triggered and inspected without blocking dashboard.
- Result rows are linked to client + prompt + engine.

**Execution checklist (live status)**
- [x] Schema + migration added for runs + run results
- [x] Run trigger endpoint added (non-blocking run creation)
- [x] Run status/details endpoint added (run + summary + results)
- [x] Execute endpoint added (worker-compatible)
- [x] Placeholder deterministic executor implemented (no external engine dependency)
- [x] RBAC + assignment scoping enforced
- [x] Feature-flag gating enforced via `FF_AI_VISIBILITY_V1`
- [x] Tests added for endpoints
- [x] Story 6.2 complete

---

### Story 6.3 — AI visibility aggregate scoring
**Priority:** P0  
**Estimate:** 2.5 days

**Requirements**
- Build deterministic aggregate score and trend points.
- Feed score into existing client dashboard and AI surfaces.

**Implementation tasks**
- Add scoring service (`src/lib/ai/visibility-score.ts`).
- Store day-level aggregates per client.
- Add tests for bounds/determinism.

**Acceptance criteria**
- Aggregate score reproducible from same run inputs.
- Trend data available for 30/90-day windows.

**Execution checklist (live status)**
- [x] Scoring service added (`src/lib/ai/visibility-score.ts`)
- [x] Day-level aggregates persisted to `ai_visibility` with per-engine breakdown
- [x] Run completion triggers aggregate recompute (best-effort)
- [x] Aggregate trend API added (`/api/ai/visibility/aggregate`)
- [x] RBAC + assignment scoping enforced
- [x] Feature-flag gating enforced via `FF_AI_VISIBILITY_V1`
- [x] Tests added for scoring and aggregate endpoint
- [x] Story 6.3 complete

---

## EPIC-07 — Prompt Research Module

### Story 7.1 — Citation analysis storage + parser
**Priority:** P0  
**Estimate:** 3 days

**Requirements**
- Capture citation sources from run outputs and normalize domains/content types.

**Implementation tasks**
- Add citation tables and parser utility.
- Store normalized source attributes (domain, freshness hint, content format).

**Acceptance criteria**
- Citation sources can be grouped by domain/type/freshness.

**Execution checklist (live status)**
- [x] Schema + migration added for citations linked to run results
- [x] Deterministic citation parser utility added
- [x] Run completion persists parsed citations (best-effort)
- [x] Citation patterns endpoint added (`/api/ai/prompt-research/citations`)
- [x] Feature-flag gating enforced via `FF_PROMPT_RESEARCH_V1`
- [x] RBAC + assignment scoping enforced
- [x] Tests added for parser and endpoint
- [x] Story 7.1 complete

---

### Story 7.2 — Prompt-to-content gap mapping
**Priority:** P1  
**Estimate:** 3 days

**Requirements**
- Map target prompts to existing keyword/content clusters and identify gaps.

**Implementation tasks**
- Add mapping service that joins prompt data with keyword clusters.
- Expose API for “covered vs uncovered” prompts.

**Acceptance criteria**
- Module can show prompt coverage gaps by cluster.

**Execution checklist (live status)**
- [x] Gap mapping service added (`src/lib/prompt-research/gap-mapping.ts`)
- [x] Gap mapping endpoint added (`/api/ai/prompt-research/gaps`)
- [x] Feature-flag gating enforced via `FF_PROMPT_RESEARCH_V1`
- [x] RBAC + assignment scoping enforced via `promptResearch:view`
- [x] Tests added for mapping determinism and endpoint envelope
- [x] Story 7.2 complete

---

### Story 7.3 — Prompt research read model endpoint
**Priority:** P1  
**Estimate:** 2 days

**Requirements**
- Provide UI-ready summary data for prompt research page.

**Implementation tasks**
- Add `/api/ai/prompt-research/[clientId]` read endpoint.
- Include citation patterns, top competitor domains, uncovered prompts.

**Acceptance criteria**
- Response supports direct rendering without heavy client transforms.

**Execution checklist (live status)**
- [x] Read model endpoint added (`/api/ai/prompt-research/[clientId]`)
- [x] Includes top domains + competitor heuristic + coverage summary
- [x] Feature-flag gating enforced via `FF_PROMPT_RESEARCH_V1`
- [x] RBAC + assignment scoping enforced via `promptResearch:view`
- [x] Tests added for disabled and success response shape
- [x] Story 7.3 complete

---

## EPIC-08 — AI Lens Router v2

### Story 8.1 — Lens config schema + registry
**Priority:** P0  
**Estimate:** 2 days

**Requirements**
- Introduce explicit module lens registry with typed config and allowed actions.

**Implementation tasks**
- Add `src/lib/ai/lens-config.ts` (schema + registry).
- Add config entries for `goal-planning`, `keywords`, `prompt-research`, `technical`, `reporting`.

**Acceptance criteria**
- Each lens has typed config and validation.

**Execution checklist (live status)**
- [x] Lens config schema + registry added (`src/lib/ai/lens-config.ts`)
- [x] Registry includes goal-planning, keywords, prompt-research, technical, reporting
- [x] Typed helpers added (get config, resolve from module)
- [x] Tests added for registry validity and completeness
- [x] Story 8.1 complete

---

### Story 8.2 — Lens recommendation endpoint v2 behavior
**Priority:** P0  
**Estimate:** 3 days

**Requirements**
- Upgrade placeholder logic to lens-aware structured recommendations.

**Implementation tasks**
- Extend `/api/ai/lens/recommend` with lens registry and module-specific rules.
- Add recommendation schema versioning.

**Acceptance criteria**
- Different modules return meaningfully different recommendation structures.

**Execution checklist (live status)**
- [x] `/api/ai/lens/recommend` uses lens registry metadata (lens key + display name)
- [x] v2 behavior (`FF_LENS_ROUTER_V2=true`) returns module-specific `details` payloads
- [x] Endpoint remains non-mutating and deterministic (no LLM calls)
- [x] Tests updated to assert lens metadata and per-module differences
- [x] Story 8.2 complete

---

### Story 8.3 — AI interaction audit trail (metadata-only)
**Priority:** P1  
**Estimate:** 2 days

**Requirements**
- Persist safe interaction metadata for observability.

**Implementation tasks**
- Add metadata table (`ai_interactions`) + write service.
- Store non-sensitive telemetry only (no secret/user content dumps).

**Acceptance criteria**
- Interactions are queryable for debugging/quality review.

---

## EPIC-09 — EEAT Scoring v1

### Story 9.1 — EEAT factor model + schema
**Priority:** P0  
**Estimate:** 3 days

**Requirements**
- Model factor groups: authorship, freshness, schema, business trust, reputation signals.

**Implementation tasks**
- Add tables for factor snapshots + recommendations.
- Add scorer utility with bounded score + per-factor breakdown.

**Acceptance criteria**
- EEAT score and factor breakdown generated deterministically.

---

### Story 9.2 — EEAT recommendation generator
**Priority:** P1  
**Estimate:** 2.5 days

**Requirements**
- Produce prioritized next actions from weak factor areas.

**Implementation tasks**
- Add recommendation rule engine and API endpoint.
- Include impact and effort labels.

**Acceptance criteria**
- Recommendations are ranked and actionable.

---

### Story 9.3 — EEAT read endpoint for module display
**Priority:** P1  
**Estimate:** 1.5 days

**Requirements**
- Expose compact read model for dashboard/module integration.

**Implementation tasks**
- Add `/api/eeat/[clientId]` endpoint.

**Acceptance criteria**
- UI can render score + top recommendations directly.

---

## EPIC-10 — Kanban Integration Improvements

### Story 10.1 — Module-linked task metadata
**Priority:** P1  
**Estimate:** 2 days

**Requirements**
- Link task cards to module entities (prompt run, report, strategy, etc.).

**Implementation tasks**
- Extend task/card schema with `moduleType`, `entityId`, `entityLabel`.
- Add API updates and validation.

**Acceptance criteria**
- Tasks are navigable to source module context.

---

### Story 10.2 — Notification hooks for due/blocked states
**Priority:** P2  
**Estimate:** 2 days

**Requirements**
- Trigger lightweight notifications for overdue/blocked module-linked cards.

**Implementation tasks**
- Add notifier service + scheduled check endpoint.

**Acceptance criteria**
- Overdue/blocked card counts reflected in dashboard feed.

---

## EPIC-11 — Quality, Pilot Rollout, and Safeguards

### Story 11.1 — Feature flags for Phase 2 modules
**Priority:** P0  
**Estimate:** 1 day
**Status:** Complete (2026-04-14)

**Requirements**
- Add and wire flags:
  - `ff_ai_visibility_v1`
  - `ff_prompt_research_v1`
  - `ff_lens_router_v2`
  - `ff_eeat_v1`

**Acceptance criteria**
- Features can be toggled by environment with safe fallbacks.

**Execution checklist**
- [x] Added typed feature flag accessors for `ff_ai_visibility_v1`, `ff_prompt_research_v1`, `ff_lens_router_v2`, and `ff_eeat_v1`
- [x] Documented env controls in `.env.example`
- [x] Added endpoint/service gating for AI context and AI lens recommendation behavior
- [x] Added tests for Phase 2 flag parsing and gated endpoint behavior

---

### Story 11.2 — Pilot-client rollout controls + guardrails
**Priority:** P1  
**Estimate:** 2 days

**Requirements**
- Restrict Phase 2 features to pilot clients initially.

**Implementation tasks**
- Add pilot-allowlist support (env or DB-backed).
- Enforce in endpoints and module routes.

**Acceptance criteria**
- Non-pilot clients see graceful “not enabled yet” response.

---

### Story 11.3 — Test hardening for Phase 2 entry points
**Priority:** P0  
**Estimate:** 2.5 days

**Requirements**
- Add regression tests for authz, flags, and deterministic scoring in new modules.

**Acceptance criteria**
- CI passes with coverage for all new endpoints/services.

---

## 4) Dependency Map

1. Story 11.1 (flags) should land before broad Phase 2 module rollout.
2. Story 6.1 precedes 6.2 and 6.3.
3. Story 6.2 precedes 7.1 and 7.2 (citation data depends on runs).
4. Story 8.1 precedes 8.2.
5. Story 9.1 precedes 9.2 and 9.3.
6. Story 11.3 runs throughout, but must complete before Phase 2 signoff.

---

## 5) Suggested Sprint Plan (6 Sprints)

### Sprint 1
- 11.1 Phase 2 feature flags
- 6.1 Prompt set management

### Sprint 2
- 6.2 Prompt execution run model
- 6.3 Visibility aggregate scoring

### Sprint 3
- 7.1 Citation analysis storage
- 7.2 Prompt-to-content gap mapping

### Sprint 4
- 8.1 Lens config registry
- 8.2 Lens recommend v2
- 8.3 Interaction metadata trail

### Sprint 5
- 9.1 EEAT factor model + scorer
- 9.2 EEAT recommendations
- 9.3 EEAT read endpoint

### Sprint 6
- 10.1 Module-linked tasks
- 10.2 Due/blocked notifications
- 11.2 Pilot rollout controls
- 11.3 Final test hardening + signoff

---

## 6) Definition of Done — Phase 2

Phase 2 is complete when all are true:

1. AI visibility runs and aggregates are operational for pilot clients.
2. Prompt research module can expose citation and gap insights.
3. Lens router v2 returns module-specific recommendation structures.
4. EEAT score + recommendations available via stable endpoint.
5. Kanban integrates module-linked work and overdue/blocked signals.
6. Feature flags + pilot controls + tests are in place.

---

## 7) Tracking Template (Copy into board)

Use these statuses:

- `Backlog`
- `Ready`
- `In Progress`
- `In Review`
- `Blocked`
- `Done`

Suggested labels:

- `phase-2`
- `epic-ai-visibility`
- `epic-prompt-research`
- `epic-lens-router`
- `epic-eeat`
- `epic-kanban`
- `pilot-rollout`
- `feature-flag`
- `security`
- `tests`
