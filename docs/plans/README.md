# AuraHire Implementation Plans

This directory holds **per-slice implementation plans** for the AuraHire sprint, written using the `superpowers:writing-plans` skill and intended to be executed using `superpowers:subagent-driven-development` (this session) or `superpowers:executing-plans` (separate session).

Each slice from `docs/main/sprint-plan.md` gets a dedicated plan in this folder. Plans are created **just-in-time** — typically the next 1-2 slices ahead of execution — so each plan reflects the most recent learnings from prior slices.

---

## Plan File Convention

```
docs/plans/YYYY-MM-DD-slice-<n.n>-<short-name>.md
```

Example: `2026-05-02-slice-1.1-monorepo-init.md`

The date is the planned execution date (not the writing date — writing happens earlier).

---

## Plan Index

### Day 1 — May 2, 2026 (Monorepo, Backend Foundation, Auth E2E)

| Slice | Title | Plan File | Status |
|---|---|---|---|
| 1.1 | Monorepo Init | [2026-05-02-slice-1.1-monorepo-init.md](./2026-05-02-slice-1.1-monorepo-init.md) | ✅ Complete |
| 1.2 | Database Schema + Drizzle Foundation | [2026-05-02-slice-1.2-database-schema.md](./2026-05-02-slice-1.2-database-schema.md) | ✅ Complete |
| 1.3 | Shared Schemas + Auth Guards | [2026-05-02-slice-1.3-shared-schemas-auth-guards.md](./2026-05-02-slice-1.3-shared-schemas-auth-guards.md) | ✅ Complete |
| 1.4 | Profiles Module + Auth Wiring | [2026-05-02-slice-1.4-profiles-module-auth-wiring.md](./2026-05-02-slice-1.4-profiles-module-auth-wiring.md) | ✅ Complete |
| 1.5 | Auth UI: Login, Register, Forgot, Reset, Verify | [2026-05-02-slice-1.5-auth-ui.md](./2026-05-02-slice-1.5-auth-ui.md) | 📝 Plan ready |
| 1.6 | Portal Shells | _to be written after 1.5_ | ⏳ Not started |
| 1.7 | Recruiter Onboarding Wizard | _to be written after 1.6_ | ⏳ Not started |
| 1.8 | Candidate Onboarding (Manual, no AI) | _to be written after 1.7_ | ⏳ Not started |

### Day 2 — May 3, 2026 (Jobs, Applications, AI Layer)

| Slice | Title | Plan File | Status |
|---|---|---|---|
| 2.1 | Jobs Module Backend | _to be written_ | ⏳ Not started |
| 2.2 | Jobs Frontend (Recruiter + Public Browse) | _to be written_ | ⏳ Not started |
| 2.3 | AI Foundation | _to be written_ | ⏳ Not started |
| 2.4 | Resume Upload + Parse | _to be written_ | ⏳ Not started |
| 2.5 | Profile Scoring + Score UI Components | _to be written_ | ⏳ Not started |
| 2.6 | Match Scoring on Apply | _to be written_ | ⏳ Not started |
| 2.7 | Bias Check + Job Publishing | _to be written_ | ⏳ Not started |
| 2.8 | Day 2 Polish | _to be written_ | ⏳ Not started |

### Day 3 — May 4, 2026 (Admin, Background Jobs, Cron, Caching)

| Slice | Title | Plan File | Status |
|---|---|---|---|
| 3.1 | Admin Foundation: Stats + User Mgmt + Job Moderation | _to be written_ | ⏳ Not started |
| 3.2 | Admin Application Oversight | _to be written_ | ⏳ Not started |
| 3.3 | AI Scoring Configuration + Preview Impact | _to be written_ | ⏳ Not started |
| 3.4 | Audit Log + System Analytics | _to be written_ | ⏳ Not started |
| 3.5 | Bias & Fairness Monitor | _to be written_ | ⏳ Not started |
| 3.6 | Background Jobs (BullMQ) | _to be written_ | ⏳ Not started |
| 3.7 | Cron Tasks + Cache Wiring | _to be written_ | ⏳ Not started |
| 3.8 | Interview, Offer, Final Polish | _to be written_ | ⏳ Not started |

### Day 4 — May 5, 2026 (Polish, Smoke Test, Deployment)

| Slice | Title | Plan File | Status |
|---|---|---|---|
| 4.1 | Frontend Deployment (Vercel) | _to be written_ | ⏳ Not started |
| 4.2 | Backend Deployment (Railway) | _to be written_ | ⏳ Not started |
| 4.3 | End-to-End Demo Path Verification | _to be written_ | ⏳ Not started |
| 4.4 | Thesis Smoke Test | _to be written_ | ⏳ Not started |
| 4.5 | Documentation Pass + Buffer | _to be written_ | ⏳ Not started |

**Status legend:**
- ⏳ Not started — plan not yet written
- 📝 Plan ready — written, awaiting execution
- 🔄 Executing — currently being worked on
- ✅ Complete — code shipped, slice DoD met
- ⚠️ Blocked — execution paused (see notes in plan file)

---

## Execution Model

Two viable approaches to execute these plans (the user chose **subagent-driven** for this sprint):

### A. Subagent-Driven (this session)

Plans are executed by dispatching a fresh subagent per task using `superpowers:subagent-driven-development`. The main session reviews between tasks. Best for fast iteration with frequent code review.

### B. Parallel Session (separate Claude Code session)

A separate Claude Code session opens in the same repo, reads the plan, and executes using `superpowers:executing-plans`. Best when the planning session needs to stay focused on writing future plans.

---

## Cross-Reference

The authoritative source for **what** each slice does and **why** is `docs/main/sprint-plan.md`. The plans in this folder are the **how** — the bite-sized executable steps.

Other relevant references for plan execution:
- `CLAUDE.md` — hard rules (no dev servers, no Docker commands, etc.)
- `AGENTS.md` — Next.js 16 caveat and module patterns
- `docs/main/architecture.md` — system architecture
- `docs/main/tech-stack.md` — every dependency
- `docs/main/project-structure.md` — folder layout
- `docs/main/best-practices.md` — engineering standards
- `docs/main/database-schema.md` — DB schema
- `docs/main/ai-design.md` — AI engines (thesis-critical)
- `docs/main/technical-specifications.md` — REST API spec
- `docs/main/design-system.md`, `ui-patterns.md`, `page-inventory.md` — design canon

---

## Pre-Sprint State (verified May 1, 2026)

- ✅ Supabase project `aurahire` exists and is `ACTIVE_HEALTHY` (ID: `fzjvalmouygmmnrgpgtg`, region `ap-southeast-2`, Postgres 17)
- ✅ Docker Desktop running (per user confirmation)
- ✅ All sprint docs locked in `docs/main/`
- ✅ Root files locked (`CLAUDE.md`, `AGENTS.md`, `DESIGN.md`, `docker-compose.dev.yml`)
- ⏳ Awaiting human pre-flight before Slice 1.1 execution: install pnpm 9, populate `.env` files, start `docker compose -f docker-compose.dev.yml up -d`
