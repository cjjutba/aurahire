---
stepsCompleted: [1, 2, 3, 4, 5, 6]
status: 'complete'
overallReadiness: 'READY'
date: '2026-06-10'
project_name: 'aurahire'
assessmentType: 'brownfield-replatform'
filesIncluded:
  - docs/main/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
filesReferenced:
  - _bmad-output/project-context.md
  - docs/index.md
  - docs/main/design-system.md
---

# Implementation Readiness Assessment Report

**Date:** 2026-06-10
**Project:** aurahire (serverless re-platform)

## Document Inventory

| Document | Path | Format | Duplicates | Use |
|---|---|---|---|---|
| PRD | `docs/main/prd.md` | whole | none | ✅ baseline / preservation contract |
| Architecture | `_bmad-output/planning-artifacts/architecture.md` | whole | none | ✅ migration target decisions |
| Epics & Stories | `_bmad-output/planning-artifacts/epics.md` | whole | none | ✅ 6 epics / 20 stories |
| UX Design | `docs/main/{design-system,ui-patterns,page-inventory}.md` | whole | none | ℹ️ N/A — UI unchanged by re-platform |

**Supporting context:** `_bmad-output/project-context.md` (Migration State), `docs/index.md` (brownfield as-built docs).

**Issues found:** none. No duplicate (whole + sharded) conflicts; all required documents present.

**Assessment note:** This is a **brownfield re-platform** — the PRD is the *preservation* baseline (existing features must keep working), while Architecture + Epics define the migration work. Readiness is assessed against that framing.

## PRD Analysis

The PRD (`docs/main/prd.md`, v2.1.0, locked) describes the **product to be preserved**. Its requirements are the preservation contract; the migration must not regress them. The migration's own functional/non-functional requirements (FR1–FR12, NFR1–NFR8) live in `epics.md` and are validated in the next step.

### Functional Requirements (product features to preserve)

- PRD-FR1 Authentication: email/password register, login (rate-limited), forgot/reset, email verification, session, RBAC (candidate/recruiter/admin).
- PRD-FR2 Onboarding: candidate 6-step resume-first wizard; recruiter 3-step; incomplete → middleware redirect.
- PRD-FR3 Job Management: create (rich text, skills, level, education, salary, deadline), bias check at edit + publish, publish/draft/archive/edit/duplicate, applications-per-job sorted by match, job analytics.
- PRD-FR4 Resume submission & parsing: PDF/DOCX upload (size-limited), AI parse → structured JSON, storage, multiple versions + default.
- PRD-FR5 Profile Scoring: computed at onboarding + recompute on change; weighted components; breakdown + evidence; improvement suggestions.
- PRD-FR6 Match Scoring: at apply + on-demand; weighted components; breakdown + evidence for both roles; match bands.
- PRD-FR7 Bias Detection: scan description on publish; flags (term/category/suggestion); override with reason (audited); admin aggregate.
- PRD-FR8 Application Workflow: apply → match score → Applied; recruiter stage transitions; notes; audit.
- PRD-FR9 Interview Management: schedule (date/format/link), email candidate, list view, feedback/rating.
- PRD-FR10 Offer Management: generate, preview, send, in-portal accept/decline, status lifecycle.
- PRD-FR11 Admin Portal (8): command center, user management, job moderation, application oversight, AI scoring config, audit log, system analytics, bias & fairness monitor.
- PRD-FR12 Notifications & Email: Resend transactional, in-app, preferences.
- PRD-FR13 Audit Logging: append-only; captures actions/AI/config/overrides; admin-only.

**Total product FRs: 13** (all currently implemented in the codebase + post-PRD additions: multi-tenancy, in-app notifications, feedback, interview venues).

### Non-Functional Requirements

- PRD-NFR1 Performance: page <3s cold / <1.5s warm; API <800ms (<5s with AI); parse <30s; scoring <15s; bias <10s; 50+ concurrent.
- PRD-NFR2 Security: HTTPS; hashed passwords; HTTP-only session cookies; **3-layer RBAC (middleware → server-action → RLS)**; Zod at every boundary; auth rate-limit 5/60s; secrets server-only; file upload validation.
- PRD-NFR3 Privacy: GDPR export/delete; PII redaction before scoring; audit retention/anonymization.
- PRD-NFR4 Scalability: stateless app servers; **Postgres pooling via pgbouncer**; async-friendly AI.
- PRD-NFR5 Accessibility: WCAG 2.1 AA; keyboard nav; focus rings; ARIA; AA contrast.
- PRD-NFR6 Reliability: daily backups; graceful AI degradation; error boundaries.

**Total NFRs: 6.**

### Additional Requirements / Constraints
- OpenAI structured-output JSON schema for all scores (no free-text); prompt versioning in DB.
- Free-tier operation; gpt-4o-mini; cache parsed resume JSON; rate-limit user-triggered scoring (1/60s).
- The locked **thesis demo path** (6 steps) must run end-to-end without faking.

### PRD Completeness Assessment
The PRD is complete and locked for the original product, but **predates the as-built system and this migration** (v2.1.0, May 2026). Two relevant divergences to carry into coverage validation:
1. **Security model shift (PRD-NFR2 ↔ Architecture):** PRD specifies Supabase-hashed passwords + 3-layer RBAC including **RLS**. The migration moves auth to **Clerk** and **drops RLS** (guards remain authoritative). This is a deliberate, documented deviation — not a gap — but must be acknowledged so the demo/defense narrative is updated.
2. **Realtime/queues:** PRD explicitly scoped *out* websockets and in-memory queues; the as-built added both; the migration **removes them** — re-aligning with the PRD's original stance.
PRD-FR1's email-verify/password-reset move from the app to Clerk-hosted flows (behavior preserved, ownership changes).

## Epic Coverage Validation

This is a re-platform, so coverage is validated on **two axes**: (A) every migration FR maps to stories; (B) every PRD product feature is preserved — either re-platformed by an epic or verified by the demo gate.

### Coverage Matrix A — Migration FRs → Stories (from `epics.md`)

| FR | Requirement | Epic / Story | Status |
|---|---|---|---|
| FR1 | API as Vercel Function | Epic 5 / 5.1 | ✓ |
| FR2 | Neon persistence + migrations | Epic 1 / 1.1 | ✓ |
| FR3 | Clerk JWT auth | Epic 2 / 2.2, 2.4 | ✓ |
| FR4 | Clerk identity mirror + role-in-JWT | Epic 2 / 2.1, 2.2, 2.3, 2.5 | ✓ |
| FR5 | Upstash cache + throttle | Epic 1 / 1.3 | ✓ |
| FR6 | Vercel Blob storage (redacted) | Epic 3 / 3.1, 3.2 | ✓ |
| FR7 | Inline scoring | Epic 4 / 4.1 | ✓ |
| FR8 | Bounded batch rescore | Epic 4 / 4.2 | ✓ |
| FR9 | Vercel Cron | Epic 5 / 5.2 | ✓ |
| FR10 | Polling replaces socket.io | Epic 4 / 4.3, 4.4 | ✓ |
| FR11 | Domain cutover | Epic 6 / 6.1 | ✓ |
| FR12 | Feature preservation / demo path | Epic 6 / 6.2 | ✓ |

### Coverage Matrix B — PRD product features → Preservation path

| PRD-FR | Feature | Migration impact | Preserved by | Status |
|---|---|---|---|---|
| FR1 | Authentication | **Re-platformed** (Supabase→Clerk) | Epic 2 (2.2–2.5) + 6.2 | ✓ |
| FR2 | Onboarding | substrate only (auth/storage) | Epics 2, 3 + 6.2 | ✓ |
| FR3 | Job management + bias-on-publish | logic unchanged | 6.2 | ✓ |
| FR4 | Resume upload + parse | **storage re-platformed** (Blob) + DOCX path | Epic 3 (3.1–3.3) + 6.2 | ✓ |
| FR5 | Profile Scoring | **async→inline** | Epic 4 (4.1) + 6.2 | ✓ |
| FR6 | Match Scoring | **async→inline** | Epic 4 (4.1) + 6.2 | ✓ |
| FR7 | Bias Detection | logic unchanged | 6.2 | ✓ |
| FR8 | Application Workflow | scoring inline; logic unchanged | Epic 4 + 6.2 | ✓ |
| FR9 | Interview Management | cron trigger change (start/autocomplete) | Epic 5 (5.2) + 6.2 | ✓ |
| FR10 | Offer Management | cron trigger change (expiry) | Epic 5 (5.2) + 6.2 | ✓ |
| FR11 | Admin Portal (8) | logic unchanged; batch-rescore inline | Epic 4 (4.2) + 6.2 | ✓ |
| FR12 | Notifications & Email | **realtime push→polling**; email via Resend (unchanged) | Epic 4 (4.4) + 6.2 | ✓ |
| FR13 | Audit Logging | unchanged (must stay byte-for-byte) | NFR2 guarantee + 6.2 | ✓ |

### Missing Requirements
**None.** Every migration FR has stories; every PRD product feature has a preservation path (re-platform epic and/or the Epic 6.2 demo-verification gate). No uncovered requirement.

### Coverage Statistics
- Migration FRs: **12 / 12 covered (100%)**
- PRD product features (preservation): **13 / 13 traced (100%)**
- FRs in epics not in PRD (expected for a migration — infra requirements): FR1 (compute), FR5 (cache), FR9 (cron), FR11 (domain) — these are net-new migration concerns, correctly scoped.

## UX Alignment Assessment

### UX Document Status
**Found** (in project_knowledge, not planning_artifacts): `docs/main/design-system.md` (tokens), `docs/main/ui-patterns.md` (components), `docs/main/page-inventory.md` (routes). This is a user-facing app with a mature, documented design system.

### Alignment Issues
**None.** The re-platform introduces **no UX changes** — the design system, component library, and page inventory are preserved unchanged (explicit in the Architecture and `epics.md` UX section). The single UX-touching surface is authentication: Story 2.4 replaces the custom auth forms with Clerk components **themed to the design tokens via Clerk's appearance API**, so brand consistency is maintained.

- UX ↔ PRD: aligned — no new user journeys; existing flows preserved.
- UX ↔ Architecture: aligned — architecture preserves the frontend (Next.js + Tailwind v4 tokens) and accounts for the only new surface (Clerk auth) with brand theming.

### Warnings
None. UX is fully preserved; accessibility (WCAG 2.1 AA, PRD-NFR5) carries over unchanged. **Verification note:** the Clerk-themed auth screens should be visually QA'd against the brand during Epic 2 (a dev-server check the human runs), since auth UI is the one pixel-level change.

## Epic Quality Review

Reviewed all 6 epics / 20 stories against the create-epics-and-stories standards (user value, epic independence, no forward dependencies, story sizing, AC quality, table-creation timing).

### 🔴 Critical Violations
**None.**

### 🟠 Major Issues
**None.**
- *Considered and cleared:* Epics 1 ("Managed Data & Cache Cutover") and 5 ("Serverless Compute") read like "technical milestones" under a **greenfield** rubric. Cleared because this is a **brownfield re-platform** — the rubric's brownfield guidance (§5B) explicitly expects *migration/compatibility stories*, and each epic delivers a verifiable, independently-shippable outcome framed as preserve-the-user-experience ("the existing app runs green against Neon", "API serves from a Vercel deployment"). The framing is intentional, not a defect.
- *Considered and cleared:* Epic 5 has a hard prerequisite on Epic 4 (you cannot deploy the API as a Vercel Function while socket.io/BullMQ still exist). This is a **backward** dependency (Epic 5 builds on an earlier epic) — permitted by the rules. It is an ordering constraint, not a forward dependency. Documented in the dependency flow.

### 🟡 Minor Concerns (non-blocking; recommendations)
1. **Implicit provisioning prerequisites.** Each epic's first story embeds a "human has provisioned service X + configured env" in its **Given** (Neon project for 1.1, Clerk app for 2.x, Blob token for 3.1, Vercel project for 5.1). Recommend the human completes each service's provisioning **before** starting that epic's worktree, so dev agents don't block. Suggest a one-line "Epic prerequisite (human)" note per epic in the sprint plan.
2. **Service-account setup is a human task, not a story.** Consistent with the project's hard rules (Claude doesn't provision infra/deploys) — correctly left to the human; just make it explicit in `[SP]`.
3. **AC failure-path depth.** ACs cover the key error cases (invalid/expired token → 401, bad webhook signature → 401, unauthorized cron → 403, Redis-down → fail-open). A few could add rollback/outage scenarios (migration rollback, Blob outage) — nice-to-have, not blocking.

### Best-Practices Compliance Checklist (applies to all 6 epics)
- [x] Epic delivers value (preserve-the-UX outcome; brownfield migration pattern)
- [x] Epic can function independently (builds only on earlier epics; none requires a future epic)
- [x] Stories appropriately sized for a single dev agent
- [x] No forward dependencies within any epic
- [x] Migrations created only when needed (0017 in Epic 1, 0018 in Epic 2; existing 0000–0016 applied in 1.1)
- [x] Clear Given/When/Then acceptance criteria
- [x] Traceability to FRs maintained (coverage matrices A & B)

### Remediation Guidance
No blocking remediation required. Before `[SP]`: add a per-epic "human prerequisite (provision service + env)" line. Optional: enrich a few ACs with outage/rollback scenarios during `[CS]` story prep.

## Summary and Recommendations

### Overall Readiness Status
**READY** — proceed to Sprint Planning.

The planning artifacts (PRD baseline, Architecture, Epics/Stories) are coherent, fully traceable, and aligned. Migration FR coverage is 12/12; PRD product-feature preservation is 13/13; UX is preserved; epic/story structure passes the best-practices review with no critical or major violations.

### Critical Issues Requiring Immediate Action
**None.** No critical or major issues were found.

### Documented (accepted) deviations — carry into the thesis narrative, not defects
1. **Security model:** PRD-NFR2 specifies Supabase-hashed passwords + 3-layer RBAC *including RLS*. The migration moves auth to **Clerk** and **drops RLS** (guards remain authoritative; access is backend-only). Deliberate and documented — update the defense narrative/PRD note.
2. **Realtime/queues:** the as-built socket.io + BullMQ are **removed** (→ polling + inline scoring), re-aligning with the PRD's original "no websockets / no in-memory queues" stance.

### Implementation-time decisions carried from Architecture (non-blocking)
- DOCX→PDF approach (managed converter vs render-text vs docx-wasm).
- Verify the Vercel plan supports minute-resolution crons (interview start/autocomplete).
- Verify the NestJS bundle fits the 250 MB Vercel Function limit.

### Recommended Next Steps
1. In `[SP]` Sprint Planning, add a **per-epic "human prerequisite"** line (provision Neon / Clerk / Upstash / Vercel Blob / Vercel project + env) — service provisioning is a human task per the project's hard rules.
2. Sequence worktrees on the dependency flow **Epic 1 → 2 → 3 → 4 → 5 → 6** (Epics 2 & 3 may run in parallel after Epic 1; Epic 4 must precede Epic 5).
3. Resolve the three implementation-time decisions above during their owning stories (3.3, 5.2, 5.1).
4. Update the PRD/thesis security narrative to reflect Clerk + no-RLS before defense.
5. Proceed to `[SP]` Sprint Planning, then the story cycle (`[CS]` → `[DS]` → `[CR]`).

### Final Note
This assessment found **0 critical, 0 major, and 3 minor** issues across 5 categories (document inventory, FR coverage, UX alignment, epic quality, dependencies), plus 2 documented deviations and 3 implementation-time decisions carried from the architecture. All minors are non-blocking with clear remediation. The artifacts are **READY** for implementation; you may proceed as-is.

**Assessor:** Claude (BMad `[IR]` Implementation Readiness) · **Date:** 2026-06-10
