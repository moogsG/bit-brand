# Alchem Implementation Progress Checklist

**Last updated:** 2026-04-23  
**Tracking scope:** `docs/alchem-full-implementation-plan.md` + `docs/alchem-phase-1-backlog.md`

Use this as the single status tracker for phase completion.

---

## Legend

- [ ] Missing
- [~] Partial
- [x] Complete

---

## Overall Phase Status

- [x] **Phase 1 — Foundation**
- [~] **Phase 2 — Differentiation**
- [x] **Phase 3 — Content, Links, Collaboration**
- [ ] **Phase 4 — Scale & Polish**

---

## Phase 0 (Planning Artifacts)

- [x] Full implementation plan documented (`alchem-full-implementation-plan.md`)
- [x] Phase 1 execution backlog documented (`alchem-phase-1-backlog.md`)
- [x] Phase 2 backlog documented (`alchem-phase-2-backlog.md`)
- [x] Phase 3 backlog documented (`alchem-phase-3-backlog.md`)
- [ ] Phase 4 backlog documented

---

## Phase 1 — Foundation Checklist

### EPIC-01: RBAC Expansion & Enforcement
- [x] Story 1.1 Add role model v2
- [x] Story 1.2 Permission matrix + policy engine
- [x] Story 1.3 Assignment model (manager/specialist -> clients)
- [x] End-to-end enforcement across scoped API surfaces

### EPIC-02: Client Onboarding & North Star
- [x] Story 2.1 Onboarding schema and persistence
- [x] Story 2.2 Onboarding wizard UI
- [x] Story 2.3 North Star ribbon in client workspace

### EPIC-03: Agency Dashboard v2
- [x] Story 3.1 Health score model + aggregations
- [x] Story 3.2 Dashboard UI refresh
- [x] Story 3.3 Pending approvals count integration

### EPIC-04: Shared Context Service v1
- [x] Story 4.1 ClientContextBuilder service
- [x] Story 4.2 Read-only context API endpoint
- [x] Story 4.3 Client-safe default context shaping by role

### EPIC-05b: Keyword + Technical Baseline (Phase 1 Objective E)
- [x] Keyword opportunity scoring + clustering uplift
- [x] Initial technical crawler checks (title/meta, canonical, schema, broken links)

### EPIC-05: Quality, Security, Rollout
- [x] Story 5.1 Feature flags for Phase 1 surfaces
- [x] Story 5.2 Test suite additions
- [x] Story 5.3 Documentation and migration runbook

### Phase 1 Exit Criteria
- [x] RBAC v2 enforced end-to-end (Phase 1 scope)
- [x] Onboarding complete for new clients
- [x] Dashboard v2 health + approvals working
- [x] Shared context endpoint available to modules
- [x] Keyword + technical baseline operational
- [x] Feature flags and tests in place
- [x] Migration and rollback docs complete

---

## Phase 2 — Differentiation Checklist

- [~] AI Visibility Engine (in-house prompt testing)
- [x] Prompt Research module (citation analysis + gap mapping)
- [~] AI Lens Router v2 (module-specific behavior)
- [~] EEAT Scoring v1
- [~] Kanban integration improvements

### Phase 2 Exit Criteria
- [~] AI visibility tracking running for pilot clients
- [x] Prompt insights connected to strategy/content planning
- [~] EEAT scores and recommendations visible

### Phase 2 Execution Notes (recent slices)

- **Slice 1 (partial):** visibility executor adapter + cron route shipped.
  - Evidence: `src/lib/ai/visibility-executor.ts` (mode adapter + fallback + provider-stub metadata) and `src/app/api/cron/ai-visibility-runs/route.ts` (flag-gated, `CRON_SECRET`-protected cron executor).
  - Remaining gap: provider mode is still stubbed (no live external provider call path yet).
- **Slice 2 (complete for scoped slice):** prompt research recommendations are now consumable by API, strategy editor, and lens details.
  - Evidence: `src/app/api/ai/prompt-research/recommendations/route.ts`, `src/app/admin/clients/[id]/strategy/[strategyId]/page.tsx`, `src/components/admin/strategy-editor.tsx`, `src/app/api/ai/lens/recommend/route.ts` (`detailsOverrides` includes prompt-research payload).
- **Slice 3 (partial):** EEAT structured action recommendations + task linkage label path + notifications endpoints/cron landed.
  - Evidence: `src/lib/eeat/scoring.ts` (structured recommendation payload), `src/app/api/tasks/route.ts` (`linkedResourceType|Id|Label`), `src/app/api/notifications/route.ts`, and `src/app/api/cron/tasks-alerts/route.ts`.

### Remaining Blockers for Phase 2 Sign-off

- **AI visibility production execution not finished:** `provider` mode currently returns deterministic stub output (`source: "provider-stub"`) in `visibility-executor.ts`; real provider integration + credentialed runtime validation is still required.
- **Pilot rollout evidence incomplete:** cron endpoints exist, but sign-off still needs verified pilot-client runs in production-like conditions (scheduled invocation, success/failure monitoring, and operational run evidence).
- **EEAT + task loop is not fully signed off:** recommendations and linkage plumbing exist, but end-to-end pilot proof (recommendation surfaced → linked task tracked → alert lifecycle validated) is still pending.

---

## Phase 3 — Content, Links, Collaboration Checklist

- [x] EPIC-12 Content Audit v1
- [x] EPIC-13 Content Calendar + Brief Workflow
- [x] EPIC-14 EEAT Questionnaires (Portal)
- [x] EPIC-15 Links Intelligence
- [x] EPIC-16 Technical Implementation Agent v1 (approval-gated)
- [x] EPIC-17 Client Portal v2 Collaboration
- [x] EPIC-18 Phase 3 Quality, Rollout, and Safeguards

### Phase 3 Execution Notes
- **Story 12.1 (complete):** content assets inventory model + scoped read API shipped.
  - Evidence: `src/lib/db/schema.ts` (`content_assets`), `drizzle/migrations/0010_amusing_the_spike.sql`, `src/app/api/content/assets/route.ts`, `tests/content-assets-api.test.ts`.
- **Story 12.2 (complete):** deterministic content audit compute + persisted findings read/recompute shipped.
  - Evidence: `src/lib/content/audit.ts`, `src/lib/db/schema.ts` (`content_audit_findings`), `src/app/api/content/audit/route.ts`, `tests/content-audit-api.test.ts`.
- **Story 13.1 (complete):** briefs CRUD + approval request flow shipped, with client-equivalent access restricted to approved brief summaries only.
  - Evidence: `src/lib/db/schema.ts` (`content_briefs`), `drizzle/migrations/0012_strange_black_queen.sql`, `src/app/api/content/briefs/route.ts`, `src/app/api/content/briefs/[briefId]/route.ts`, `tests/content-briefs-api.test.ts` (approved-summary filtering + single-brief non-approved 404).
- **Story 13.2 (complete):** immutable append-only brief versions shipped.
  - Evidence: `src/lib/db/schema.ts` (`content_versions`), `drizzle/migrations/0013_content_versions.sql`, `src/app/api/content/briefs/[briefId]/versions/route.ts`, `tests/content-brief-versions-api.test.ts`.
- **Story 13.3 (complete):** content calendar endpoints with date/status filters shipped.
  - Evidence: `src/lib/db/schema.ts` (`content_calendar_items`), `drizzle/migrations/0014_content_calendar_items.sql`, `src/app/api/content/calendar/route.ts`, `tests/content-calendar-api.test.ts`.
- **Story 14.1 (complete):** questionnaire templates + single-active behavior shipped.
  - Evidence: `src/lib/db/schema.ts` (`eeat_questionnaires`), `drizzle/migrations/0015_eeat_questionnaires.sql`, `src/app/api/eeat/questionnaires/route.ts`, `tests/eeat-questionnaires-api.test.ts`.
- **Story 14.2 (complete):** response capture API now has a portal submission UI behind `FF_PORTAL_V2` with scoped auth checks.
  - Evidence: `src/app/portal/[clientSlug]/eeat-questionnaire/page.tsx`, `src/components/portal/portal-eeat-questionnaire-form.tsx`, `src/app/api/eeat/questionnaires/route.ts`, `src/app/api/eeat/responses/route.ts`, `tests/portal-v2-pages-gating.test.ts`.
- **Story 15.1 (complete):** backlink inventory API now includes explicit placeholder import/sync POST behavior.
  - Evidence: `src/app/api/links/backlinks/route.ts` (`POST` placeholder/no-op), `tests/links-backlinks-api.test.ts`.
- **Story 15.2 (complete):** prospects CRUD + deterministic scoring shipped.
  - Evidence: `src/lib/db/schema.ts` (`link_prospects`), `drizzle/migrations/0023_links_prospects_outreach.sql`, `src/lib/links/scoring.ts`, `src/app/api/links/prospects/route.ts`, `src/app/api/links/prospects/[id]/route.ts`, `tests/links-prospects-api.test.ts`.
- **Story 15.3 (complete):** outreach drafts + approval-gated send shipped (safe stub send).
  - Evidence: `src/lib/db/schema.ts` (`link_outreach_drafts`), `src/app/api/links/outreach/route.ts`, `src/app/api/links/outreach/[id]/request-approval/route.ts`, `src/app/api/links/outreach/[id]/send/route.ts`, `tests/links-outreach-send-api.test.ts`.
- **Story 16.1 (complete):** implementation proposal queue APIs + approval integration + admin UI shipped.
  - Evidence: `src/lib/db/schema.ts` (`implementation_proposals`), `drizzle/migrations/0021_implementation_queue.sql`, `src/app/api/implementation-queue/proposals/route.ts`, `src/app/api/implementation-queue/proposals/request-approval/route.ts`, `src/components/admin/implementation-queue-panel.tsx`, `tests/implementation-queue-proposals-api.test.ts`.
- **Story 16.2 (complete):** execution/rollback flows now persist first-class implementation snapshots for rollback-safe metadata.
  - Evidence: `src/lib/db/schema.ts` (`implementation_snapshots`), `drizzle/migrations/0024_implementation_snapshots.sql`, `src/lib/implementation-agent/service.ts`, `tests/implementation-queue-service-execute.test.ts`.
- **Story 17.1 (complete):** portal approvals and related collaboration surfaces are now consistently gated behind `FF_PORTAL_V2`.
  - Evidence: `src/app/portal/[clientSlug]/approvals/page.tsx`, `src/app/portal/[clientSlug]/notifications/page.tsx`, `src/app/portal/[clientSlug]/eeat-questionnaire/page.tsx`, `src/components/portal/portal-sidebar.tsx`, `tests/portal-v2-pages-gating.test.ts`.
- **Story 17.2 (complete):** portal notifications entry point + read-state actions are client scoped.
  - Evidence: `src/app/portal/[clientSlug]/notifications/page.tsx`, `src/components/portal/notifications-list.tsx`, `src/app/api/notifications/route.ts`, `tests/notifications-api.test.ts`.
- **Story 18.1 (complete):** Phase 3 portal collaboration surfaces are now consistently gated by `FF_PORTAL_V2`.
  - Evidence: `src/lib/flags/phase-3.ts`, `src/app/portal/[clientSlug]/approvals/page.tsx`, `src/app/portal/[clientSlug]/notifications/page.tsx`, `src/app/portal/[clientSlug]/eeat-questionnaire/page.tsx`, `tests/portal-v2-pages-gating.test.ts`.
- **Story 18.2 (complete):** broad Phase 3 regression coverage exists for APIs and deterministic engines, with current local quality gates passing.
  - Evidence: `tests/content-*.test.ts`, `tests/eeat-*.test.ts`, `tests/links-*.test.ts`, `tests/implementation-*.test.ts`, `tests/feature-flags.test.ts`; plus `bun run test`, `bun run lint`, and `bun run build` passing locally (lint warnings only, no errors).

### Phase 3 Exit Criteria
- [x] Full content lifecycle operational
- [x] Client collaboration loop active (approval + messaging)
- [x] Technical execution is approval-gated + rollback-safe

### Remaining Blockers for Phase 3 Sign-off

- (No remaining blockers from the Phase 3 closure list.)

---

## Phase 4 — Scale & Polish Checklist

- [ ] Reporting Suite v2 (North Star + branded/non-branded segmentation)
- [ ] Sales Pipeline module
- [ ] White-label customization controls
- [ ] Data architecture evolution checkpoint (BigQuery/warehouse strategy)

### Phase 4 Exit Criteria
- [ ] End-to-end commercial demo ready
- [ ] White-label + sales workflows operational
- [ ] Scale/migration plan approved

---

## Quick Status Snapshot

### Evidence-driven deltas (Phase 1 closure refresh)

- **RBAC consistency fixes landed on core Phase 1 API surfaces:** policy checks now run through `can(...)` + client access context in `POST /api/invitations` (`src/app/api/invitations/route.ts`), `GET/POST /api/keywords` (`src/app/api/keywords/route.ts`), `PATCH/DELETE /api/keywords/[id]` (`src/app/api/keywords/[id]/route.ts`), and `PATCH /api/settings/password` (`src/app/api/settings/password/route.ts`).
- **Onboarding draft + invitation gate are active:** draft profile is auto-created at client creation (`POST /api/clients`, `src/app/api/clients/route.ts` via `ensureOnboardingDraftProfile`), onboarding supports `DRAFT`/`COMPLETED` states (`src/lib/onboarding/types.ts`), and invite creation blocks with `409 ONBOARDING_INCOMPLETE` when onboarding is not completed (`src/app/api/invitations/route.ts`).
- **North Star now appears in client workspace:** `NorthStarRibbon` is mounted in portal layout (`src/app/portal/[clientSlug]/layout.tsx`) and remains available across admin client pages.
- **Keyword opportunities + technical baseline are operational (API + UI):** keyword scoring endpoint at `GET /api/keywords/opportunities` (`src/app/api/keywords/opportunities/route.ts`) with admin UI at `/admin/clients/[id]/opportunities` (`src/app/admin/clients/[id]/opportunities/page.tsx`, `src/components/admin/keyword-opportunities-panel.tsx`); technical baseline API at `GET/POST /api/technical/audits` (`src/app/api/technical/audits/route.ts`) with UI at `/admin/clients/[id]/technical-audits` (`src/app/admin/clients/[id]/technical-audits/page.tsx`, `src/components/admin/technical-audits-panel.tsx`) backed by `technical_audit_runs` and `technical_issues` (`src/lib/db/schema.ts`).
- **Client-safe AI context default is enforced by role:** `GET /api/ai/context/[clientId]` resolves scope (`agency-full` vs `client-safe`) and strips opportunity/risk item arrays for client-equivalent roles (`src/app/api/ai/context/[clientId]/route.ts`).

### Execution Notes (recent UX/navigation slices)

- **Consolidated client navigation with persistent section nav:** `/admin/clients` now redirects to `/admin/dashboard` (single entry point). Client workspace (`/admin/clients/[id]`) has a persistent section navigation bar across all client subpages (dashboard, keywords, reports, strategy, etc.).
  - Evidence: `src/app/admin/clients/page.tsx` (redirect), `src/app/admin/clients/[id]/page.tsx` (section nav integration), `src/components/admin/client-sections-nav.tsx`, and client subpages under `src/app/admin/clients/[id]/**/page.tsx`.
- **Client workspace default dashboard with six operational cards:** Client detail page (`/admin/clients/[id]`) now defaults to a dashboard tab showing six operational cards: Approvals, Communications, Critical Issues, Tasks, Traffic Data, and North Star.
  - Evidence: `src/app/admin/clients/[id]/page.tsx`.
- **Settings split (Profile/Admin) with profile self-service API and avatar propagation:** Settings page (`/admin/settings`) now has two tabs: Profile (display name, profile photo URL, password change) and Admin (portal settings, API credentials link, danger zone export). New API route `GET/PATCH /api/settings/profile` supports self-service profile updates. Admin header avatar now uses profile image when present.
  - Evidence: `src/app/admin/settings/page.tsx`, `src/app/api/settings/profile/route.ts`, `src/app/api/settings/password/route.ts`, `src/components/admin/admin-header.tsx`, `src/components/admin/profile-settings-form.tsx`, `src/lib/auth/config.ts`, `src/lib/auth/index.ts`.
