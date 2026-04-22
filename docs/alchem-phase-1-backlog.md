# Alchem Phase 1 Execution Backlog

**Scope:** Foundation phase kickoff  
**Source plan:** `docs/alchem-full-implementation-plan.md`  
**Goal:** Ship RBAC v2 + Onboarding/North Star + Dashboard v2 + Shared Context v1

---

## 1) Phase 1 Outcomes

By the end of Phase 1, the platform must support:

1. Expanded role model and enforceable permissions
2. Structured client onboarding with North Star configuration
3. Agency dashboard showing health, alerts, and pending approvals
4. Shared AI context payload service consumable by modules

---

## 2) Epic Breakdown

- **EPIC-01:** RBAC Expansion & Enforcement
- **EPIC-02:** Client Onboarding & North Star Data Model
- **EPIC-03:** Agency Dashboard v2
- **EPIC-04:** Shared Context Service v1
- **EPIC-05:** Quality, Security, and Rollout Controls

---

## 3) Story Backlog (Prioritized)

## EPIC-01 — RBAC Expansion & Enforcement

### Story 1.1 — Add role model v2
**Priority:** P0  
**Estimate:** 2 days

**Requirements**
- Introduce roles:
  - `AGENCY_OWNER`
  - `ACCOUNT_MANAGER`
  - `STRATEGIST`
  - `CLIENT_ADMIN`
  - `CLIENT_VIEWER`
- Maintain compatibility with existing `ADMIN`/`CLIENT` data during migration.

**Implementation tasks**
- Update `src/lib/db/schema.ts` user role enum.
- Create migration (`drizzle/*`) for enum/table adjustments.
- Add transitional role mapping utility in `src/lib/auth/`.
- Update seed data in `src/lib/db/seed.ts`.

**Acceptance criteria**
- Existing users can still sign in.
- New roles can be assigned and persisted.
- No route breaks from enum mismatch.

**Execution checklist (live status)**
- [x] Implementation merged (schema + migration + auth mapping + seed updates)
- [x] Validation passed (`bunx tsc --noEmit` and `bun run build`)
- [x] Story 1.1 complete

---

### Story 1.2 — Permission matrix + policy engine
**Priority:** P0  
**Estimate:** 3 days

**Requirements**
- Add module/action policy checks (`view`, `edit`, `approve`, `publish`, `execute`).
- Centralize checks to avoid per-route ad hoc logic.

**Implementation tasks**
- Add `src/lib/auth/permissions.ts` (policy definitions).
- Add `src/lib/auth/authorize.ts` helpers:
  - `canAccessClient()`
  - `can(module, action, context)`
- Update critical API routes under `src/app/api/**` to use centralized authz.
- Update agency/client layouts for role-based nav visibility.

**Acceptance criteria**
- Unauthorized roles receive 403 for disallowed actions.
- Client users cannot access internal-only module actions.
- Policy checks are reused by both UI and API surfaces.

**Execution checklist (live status)**
- [x] Implementation merged (permission matrix + policy engine + representative API/UI authz centralization)
- [x] Validation passed (`bunx tsc --noEmit`, `bun run test`, and `bun run build`)
- [x] Story 1.2 complete

---

### Story 1.3 — Assignment model (manager/specialist -> clients)
**Priority:** P1  
**Estimate:** 2 days

**Requirements**
- Account managers and strategists only access assigned clients unless owner.

**Implementation tasks**
- Add assignment table in `src/lib/db/schema.ts` (e.g. `userClientAssignments`).
- Add API for assignment management (admin-only).
- Enforce assignment in client workspace queries + route guards.

**Acceptance criteria**
- Assigned users can access assigned clients only.
- Owners/admins can access all clients.

**Execution checklist (live status)**
- [x] Implementation merged (assignment table + assignment API + scoped client access enforcement)
- [x] Validation passed (`bun run db:migrate`, `bunx tsc --noEmit`, `bun run test`, and `bun run build`)
- [x] Story 1.3 complete

---

## EPIC-02 — Client Onboarding & North Star

### Story 2.1 — Onboarding schema and persistence
**Priority:** P0  
**Estimate:** 3 days

**Requirements**
- Store onboarding questionnaire in structured tables.

**Implementation tasks**
- Add tables (or JSON-backed table) for:
  - business fundamentals
  - north star goal
  - conversion architecture
  - strategic levers
  - competitors
  - current-state baseline
- Migration + seed updates.
- Add service layer in `src/lib/onboarding/`.

**Acceptance criteria**
- Onboarding data is saved and versioned per client.
- API returns complete onboarding profile for a client.

**Execution checklist (live status)**
- [x] Implementation merged (onboarding schema + migration + service layer + onboarding API routes)
- [x] Validation passed (`bun run db:migrate`, `bunx tsc --noEmit`, `bun run test`, and `bun run build`)
- [x] Story 2.1 complete

---

### Story 2.2 — Onboarding wizard UI
**Priority:** P0  
**Estimate:** 4 days

**Requirements**
- Guided flow in agency portal with validation and resume support.

**Implementation tasks**
- New route group:
  - `src/app/admin/clients/[id]/onboarding/page.tsx`
- Build stepper + forms in `src/components/admin/onboarding/*`.
- Add zod schemas for each section.
- Save draft + submit final actions.

**Acceptance criteria**
- User can complete onboarding end-to-end.
- Validation errors are clear and section-specific.
- Returning users can resume incomplete onboarding.

**Execution checklist (live status)**
- [x] Implementation merged (onboarding route + wizard components + step validation + draft/submit/resume flow)
- [x] Validation passed (`bunx tsc --noEmit`, `bun run test`, and `bun run build`)
- [x] Story 2.2 complete

---

### Story 2.3 — North Star ribbon in client workspace
**Priority:** P1  
**Estimate:** 1 day

**Requirements**
- Show concise North Star + progress summary in workspace header.

**Implementation tasks**
- Add shared component `src/components/shared/north-star-ribbon.tsx`.
- Render in admin client workspace layout and key module pages.

**Acceptance criteria**
- Ribbon visible for onboarded clients.
- Graceful empty state for non-onboarded clients.

**Execution checklist (live status)**
- [x] Implementation merged (shared North Star ribbon + rendered across admin client workspace pages)
- [x] Validation passed (`bunx tsc --noEmit`, `bun run test`, and `bun run build`)
- [x] Story 2.3 complete

---

## EPIC-03 — Agency Dashboard v2

### Story 3.1 — Health score model + aggregations
**Priority:** P0  
**Estimate:** 2 days

**Requirements**
- Compute health score from technical, content freshness, and active issue counts.

**Implementation tasks**
- Add health scoring service in `src/lib/health/score.ts`.
- Add data access query layer for dashboard aggregates.
- Optional cache table for daily snapshots.

**Acceptance criteria**
- Score deterministic and reproducible for same inputs.
- Exposes component-level breakdown for UI tooltips.

**Execution checklist (live status)**
- [x] Implementation merged (health scoring service + dashboard aggregate query layer + minimal dashboard integration)
- [x] Validation passed (`bunx tsc --noEmit`, `bun run test`, and `bun run build`)
- [x] Story 3.1 complete

---

### Story 3.2 — Dashboard UI refresh
**Priority:** P0  
**Estimate:** 3 days

**Requirements**
- Client cards + alerts + quick filters + recent activity feed.

**Implementation tasks**
- Update `src/app/admin/dashboard/page.tsx`.
- Add/extend components in `src/components/admin/`:
  - `dashboard-client-card.tsx`
  - `dashboard-alerts-bar.tsx`
  - `dashboard-filters.tsx`
  - `dashboard-activity-feed.tsx`

**Acceptance criteria**
- Cards display North Star, health, issues, approvals.
- Filters work by status, manager, industry.
- Alerts bar reflects top critical items.

**Execution checklist (live status)**
- [x] Implementation merged (dashboard refresh with client cards + alerts bar + quick filters + recent activity feed)
- [x] Validation passed (`bunx tsc --noEmit`, `bun run test`, and `bun run build`)
- [x] Story 3.2 complete

---

### Story 3.3 — Pending approvals count integration
**Priority:** P1  
**Estimate:** 1.5 days

**Requirements**
- Integrate existing approvals/messages/task entities into dashboard counts.

**Implementation tasks**
- Create aggregator query in `src/lib/dashboard/approvals.ts`.
- Wire counts into card and alerts components.

**Acceptance criteria**
- Count matches approvals module source of truth.

**Execution checklist (live status)**
- [x] Implementation merged (dashboard pending approvals query layer + dashboard count wiring)
- [x] Validation passed (`bunx tsc --noEmit`, `bun run test`, and `bun run build`)
- [x] Story 3.3 complete

**Assumptions documented**
- Pending approvals in dashboard represent approvals currently actionable by the viewing user (or all pending for `ADMIN`/`AGENCY_OWNER`).
- Actionability matches approvals module role-assignment logic: policy `requiredRoles` intersect with user global/client-scoped `roleAssignments`.
- Assignment-scoped dashboard roles still see counts only for clients already in their dashboard scope.

---

## EPIC-04 — Shared Context Service v1

### Story 4.1 — ClientContextBuilder service
**Priority:** P0  
**Estimate:** 3 days

**Requirements**
- Compose canonical context payload used by module assistants.

**Implementation tasks**
- Add `src/lib/ai/context-builder.ts`.
- Include:
  - onboarding + north star
  - KPI snapshots
  - active strategy/report summaries
  - key opportunities/risks placeholders
- Add runtime validation schema.

**Acceptance criteria**
- Returns stable typed payload.
- Handles missing data safely.

**Execution checklist (live status)**
- [x] Implementation merged (`src/lib/ai/context-builder.ts` + runtime zod schema + unit tests)
- [x] Validation passed (`bunx tsc --noEmit`, `bun run test`, and `bun run build`)
- [x] Story 4.1 complete

---

### Story 4.2 — Read-only context API endpoint
**Priority:** P0  
**Estimate:** 2 days

**Requirements**
- Provide role-scoped context to modules.

**Implementation tasks**
- Add endpoint: `src/app/api/ai/context/[clientId]/route.ts`.
- Enforce RBAC + assignment checks.
- Add response envelope and version field.

**Acceptance criteria**
- Authorized agency users can fetch context for assigned clients.
- Client users only fetch safe subset (if enabled).
- Unauthorized calls return 403.

**Execution checklist (live status)**
- [x] Implementation merged (`src/app/api/ai/context/[clientId]/route.ts` + authz/assignment checks + response envelope)
- [x] Validation passed (`bunx tsc --noEmit`, `bun run test`, and `bun run build`)
- [x] Story 4.2 complete

**Behavior note (Phase 1)**
- Client safe-subset delivery is intentionally not enabled yet (`AI_CONTEXT_CLIENT_SAFE_SUBSET_ENABLED` defaults to disabled).
- Client-equivalent roles receive an explicit `403` with code `CLIENT_CONTEXT_SAFE_SUBSET_UNSUPPORTED` until safe-subset rollout is enabled.

---

### Story 4.3 — Module assistant placeholder hook
**Priority:** P1  
**Estimate:** 1.5 days

**Requirements**
- Expose non-executing recommendation endpoint to validate integration path.

**Implementation tasks**
- Add endpoint: `src/app/api/ai/lens/recommend/route.ts`.
- Accept `module`, `clientId`, `question` and return structured recommendation.
- Log interaction metadata only (no execution).

**Acceptance criteria**
- Endpoint returns schema-valid recommendation objects.
- No write/mutation actions are performed.

**Execution checklist (live status)**
- [x] Implementation merged (`src/app/api/ai/lens/recommend/route.ts` + placeholder rule-based recommender + envelope schemas)
- [x] Validation passed (`bunx tsc --noEmit`, `bun run test`, and `bun run build`)
- [x] Story 4.3 complete

**Behavior note (Phase 1)**
- Endpoint is non-executing and non-mutating for business entities; it only returns preview recommendations and logs safe interaction metadata.

---

## EPIC-05 — Quality, Security, Rollout

### Story 5.1 — Feature flags for Phase 1 surfaces
**Priority:** P0  
**Estimate:** 1 day

**Implementation tasks**
- Add flags:
  - `ff_rbac_v2`
  - `ff_onboarding_v2`
  - `ff_dashboard_v2`
  - `ff_ai_context_v1`
- Add utility in `src/lib/flags/`.

**Acceptance criteria**
- Features can be toggled per environment.

**Execution checklist (live status)**
- [x] Implementation merged (typed flag utility + env toggles + RBAC/onboarding/dashboard/AI context gating)
- [x] Validation passed (`bunx tsc --noEmit`, `bun run test`, and `bun run build`)
- [x] Story 5.1 complete

---

### Story 5.2 — Test suite additions
**Priority:** P0  
**Estimate:** 3 days

**Implementation tasks**
- Add unit tests for permission policies and health scoring.
- Add integration tests for onboarding APIs and context API.
- Add regression tests for client/agency visibility boundaries.

**Acceptance criteria**
- CI test run passes.
- New tests fail when authz boundaries are violated.

**Execution checklist (live status)**
- [x] Test coverage audited against Story 5.2 acceptance criteria and gaps identified
- [x] Implementation merged (permission + health-score unit edges, onboarding/context integration hardening, and visibility-boundary regression tests)
- [x] Validation passed (`bun run test`, `bunx tsc --noEmit`, and `bun run build`)
- [x] Story 5.2 complete

---

### Story 5.3 — Documentation and migration runbook
**Priority:** P1  
**Estimate:** 1 day

**Implementation tasks**
- Update docs for roles and onboarding setup.
- Add migration/release rollback notes.

**Acceptance criteria**
- Team can perform migration and rollback from docs alone.

**Execution checklist (live status)**
- [x] Implementation merged (Phase 1 operations + migration runbook covering RBAC v2, onboarding v2, AI context ops, flags, and rollback scenarios)
- [x] Validation passed (`bunx tsc --noEmit`, `bun run test`, and `bun run build`)
- [x] Story 5.3 complete

---

## 4) Dependency Map

1. Story 1.1 -> 1.2 -> 1.3 (RBAC chain)
2. Story 2.1 must complete before 2.2 and 4.1
3. Story 4.1 precedes 4.2 and 4.3
4. Story 3.1 precedes 3.2
5. Story 5.1 should be done before UI/API rollout stories

---

## 5) Suggested Sprint Plan (6 Sprints)

### Sprint 1
- 1.1 Add role model v2
- 5.1 Feature flags

### Sprint 2
- 1.2 Permission matrix + policy engine
- 1.3 Assignment model

### Sprint 3
- 2.1 Onboarding schema/persistence
- 2.2 Onboarding wizard (part 1)

### Sprint 4
- 2.2 Onboarding wizard (part 2)
- 2.3 North Star ribbon
- 4.1 Context builder

### Sprint 5
- 3.1 Health scoring
- 3.2 Dashboard v2
- 4.2 Context API

### Sprint 6
- 3.3 Approvals count integration
- 4.3 Lens recommendation endpoint
- 5.2 Tests
- 5.3 Documentation/runbook

---

## 6) Definition of Done — Phase 1

Phase 1 is complete when all are true:

1. RBAC v2 roles and permissions are enforced at route/API level.
2. Onboarding wizard captures and persists full North Star dataset.
3. Dashboard v2 displays health, alerts, and approvals accurately.
4. Shared context API is live and schema-stable.
5. Feature flags and tests protect rollout safety.
6. Migration + rollback docs are complete.

---

## 7) Tracking Template (Copy into task board)

Use this status model for each story:

- `Backlog`
- `Ready`
- `In Progress`
- `In Review`
- `Blocked`
- `Done`

Suggested labels:

- `phase-1`
- `epic-rbac`
- `epic-onboarding`
- `epic-dashboard`
- `epic-ai-context`
- `tech-debt`
- `migration`
- `security`
- `tests`
