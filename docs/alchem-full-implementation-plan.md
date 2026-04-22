# Alchem Platform — Full Implementation Plan

**Project:** AI-Powered SEO & Marketing Intelligence Platform  
**Repository:** `bit-brand`  
**Date:** 2026-04-14  
**Status:** Planning Baseline (v1)

---

## 1) Executive Summary

This plan converts the Alchem architecture vision into a build-ready, phased implementation roadmap for the existing Next.js + Drizzle codebase.

It is designed for a solo/small team execution model and emphasizes:

- Reuse of current portal/admin foundation
- Incremental, production-safe delivery
- Human-in-the-loop AI workflows
- Strong permission boundaries between agency and client surfaces
- Ownership of differentiated features (AI visibility, prompt research, content intelligence)

---

## 2) Current State Assessment (What Already Exists)

The current repo already provides a strong foundation:

- Multi-tenant client model (`clients`, `clientUsers`, `users`)
- Admin + client portal split with role checks
- Core modules present (keywords, reports, strategy, sync controls)
- Integrations scaffolding (GA4, GSC, Moz, DataForSEO, Rankscale)
- Invitation flow, exports (CSV/PDF), messaging/approvals/kanban scaffolding
- Sync jobs and basic operational observability

### Main Gaps vs Alchem Target

1. Expanded role model + module-level permissions
2. Onboarding + North Star strategic model
3. Shared AI context layer + module lenses
4. In-house prompt research and AI visibility triangulation
5. EEAT scoring framework and technical crawler
6. CMS execution agent with approval-gated implementation + rollback
7. Sales pipeline module
8. Unified approvals center and richer client portal experience

---

## 3) Target Architecture (Implementation View)

### 3.1 Platform Layers

1. **Presentation Layer**
   - Agency app (`/admin/*`)
   - Client app (`/portal/[clientSlug]/*`)
2. **Domain Layer**
   - Strategy, keywords, prompt research, AI visibility, content, technical SEO, links, reporting, approvals
3. **AI Orchestration Layer**
   - Shared context service
   - Lens router (module-specific prompts/instructions)
   - Approval-gated action generation
4. **Integration Layer**
   - External APIs (GA4, GSC, DataForSEO, Moz)
   - Internal engines (prompt testing, crawler, EEAT scoring)
   - CMS adapters (WordPress first, Shopify second)
5. **Data Layer**
   - SQLite now, migration-ready to Postgres + warehouse strategy

### 3.2 Core Design Constraints

- No AI-generated action is auto-published without explicit human approval.
- Internal notes/workflows are hard-separated from client-visible surfaces.
- Every module links to North Star goals and lever contribution.
- Shared context powers all module assistants for cross-module continuity.

---

## 4) Delivery Strategy

### 4.1 Guiding Principles

- Vertical slices over massive rewrites
- Backward-compatible migrations
- Feature flags for high-risk modules
- Build differentiators in-house, buy commodity data/services

### 4.2 Phases

- **Phase 1: Foundation**
- **Phase 2: Differentiation**
- **Phase 3: Content + Links + Client Collaboration**
- **Phase 4: Scale + Polish + Commercial Readiness**

---

## 5) Workstreams (Cross-Phase)

1. **Identity & Access (RBAC)**
2. **Client Onboarding & North Star Modeling**
3. **AI Core (Context + Lenses + MCP endpoint integration)**
4. **Keyword & Prompt Intelligence**
5. **Content Ecosystem + EEAT**
6. **Technical SEO + Implementation Agent**
7. **Link Monitoring + Prospecting**
8. **Reporting & Analytics**
9. **Approvals, Messaging, Kanban**
10. **Sales Pipeline**
11. **Ops/Infra/Security/Observability**

---

## 6) Detailed Phase Plan

## Phase 1 — Foundation (6–8 weeks)

### Objectives

- Establish strategic data model and role system
- Deliver agency dashboard upgrades
- Stand up AI shared context baseline
- Harden keyword + technical audit fundamentals

### Deliverables

#### A) Expanded RBAC

- Add roles:
  - Agency Owner/Admin
  - Account Manager
  - Strategist/Specialist
  - Client Admin
  - Client Viewer
- Add permission matrix by module + action (`view`, `edit`, `approve`, `publish`, `execute`)
- Enforce in API + route guards + server actions

#### B) Onboarding + North Star

- New onboarding flow in agency app:
  - Business fundamentals
  - North Star definition
  - Conversion architecture
  - Lever ranking
  - Competitor landscape
  - Current-state tech/SEO baseline
- Store in structured schema and expose in client workspace header

#### C) Agency Dashboard v2

- Client cards with:
  - North Star summary
  - Health score
  - Critical/warning counts
  - Pending approvals count
- Priority alerts bar
- Filters by health, manager, industry
- Recent activity feed

#### D) AI Shared Context v1

- `ClientContextService` producing canonical context payload per client
- Data includes onboarding profile + latest KPIs + active workstreams
- Read-only module assistant endpoint returning strategy suggestions (no execution yet)

#### E) Keyword + Technical Baseline

- Improve keyword opportunity scoring and clustering quality
- Build initial crawler job for:
  - Title/meta checks
  - Canonical checks
  - Basic schema detection
  - Broken links

### Exit Criteria

- RBAC enforced end-to-end
- Onboarding complete for new clients
- Dashboard reflects health + approvals reliably
- Shared context endpoint available to all modules

---

## Phase 2 — Differentiation (8–10 weeks)

### Objectives

- Ship core differentiator: AI visibility + prompt research
- Expand AI intelligence and cross-module recommendations
- Introduce EEAT scoring

### Deliverables

#### A) AI Visibility Engine (In-house)

- Prompt set manager per client
- Scheduled multi-engine prompt tests
- Capture appearance, position, citations, response context
- Aggregate visibility scoring and trend lines

#### B) Prompt Research Module

- Citation analysis for target prompts
- Pattern extraction:
  - content type
  - freshness
  - authority markers
  - schema usage
- Prompt-to-content gap mapping

#### C) AI Lens Router v2

- Module-specific lens configs:
  - Goal planning
  - Keywords
  - Prompt research
  - Technical
  - Reporting
- Shared context injection + module instructions

#### D) EEAT Scoring v1

- Scoring categories:
  - author/bio completeness
  - content freshness
  - schema coverage
  - business trust signals
  - review/social mention signals (where available)
- Priority-ranked recommendations list

#### E) Kanban Integration Improvements

- Link cards to module entities
- Status-aware notifications and due-date alerts

### Exit Criteria

- AI visibility tracking running in production mode for pilot clients
- Prompt research insights feeding content strategy recommendations
- EEAT baseline scores visible and actionable

---

## Phase 3 — Content, Links, Collaboration (8–10 weeks)

### Objectives

- Build full content lifecycle and link-building engine
- Launch client collaboration loops (approvals, messaging)
- Add approval-gated technical implementation workflows

### Deliverables

#### A) Content Ecosystem

- Content audit with recommendations (refresh/consolidate/delete/retarget)
- Calendar with workflow states and ownership
- Approval workflow with revision notes + version history
- AI brief generation from keyword + prompt clusters

#### B) EEAT Questionnaire Workflow

- Dynamic questionnaires by content type
- Client response capture in portal
- AI draft generation that incorporates expert responses

#### C) Link Building + Backlink Profile

- Backlink monitor dashboard (inventory, alerts, quality)
- Prospecting model with relevance + authority scoring
- Outreach drafts and pipeline states

#### D) Technical SEO Implementation Agent (WordPress first)

- Propose-fix queue with before/after previews
- Approval gating per item/batch
- Execution logging + rollback snapshots

#### E) Client Portal v2

- Unified dashboard with:
  - KPIs + North Star progress
  - approval queue
  - notification center
  - read-only kanban
- Deliverable drill-down + contextual messaging + PDF downloads

### Exit Criteria

- Content lifecycle fully operational
- Client collaboration loop active for approvals and messaging
- Technical agent executes only approved changes with rollback safety

---

## Phase 4 — Scale & Polish (6–8 weeks)

### Objectives

- Commercial readiness for agency growth
- Reporting sophistication and white-label controls
- Sales pipeline and operational maturity

### Deliverables

#### A) Reporting Suite v2

- Branded vs non-branded segmentation
- North Star lever contribution charts
- Bird’s-eye delivery summary across modules
- Locked published reports + live data comparison

#### B) Sales Pipeline Module

- Prospect sourcing + profile enrichment
- Opportunity analysis + mini-audit generator
- Stage tracking + conversion analytics
- AI outreach drafts (approval-gated)

#### C) White-label + Team Config

- Theme/branding settings per agency
- Permission templates by team role

#### D) Data Architecture Evolution Plan

- BigQuery hybrid model maturity review
- Postgres migration design (if triggered)
- Cost/performance decision checkpoint

### Exit Criteria

- End-to-end platform demoable to agency clients
- White-label and sales workflows operational
- Scale and migration plan approved

---

## 7) Data Model Plan (Schema Evolution)

## 7.1 New/Extended Tables

### Identity & Access

- `roles` (if normalized) or enum expansion in `users.role`
- `permissions`
- `role_permissions`
- `user_client_assignments` (for manager/specialist assignment)

### Strategy & Onboarding

- `client_onboarding_profiles`
- `north_star_goals`
- `conversion_definitions`
- `strategic_levers`
- `competitor_profiles`

### AI Context & Lenses

- `ai_context_snapshots`
- `ai_lens_configs`
- `ai_interactions`
- `ai_recommendations`

### Prompt Research & Visibility

- `prompt_sets`
- `prompt_tests`
- `prompt_citations`
- `prompt_competitor_visibility`
- `ai_visibility_scores` (replace/extend current aggregate table)

### Content Ecosystem

- `content_assets`
- `content_briefs`
- `content_versions`
- `content_calendar_items`
- `content_approvals`
- `eeat_questionnaires`
- `eeat_responses`
- `eeat_scores`

### Technical SEO

- `technical_audit_runs`
- `technical_issues`
- `implementation_proposals`
- `implementation_executions`
- `implementation_rollbacks`

### Links

- `backlink_inventory`
- `backlink_alerts`
- `link_prospects`
- `link_outreach_sequences`
- `link_pipeline_events`

### Collaboration

- `approval_requests` (unified queue abstraction)
- `messages`
- `message_threads`
- `thread_participants`
- `kanban_columns`
- `kanban_cards`

### Sales

- `prospects`
- `prospect_audits`
- `sales_pipeline_events`
- `outreach_messages`

## 7.2 Migration Approach

- Prefer additive migrations first
- Backfill scripts for derived fields (health score, counts, rollups)
- Dual-read strategy where replacing existing tables
- Cutover only after parity checks

---

## 8) API & Service Layer Plan

## 8.1 Service Domains

- `rbac-service`
- `onboarding-service`
- `northstar-service`
- `client-context-service`
- `prompt-intelligence-service`
- `eeat-service`
- `technical-audit-service`
- `implementation-agent-service`
- `link-intelligence-service`
- `reporting-service`
- `approvals-service`
- `sales-service`

## 8.2 Endpoint Families (Representative)

- `/api/onboarding/*`
- `/api/north-star/*`
- `/api/ai/context/*`
- `/api/ai/lens/*`
- `/api/prompts/*`
- `/api/visibility/*`
- `/api/content/*`
- `/api/technical/*`
- `/api/implementation-queue/*`
- `/api/links/*`
- `/api/approvals/*`
- `/api/messages/*`
- `/api/sales/*`

All endpoints must enforce role + assignment + client visibility rules.

---

## 9) Frontend Plan (Route & UX Expansion)

## 9.1 Agency Portal

- Dashboard v2 (health cards, alerts, activity)
- Onboarding wizard
- Moduleized client workspace nav with badge counts
- Unified approvals center
- Sales pipeline views

## 9.2 Client Portal

- Single-page dashboard hub
- Approval queue + action drawer
- Notification center
- Deliverable drill-down pages
- Contextual message threads
- EEAT questionnaire submission flow

## 9.3 Shared UX Standards

- Every module shows North Star context ribbon
- AI recommendations clearly labeled as suggestions
- Approval states are explicit and auditable
- Client-visible vs internal-only UI partition hard-enforced

---

## 10) AI System Implementation Plan

## 10.1 Shared Brain

Implement a `ClientContextBuilder` that composes:

- onboarding profile
- goal/progress state
- latest KPI snapshots
- active module outputs
- known opportunities/risks

## 10.2 Specialized Lenses

Define lens configs per module:

- system instructions
- scoring frameworks
- output schemas (Zod)
- allowed actions and approval requirements

## 10.3 MCP Integration

- Expose module-aware assistant endpoint
- Route by active module/lens
- Log interactions and recommendation outcomes
- Never auto-execute external mutations

## 10.4 Safety & Governance

- Approval gates for any “execution” suggestion
- Structured audit logs (who approved, when, what changed)
- Rollback supported for all automated technical actions

---

## 11) Build vs Buy Execution Decisions (Actionable)

- **Build:** AI visibility, prompt research, technical crawler, EEAT logic, CMS adapters, approvals orchestration
- **Buy:** DataForSEO, Moz, email delivery infra, auth provider option (future)
- **Hybrid:** reporting warehouse evolution (BigQuery now, own stack later)

---

## 12) Engineering Standards for This Plan

- Use Bun scripts only for package/runtime workflows
- Keep Next.js 16 route param handling (`params` as Promise)
- Preserve edge-safe auth split (`auth/config.ts` vs `auth/index.ts`)
- Keep browser-only PDF logic in client components
- Strict schema validation for all AI outputs and external inputs
- Feature flags around high-risk modules (crawler, auto-implementation)

---

## 13) Testing & Validation Plan

## 13.1 Test Coverage Targets

- Unit: service logic, scoring engines, permission checks
- Integration: API routes, DB writes, sync/adapters, approval transitions
- E2E: onboarding, approval workflow, client dashboard visibility, publish/report flows

## 13.2 Critical Quality Gates

- RBAC regression suite (must pass pre-merge)
- Data integrity checks for score aggregates and report snapshots
- AI output schema validation + fallback handling
- Rollback simulation tests for implementation agent

---

## 14) Security, Privacy & Compliance

- Encrypt all sensitive credentials (already required by `ENCRYPTION_KEY`)
- Store only necessary client data for AI context
- Separate internal/client visibility at query + response serialization level
- Audit trail for approvals, publishing, and automated changes
- Rate-limit sensitive mutation endpoints

---

## 15) Risks & Mitigations

1. **Scope explosion**
   - Mitigation: phase gates, strict definition of done per phase
2. **AI quality inconsistency**
   - Mitigation: schema-constrained outputs + human approvals
3. **RBAC leaks across agency/client boundaries**
   - Mitigation: central permission service + automated regression suite
4. **Crawler/implementation instability**
   - Mitigation: staged rollout + queue + rollback
5. **Integration fragility (external APIs)**
   - Mitigation: robust retry/error states + health dashboards

---

## 16) Team Plan (Solo/Small Team)

Recommended sequencing per sprint:

- **Sprint 1–2:** RBAC + onboarding schema + North Star UI baseline
- **Sprint 3–4:** dashboard v2 + context service + keyword/technical baseline
- **Sprint 5–7:** AI visibility + prompt research core + EEAT scoring v1
- **Sprint 8–10:** content lifecycle + approvals hardening + client portal v2
- **Sprint 11–12:** technical implementation agent + link prospecting
- **Sprint 13–14:** reporting v2 + sales pipeline + white-label controls

---

## 17) Definition of Done (Program-Level)

The Alchem implementation is considered complete when:

1. All core modules are live with role-correct access
2. Shared AI context + module lenses power recommendations across modules
3. AI visibility and prompt research are first-class and operational
4. Technical fix automation is approval-gated and rollback-safe
5. Client portal supports approvals, messaging, deliverable drill-downs, and report access
6. Reporting supports North Star progress and branded exports
7. Sales pipeline is available to agency users only

---

## 18) Immediate Next Steps

1. Approve this implementation plan as baseline.
2. Create Epic backlog from Sections 6–10.
3. Start Phase 1 with this exact vertical slice:
   - RBAC expansion
   - Onboarding + North Star data model
   - Dashboard v2 health/alerts
   - Shared context service v1

---

## Appendix A — Suggested Initial Epic List

- EPIC-01: RBAC expansion and enforcement
- EPIC-02: Onboarding + North Star domain model
- EPIC-03: Agency dashboard v2
- EPIC-04: Shared AI context and lens routing foundation
- EPIC-05: Prompt intelligence + AI visibility core
- EPIC-06: Content ecosystem and approvals workflow
- EPIC-07: Technical crawler + implementation queue + rollback
- EPIC-08: Backlink monitoring + link prospecting
- EPIC-09: Reporting v2 + branded exports + North Star insights
- EPIC-10: Sales pipeline and outreach drafting

---

## Appendix B — Suggested Feature Flags

- `ff_rbac_v2`
- `ff_onboarding_v2`
- `ff_ai_context_v1`
- `ff_prompt_visibility_v1`
- `ff_eeat_scoring_v1`
- `ff_technical_agent_v1`
- `ff_sales_pipeline_v1`
