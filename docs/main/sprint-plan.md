# AuraHire Sprint Plan

**Version:** 2.0.0 (Split Architecture, 3+1 days)
**Last Updated:** May 1, 2026
**Status:** Locked
**Sprint Window:** May 2 / 3 / 4, 2026 (3 active days) + May 5 polish + smoke buffer

This document is the hour-by-hour execution plan for the split-architecture sprint. Frontend + backend monorepo with NestJS, BullMQ, cron, Redis cache, and Mailpit. Goal: a thesis-defensible vertical slice with seamless UX.

---

## Operating Principles

1. **Vertical slices, not horizontal layers.** Each slice ends with a working end-to-end path: backend endpoint → frontend page → demo-able.
2. **The backend leads each slice.** Build the NestJS module + controller + DTOs first; regenerate the OpenAPI client; wire frontend last.
3. **Type safety end-to-end.** Zod schema in `packages/shared` → NestJS DTO → OpenAPI spec → generated TS client → React Hook Form. Same schema shape at every layer.
4. **The human runs all servers.** Claude does not start `pnpm dev`, doesn't run migrations, doesn't deploy.
5. **Manual QA after every slice.** Type-check + the human pokes at the demo before next slice begins.
6. **Defer ruthlessly when slipping.** Slip targets defined in this doc.

---

## Pre-Sprint (Day 0 - May 1, evening, already done)

- [x] Sprint scope locked
- [x] Architecture confirmed (NestJS + Next.js + Turborepo + Digital Ocean Droplet + Mailpit + Redis)
- [x] All 13 docs in `docs/main/` written + 3 root files (`CLAUDE.md`, `AGENTS.md`, `DESIGN.md`) + `docker-compose.dev.yml`
- [x] Service accounts created (Supabase, Resend, OpenAI)
- [ ] **Human action:** install pnpm 9 globally; create Digital Ocean account + provision the production Droplet; ensure Docker Desktop is running locally
- [ ] **Human action:** start local services - `docker compose -f docker-compose.dev.yml up -d` (boots Mailpit + Redis)
- [ ] **Human action:** populate `apps/web/.env.local` and `apps/api/.env`

---

## Day 1 (May 2) - Monorepo, Backend Foundation, Auth End-to-End

**Total: 12 hours, 8 slices.**
**Goal at end of Day 1:** Monorepo runs `pnpm dev` for both apps. Backend has health check, Swagger UI, auth guards, profiles module. Frontend has portal shells, auth forms wired to backend, registration → verification → login → onboarding redirect works end-to-end.

### Slice 1.1 - Monorepo Init (90 min)

- [ ] Create root `package.json` with workspace config + scripts (`dev`, `build`, `lint`, `type-check`, `format`)
- [ ] Create `pnpm-workspace.yaml`
- [ ] Create `turbo.json`
- [ ] Create `tsconfig.base.json`
- [ ] Move existing Next.js code to `apps/web/`
  - Move: `app/`, `public/`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `tsconfig.json`
  - Adjust `apps/web/tsconfig.json` to extend `../../tsconfig.base.json`
  - Adjust `apps/web/package.json` to remove dev deps that move to root
- [ ] Create `apps/api/` with NestJS scaffold (`@nestjs/cli` via `pnpm dlx nest new`)
  - Adopt Fastify adapter in `main.ts`
  - Add Swagger setup
- [ ] Create `packages/shared/` with `package.json`, `tsconfig.json`, `src/index.ts` placeholder
- [ ] Create `packages/db/` with `package.json`, `tsconfig.json`, `src/index.ts` placeholder
- [ ] Verify: human runs `pnpm install` then `pnpm dev` → both apps start (web on 3000, api on 3333)
- [ ] Human first commit: "chore: monorepo init"

**DoD:** `pnpm dev` from root runs both servers. Frontend shows existing Next.js placeholder. Backend `/api/health` returns 200; `/api/docs` shows empty Swagger UI.

---

### Slice 1.2 - Database Schema + Drizzle Foundation (90 min)

- [ ] Add Drizzle schema in `packages/db/src/schema.ts` - all 15 tables per `database-schema.md`
- [ ] Add Drizzle relations in `packages/db/src/relations.ts`
- [ ] Add enum exports in `packages/db/src/enums.ts`
- [ ] Configure `packages/db/drizzle.config.ts` to read DATABASE_URL from env
- [ ] Write RLS policies in `packages/db/src/rls/all-policies.sql`
- [ ] Configure `apps/api` to consume `@aurahire/db` (DI provider for Drizzle client)
- [ ] **Human action:** run `pnpm --filter @aurahire/db drizzle-kit push` against Supabase dev project
- [ ] **Human action:** run RLS policies SQL via Supabase Dashboard SQL editor
- [ ] **Human action:** verify in Supabase dashboard - all tables exist with RLS enabled
- [ ] **Human action:** insert seed `scoring_config` row, manually create admin user
- [ ] Commit: "feat: db schema + rls + drizzle integration"

**DoD:** Database has all tables with RLS, default scoring_config row, admin user.

---

### Slice 1.3 - Shared Schemas + Auth Guards (90 min)

- [ ] Add Zod schemas to `packages/shared/src/schemas/auth.ts`, `shared.ts`, `onboarding.ts`
- [ ] Add enums to `packages/shared/src/enums/`
- [ ] Add constants to `packages/shared/src/constants/`
- [ ] Add `AuthUser` type to `packages/shared/src/types/`
- [ ] Backend: implement `SupabaseAuthGuard` in `apps/api/src/common/guards/`
  - Fetch JWKs from Supabase, cache in-memory
  - Verify JWT via `jose`
  - Attach decoded user to request
- [ ] Backend: implement `RolesGuard` + `@Roles()` decorator + `@CurrentUser()` decorator + `@Public()` decorator
- [ ] Backend: configure global `ZodValidationPipe` (from nestjs-zod)
- [ ] Backend: configure global exception filter (normalizes errors to standard envelope)
- [ ] Backend: configure Pino logger with request ID middleware
- [ ] Backend: configure CORS to allow `NEXT_PUBLIC_APP_URL`
- [ ] Backend: configure Helmet
- [ ] Commit: "feat: shared schemas + auth guards + global infra"

**DoD:** Hitting protected endpoint without JWT → 401. With wrong role → 403. With valid JWT + correct role → controller runs.

---

### Slice 1.4 - Profiles Module (Backend) + Auth Wiring (Frontend) (120 min)

- [ ] Backend: create `ProfilesModule` with controller + service + repository
  - `POST /auth/register-candidate`
  - `POST /auth/register-recruiter`
  - `GET /profiles/me`
  - All with Swagger decorators + Zod DTOs
- [ ] Backend: implement audit module + `AuditService`
- [ ] Frontend: install Supabase SDK + `@supabase/ssr`
- [ ] Frontend: implement `lib/auth/server.ts`, `client.ts`, `session.ts`
- [ ] Frontend: implement `middleware.ts` for auth + RBAC redirects
- [ ] Frontend: configure orval to generate API client from `apps/api`'s OpenAPI spec
- [ ] Frontend: regenerate API client (orval) → check `packages/shared/api-client/` populated
- [ ] Frontend: wire TanStack Query provider
- [ ] Commit: "feat: profiles module + auth wiring"

**DoD:** Backend has Swagger docs for auth endpoints. Frontend has middleware + Supabase client.

---

### Slice 1.5 - Auth UI: Login, Register, Forgot, Reset, Verify (120 min)

- [ ] Frontend: `apps/web/app/(auth)/layout.tsx` - centered card layout
- [ ] Frontend: pages - `login`, `register`, `register/candidate`, `register/recruiter`, `forgot-password`, `reset-password`, `verify-email`, `verify-email/sent`
- [ ] Frontend: forms in `apps/web/components/auth/` - RHF + Zod from `packages/shared`
- [ ] Frontend: register flow:
  - call `supabase.auth.signUp(...)`
  - then call backend `POST /auth/register-candidate` (or recruiter) with new JWT
  - redirect to `/verify-email/sent`
- [ ] Frontend: login flow → `supabase.auth.signInWithPassword(...)` → `GET /profiles/me` → redirect based on `profileCompleted` + role
- [ ] Backend: implement email module - Mailpit (dev) + Resend (prod) transport switching
- [ ] Backend: react-email templates: `verify-email.tsx`, `password-reset.tsx`
- [ ] Backend: override Supabase auth email templates to use ours via Resend (prod) / Mailpit (dev)
- [ ] **Human action:** test full flow - register → email arrives in Mailpit (localhost:8025) → click verify → redirected to onboarding
- [ ] Commit: "feat: auth flows e2e"

**DoD:** Full register → verify → login → onboarding-redirect works against real Supabase + Mailpit.

---

### Slice 1.6 - Portal Shells (90 min)

- [ ] Frontend: `components/layout/portal-sidebar.tsx` - role-aware nav
- [ ] Frontend: `components/layout/portal-topbar.tsx`
- [ ] Frontend: `components/layout/portal-footer.tsx`
- [ ] Frontend: `components/layout/marketing-nav.tsx`
- [ ] Frontend: `components/layout/marketing-footer.tsx`
- [ ] Frontend: layouts for each portal (`(candidate)`, `(recruiter)`, `(admin)`)
- [ ] Frontend: stub dashboard pages with placeholder content
- [ ] Frontend: marketing landing placeholder using design tokens
- [ ] Apply `@theme` tokens in `apps/web/app/globals.css` per `design-system.md`
- [ ] Configure `next/font/google` for Inter + JetBrains Mono
- [ ] Commit: "feat: portal shells + marketing layout"

**DoD:** All three portals render with shared chrome, role-gated by middleware.

---

### Slice 1.7 - Recruiter Onboarding Wizard (60 min)

- [ ] Frontend: `components/onboarding/wizard-shell.tsx`, `wizard-progress.tsx`
- [ ] Backend: create `RecruiterProfilesModule` with patch endpoints per step
- [ ] Frontend: 3-step recruiter wizard pages - about / company / focus
- [ ] On final step: `recruiter_profiles.profile_completed=true` → redirect `/recruiter`
- [ ] Commit: "feat: recruiter onboarding"

**DoD:** Recruiter onboarding works end-to-end. Recruiter lands on `/recruiter` dashboard.

---

### Slice 1.8 - Candidate Onboarding (Manual, no AI yet) (60 min)

- [ ] Backend: create `CandidateProfilesModule` with patch endpoints per step (skipping resume parse)
- [ ] Frontend: 6-step candidate wizard - placeholder for step 1 ("Skip" link), forms for steps 2-6
- [ ] Stub Profile Score reveal page with "Score will be computed when you upload a resume"
- [ ] On final: `candidate_profiles.profile_completed=true` → redirect `/candidate`
- [ ] Commit: "feat: candidate onboarding (manual)"

**DoD:** Candidate can complete onboarding without AI; lands on `/candidate` dashboard.

---

### Day 1 End-of-Day Checklist

- [ ] Monorepo runs `pnpm dev`
- [ ] Backend Swagger UI shows auth endpoints
- [ ] Auth flows work end-to-end (register, verify via Mailpit, login, forgot, reset)
- [ ] Both onboarding wizards work
- [ ] All three portal shells render
- [ ] Code committed and pushed

**Slip strategy if behind 1-2 hours:** Drop slice 1.7 polish; barebones recruiter onboarding; defer marketing layout to Day 2 morning.

---

## Day 2 (May 3) - Jobs, Applications, AI Layer

**Total: 12 hours, 8 slices.**
**Goal at end of Day 2:** Jobs CRUD with bias check, resume upload + parse, profile + match scoring, application flow, scoring breakdown UI all working.

### Slice 2.1 - Jobs Module Backend (60 min)

- [ ] Backend: create `JobsModule` with controller + service + repository + DTOs
- [ ] Endpoints: `POST /jobs`, `PATCH /jobs/:id`, `POST /jobs/:id/publish`, `POST /jobs/:id/archive`, `GET /jobs`, `GET /jobs/:id`, `GET /jobs/for-candidate`, `GET /jobs/:id/for-candidate`
- [ ] Caching on public listings (60s TTL via `@nestjs/cache-manager`)
- [ ] Audit log on every mutation
- [ ] Regenerate OpenAPI client
- [ ] Commit: "feat: jobs module backend"

---

### Slice 2.2 - Jobs Frontend (Recruiter + Public Browse) (90 min)

- [ ] Frontend: `apps/web/app/(recruiter)/recruiter/jobs/new/page.tsx` with form + Tiptap editor
- [ ] Frontend: list/edit/detail/archive pages
- [ ] Frontend: `apps/web/app/(public)/jobs/page.tsx` + `[id]/page.tsx` (no match score yet)
- [ ] Frontend: `apps/web/app/(candidate)/candidate/jobs/page.tsx` + `[id]/page.tsx` (no match score yet)
- [ ] Empty states + loading skeletons
- [ ] Commit: "feat: jobs UI (no scoring yet)"

**DoD:** Recruiter can create draft, edit, publish (without bias check yet), archive. Candidates can browse + view jobs.

---

### Slice 2.3 - AI Foundation (60 min)

- [ ] Backend: install `openai`, `pdf-parse`, `mammoth`
- [ ] Backend: implement `AiModule`:
  - `OpenAIService` (singleton client with timeout)
  - `RedactPiiService`
  - Stub `ParseResumeService`, `ScoreProfileService`, `ScoreMatchService`, `DetectBiasService`
- [ ] Backend: prompts in `apps/api/src/ai/prompts/`
- [ ] Backend: schemas in `packages/shared/src/schemas/score.ts`, `bias.ts`
- [ ] Backend: smoke test - manual call to OpenAI returns valid JSON
- [ ] Commit: "feat: ai foundation"

---

### Slice 2.4 - Resume Upload + Parse (90 min)

- [ ] Backend: `ResumesModule` with multipart upload via `@nestjs/platform-fastify` multipart plugin
- [ ] Backend: `POST /resumes/upload` - validate, store in Supabase Storage, parse synchronously, insert row
- [ ] Backend: `GET /resumes/mine`, `POST /resumes/:id/set-default`, `GET /resumes/:id/download` (signed URL)
- [ ] Frontend: `components/onboarding/candidate/upload-resume-step.tsx`
- [ ] Frontend: candidate onboarding step 1 - replace "Skip" with real upload + AI Shimmer
- [ ] Frontend: parse success → prefill subsequent steps with `badge-ai-suggested` markers
- [ ] Frontend: `apps/web/app/(candidate)/candidate/resume/page.tsx` resume manager
- [ ] Commit: "feat: resume upload + parse"

**DoD:** Upload a real PDF → AI parses → fields prefill in subsequent onboarding steps.

---

### Slice 2.5 - Profile Scoring + Score UI Components (90 min)

- [ ] Backend: `ScoringModule` with `POST /scoring/profile/compute`
- [ ] Backend: implement profile scoring with PII redaction
- [ ] Frontend: `components/score/score-ring.tsx`
- [ ] Frontend: `components/score/score-breakdown-bar.tsx`
- [ ] Frontend: `components/score/evidence-callout.tsx`
- [ ] Frontend: `components/score/match-band-chip.tsx`
- [ ] Frontend: onboarding step 7 - Profile Score reveal with full breakdown
- [ ] Frontend: `/candidate/profile` page showing current Profile Score
- [ ] Commit: "feat: profile scoring + score UI"

**DoD:** Complete onboarding → see Profile Score Ring with real breakdown + evidence + suggestions.

---

### Slice 2.6 - Match Scoring on Apply (90 min)

- [ ] Backend: `ApplicationsModule` with controller + service + repository
- [ ] Backend: `POST /applications` - creates application + computes match score inline
- [ ] Backend: `GET /applications/mine`, `GET /applications/:id`, `PATCH /applications/:id/status`, `POST /applications/:id/withdraw`
- [ ] Backend: send `application-received` email via Mailpit/Resend
- [ ] Frontend: `apps/web/app/(candidate)/candidate/jobs/[id]/apply/page.tsx`
- [ ] Frontend: `apps/web/app/(candidate)/candidate/applications/...` pages with full score breakdown
- [ ] Frontend: `apps/web/app/(recruiter)/recruiter/jobs/[id]/applications` list with match score chips
- [ ] Frontend: `apps/web/app/(recruiter)/recruiter/applications/[id]` full review with score + evidence
- [ ] Update `/candidate/jobs/[id]` to show match score preview
- [ ] Commit: "feat: match scoring + application views"

**DoD:** Apply → AI Shimmer → application created with real match score. Recruiter sees full breakdown.

---

### Slice 2.7 - Bias Check + Job Publishing (75 min)

- [ ] Backend: `BiasModule` with `POST /bias/check`
- [ ] Backend: update `POST /jobs/:id/publish` - re-runs bias check, requires overrides if flagged
- [ ] Frontend: `components/bias/bias-flag-chip.tsx` + popover
- [ ] Frontend: update job description editor with debounced bias check
- [ ] Frontend: publish flow - modal showing flags + override form on 422
- [ ] Commit: "feat: bias detection on jobs"

**DoD:** Type "rockstar" in description → flag appears → publish blocked until edit or override.

---

### Slice 2.8 - Day 2 Polish (45 min)

- [ ] Frontend: empty states + loading states for critical pages
- [ ] Mobile responsiveness pass on auth + onboarding
- [ ] Commit: "polish: day 2 wrap"

---

### Day 2 End-of-Day Checklist

- [ ] Recruiter creates a job with bias detection
- [ ] Candidate completes resume-first onboarding
- [ ] Candidate applies; sees Match Score + breakdown
- [ ] Recruiter sees applications sorted by match score
- [ ] All AI surfaces show evidence

**Slip strategy if behind 2-3 hours:** Drop bias detection (slice 2.7) - replace with hard-coded flagged-term list (no AI bias call). Bias monitor in admin will show those entries instead.

---

## Day 3 (May 4) - Admin Portal, Background Jobs, Cron, Caching, Demo Path

**Total: 12 hours, 8 slices.**
**Goal at end of Day 3:** Full admin portal, BullMQ batch re-score, cron for cleanup, Redis caching wired, full demo path verified.

### Slice 3.1 - Admin Foundation: Stats + User Mgmt + Job Moderation (90 min)

- [ ] Backend: `AdminModule` with sub-controllers
- [ ] Endpoints: `GET /admin/stats/overview`, `GET /admin/users`, `POST /admin/users/:id/suspend`, `POST /admin/users/:id/reactivate`, `PATCH /admin/users/:id/role`, `DELETE /admin/users/:id`, `POST /admin/users/:id/force-password-reset`
- [ ] Endpoints: `GET /admin/jobs`, `POST /admin/jobs/:id/archive`
- [ ] Frontend: `apps/web/app/(admin)/admin/page.tsx` Command Center
- [ ] Frontend: `/admin/users`, `/admin/jobs` pages with tables + actions
- [ ] Commit: "feat: admin foundation"

---

### Slice 3.2 - Admin Application Oversight (60 min)

- [ ] Backend: `GET /admin/applications`, `GET /admin/applications/:id` with full breakdown including raw AI output
- [ ] Frontend: `/admin/applications` table with score range filter
- [ ] Frontend: drill-into-score sheet with raw output drawer
- [ ] Commit: "feat: admin application oversight"

---

### Slice 3.3 - AI Scoring Configuration + Preview Impact (90 min)

- [ ] Backend: `GET /admin/scoring-config`, `PATCH /admin/scoring-config`, `POST /admin/scoring-config/preview-impact`
- [ ] Frontend: `/admin/ai-config` page with sliders + Preview Impact button
- [ ] Audit log on every save
- [ ] Commit: "feat: admin ai config + preview"

**DoD:** Admin can change weights, see preview delta, save with audit entry.

---

### Slice 3.4 - Audit Log + System Analytics (75 min)

- [ ] Backend: `GET /admin/audit` (filters + pagination), `GET /admin/audit/export`
- [ ] Backend: `GET /admin/analytics` with cached aggregations
- [ ] Frontend: `/admin/audit` table
- [ ] Frontend: `/admin/analytics` page with Recharts
- [ ] Commit: "feat: audit log + analytics"

---

### Slice 3.5 - Bias & Fairness Monitor (60 min)

- [ ] Backend: `GET /admin/bias-monitor` with cached aggregations
- [ ] Frontend: `/admin/bias-monitor` page with KPI tiles, breakdown by category, top flagged terms, override decisions
- [ ] Commit: "feat: bias monitor"

---

### Slice 3.6 - Background Jobs (BullMQ) (90 min)

- [ ] Backend: `QueueModule` with BullMQ + Redis connection
- [ ] Backend: `RescoreBatchProcessor` - re-scores last N applications with current weights
- [ ] Backend: `POST /admin/scoring/rescore-batch` enqueues job and returns jobId
- [ ] Backend: `GET /admin/jobs/:jobId/status` for polling progress
- [ ] Frontend: `/admin/ai-config` "Apply to existing" button → enqueues + shows progress
- [ ] Commit: "feat: bullmq batch rescore"

**DoD:** Admin clicks "Apply to existing" → background worker processes → progress visible.

---

### Slice 3.7 - Cron Tasks + Cache Wiring (60 min)

- [ ] Backend: `CronModule`:
  - `expireOffersHourly` - sets offers status='expired' past expires_at
  - `archivePastDeadlineJobs` daily
  - `cleanupUnverifiedAccounts` weekly
- [ ] Backend: extend `@nestjs/cache-manager` to admin analytics endpoints
- [ ] Backend: extend `@nestjs/throttler` to auth + scoring endpoints
- [ ] Backend: write `.env.example` for backend including REDIS_URL
- [ ] Commit: "feat: cron + cache + throttle"

---

### Slice 3.8 - Interview, Offer, Final Polish (75 min)

- [ ] Backend: `InterviewsModule`: `POST /applications/:id/interviews`, `PATCH /interviews/:id/feedback`, list endpoints
- [ ] Backend: `OffersModule`: `POST /applications/:id/offers`, `POST /offers/:id/accept`, `POST /offers/:id/decline`
- [ ] Frontend: schedule interview modal in `/recruiter/applications/[id]`
- [ ] Frontend: send offer flow at `/recruiter/offers/new`
- [ ] Frontend: candidate accept/decline buttons in offer detail
- [ ] All transactional emails wired (interview-scheduled, offer-sent)
- [ ] Final mobile responsiveness pass
- [ ] Commit: "feat: interviews + offers + final polish"

---

### Day 3 End-of-Day Checklist

- [ ] Full admin portal with all 8 features functional
- [ ] BullMQ batch re-score works
- [ ] Cron tasks scheduled
- [ ] Redis caching active
- [ ] Interview + offer flows work
- [ ] Code committed + pushed

---

## Day 4 (May 5) - Polish, Smoke Test, Demo Path Verification, Deployment

**Total: 8-12 hours.**
**Goal:** verify full demo path works end-to-end against deployed environments; run smoke test; capture thesis appendix items.

### Slice 4.1 - Frontend Deployment (60 min)

- [ ] Connect repo to Vercel; configure env vars (NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, NEXT_PUBLIC_API_URL pointing at the DO Droplet API URL - `https://api.<your-domain>`)
- [ ] Push to main → auto-deploy → preview URL
- [ ] Verify auth + portal loads work in preview

### Slice 4.2 - Backend Deployment (Digital Ocean Droplet, 90 min)

- [ ] Provision Droplet (Ubuntu 22.04 LTS, 2 vCPU / 2GB), SSH key auth, UFW allowing only 22/80/443
- [ ] DNS: A-record `api.<your-domain>` → Droplet IPv4
- [ ] Install Node 20 + pnpm 9 + Docker Engine + Caddy + PM2; create `deploy` user
- [ ] `git clone` repo to `/home/deploy/aurahire`; create `deploy/.env` with prod values (DATABASE_URL Supabase pooler, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, RESEND_API_KEY, REDIS_PASSWORD, REDIS_URL=`redis://:${REDIS_PASSWORD}@127.0.0.1:6379`, SMTP_HOST=127.0.0.1 SMTP_PORT=1025, NODE_ENV=production)
- [ ] `docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d` → Redis + Mailpit running on 127.0.0.1
- [ ] `pnpm install --frozen-lockfile && pnpm --filter @aurahire/api build`
- [ ] `pm2 start apps/api/dist/main.js --name aurahire-api --time && pm2 save && pm2 startup`
- [ ] Configure `/etc/caddy/Caddyfile` for `api.<your-domain>` → reverse_proxy 127.0.0.1:3333; `systemctl reload caddy`
- [ ] Verify `https://api.<your-domain>/api/health` and `/api/docs` reachable; TLS green
- [ ] Update Vercel `NEXT_PUBLIC_API_URL` to `https://api.<your-domain>` and redeploy

### Slice 4.3 - End-to-End Demo Path Verification (90 min)

Run the full thesis demo path against deployed environment:

1. [ ] Register a new candidate (`maria@test.com`) → email arrives at real inbox via Resend
2. [ ] Click verify link → redirected to onboarding
3. [ ] Step 1: upload a real PDF resume → AI parses → fields prefilled
4. [ ] Steps 2-6: review prefilled, edit, set preferences
5. [ ] Step 7: Profile Score Ring renders with breakdown + evidence + suggestions
6. [ ] Browse jobs → see match score chips
7. [ ] Open a job → see Match Score Ring preview
8. [ ] Apply → AI Shimmer → application created with full match score
9. [ ] `/candidate/applications/[id]` → Score Breakdown with evidence callouts
10. [ ] Switch to recruiter account → sees new application in pipeline
11. [ ] Recruiter opens application detail → full match score + evidence
12. [ ] Recruiter schedules interview → email arrives
13. [ ] Recruiter sends offer → email arrives → candidate Accepts → status updates
14. [ ] Recruiter creates new job with "rockstar" → bias flag → override with reason → published
15. [ ] Switch to admin → Command Center → KPIs accurate
16. [ ] Admin → Application Oversight → drill into application from step 7 → see redacted_fields list
17. [ ] Admin → AI Config → adjust weight; Preview Impact; see delta; save
18. [ ] Admin → Bias Monitor → see "rockstar" in top flagged terms
19. [ ] Admin → Audit Log → see all events from steps 1-18

If any step fails: triage. Critical failures = fix immediately. Cosmetic = log for Phase 2.

### Slice 4.4 - Thesis Smoke Test (90 min)

- [ ] Curate 10 resumes (per `ai-design.md` § 9): software engineer 5y, recent grad, career changer, designer, data scientist, sales manager, 3 weak/sparse, 1 OCR-garbled, 1 with bias-trigger words
- [ ] Curate 5 jobs: senior eng, entry eng, data scientist, sales mgr, 1 with deliberate biased language
- [ ] Score each combination
- [ ] Verify: strong matches receive 70+; mismatches receive < 50; bias job catches all flags
- [ ] Capture screenshots for thesis appendix:
  - Score Ring + Breakdown + Evidence callouts
  - Bias flag in editor
  - Admin Bias Monitor with real flagged terms
  - Score audit drilldown showing redacted_fields
  - AI Config preview impact delta
  - Audit log filtered to AI events

### Slice 4.5 - Documentation Pass + Buffer (variable)

- [ ] Update README.md with project description + run instructions
- [ ] Verify all `docs/main/` files are current
- [ ] Capture OpenAI usage stats from dashboard for thesis cost analysis
- [ ] Buffer for any leftover bugs

---

## Slip Strategy

If at any checkpoint we're behind:

| If behind by... | Cut these in this order                                                |
| --------------- | ---------------------------------------------------------------------- |
| 1-2 hours       | Skip polish slices (mobile, empty states for non-critical pages)       |
| 3-4 hours       | Drop offer accept/decline UI (recruiter views status only)             |
| 5-6 hours       | Drop interview management (replace with "Schedule via email" stub)     |
| 7-8 hours       | Drop admin AI Config preview impact (keep weight save without preview) |
| Catastrophic    | Drop bias detection AI call (use hard-coded flagged-term list)         |

**Never cut:** auth, profile scoring, match scoring, score breakdowns, evidence callouts, audit log, basic admin, BullMQ infrastructure (even if not heavily used), Redis caching (even if minimal).

These ARE the thesis.

---

## Daily Cadence

### Morning (start of each day)

- 10 min: review yesterday's commits
- 10 min: re-read this sprint plan
- 10 min: re-read `ai-design.md` (Day 2) or relevant doc
- Start slice 1

### Throughout the day

- Type-check after every slice
- Commit after every slice with descriptive message
- Push to remote at lunch and end of day

### Evening (end of each day)

- 10 min: smoke test the day's slices
- 5 min: brief status note (what shipped, what's next)
- Sleep.

---

## Success Criteria

The sprint succeeds if:

1. ✅ The 19-step demo path completes without faking
2. ✅ Every AI surface displays evidence + breakdown
3. ✅ Every consequential action writes to audit log
4. ✅ Admin can tune weights and see preview impact
5. ✅ Bias detection catches deliberate seed terms
6. ✅ Mobile responsive at 375px (graceful)
7. ✅ TypeScript compiles in both apps
8. ✅ `pnpm dev` from root runs both servers
9. ✅ Deployed: Vercel (frontend) + Digital Ocean Droplet (backend, PM2 + Docker Compose Redis/Mailpit + Caddy)
10. ✅ All 13 docs in `docs/main/` + 3 root files current

---

## Iteration Guide

Update this plan if scope shifts during execution. Don't silently fall behind - communicate, recut, commit.
