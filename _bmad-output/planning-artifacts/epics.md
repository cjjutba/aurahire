---
stepsCompleted: [1, 2, 3, 4]
status: 'complete'
completedAt: '2026-06-10'
inputDocuments:
  - docs/main/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/project-context.md
  - docs/index.md
  - docs/main/design-system.md
workflowType: 'epics-and-stories'
epicsType: 'brownfield-replatform'
project_name: 'aurahire'
---

# aurahire - Epic Breakdown

## Overview

This document decomposes the **serverless re-platform** of AuraHire (off Digital Ocean → Vercel + Neon + Upstash + Clerk) into implementable epics and stories. Unlike a greenfield build, the product is feature-complete; the requirements below are the **migration's target-state functional requirements** plus the standing requirement that **every existing feature keeps working**. Source of truth: `_bmad-output/planning-artifacts/architecture.md` (the 7 epics + Epic→location map) and `docs/main/prd.md` (the preservation baseline / demo path).

## Requirements Inventory

### Functional Requirements

FR1: The NestJS API runs as a single Vercel Function (Fluid Compute) with no always-on host; the Nest app is bootstrapped once and cached across warm invocations.
FR2: All data persists in Neon Postgres (PG18, AWS Singapore); the existing Drizzle schema + migrations 0000–0016 apply via the **unpooled** connection; runtime uses the **pooled** endpoint with `prepare:false`.
FR3: Users authenticate via Clerk (sign-up, sign-in, email verification, password reset handled by Clerk); the backend validates Clerk JWTs via JWKS.
FR4: Each Clerk user maps to exactly one `profiles` row via `profiles.clerk_user_id`; new Clerk users are provisioned into `profiles` via a signature-verified webhook (with lazy-upsert fallback); role is stored on `profiles` and mirrored to the Clerk JWT claim for per-role routing.
FR5: Caching and rate-limiting are backed by Upstash Redis (`rediss://`); cache fails open on outage.
FR6: Resume files and the redacted recruiter-facing variant are stored in / served from Vercel Blob (private access); no Supabase Storage.
FR7: Profile and Match scoring compute **inline** within the triggering request (behind the AI shimmer) and resolve `score_status` within that request; no BullMQ queue/worker.
FR8: Admin batch rescore runs as a bounded, cursor-paginated admin operation (no persistent worker).
FR9: Scheduled jobs (archive-past-deadline, expire-offers, interview start/autocomplete, reminders, retention, cleanup) run via Vercel Cron invoking `CRON_SECRET`-guarded internal endpoints that call the existing cron logic.
FR10: Previously-live surfaces (notification unread-count, application/score status, recruiter pipeline) update via TanStack Query polling on standardized intervals; no socket.io.
FR11: The application is served from `aurahire.cjjutba.com` (web + API), with CORS, auth redirect URLs, email from-domain, and the OpenAPI server URL updated accordingly.
FR12: All pre-migration product capabilities (the PRD's 13 feature areas + multi-tenancy, notifications, feedback, interview venues) remain fully functional; the PRD thesis demo path passes end-to-end post-migration.

### NonFunctional Requirements

NFR1 (Statelessness): no self-managed or always-on infrastructure; all compute is serverless/managed.
NFR2 (Explainability/Fairness/Audit — thesis-critical): the PII-redaction → structured-output → audit-trail pipeline is preserved byte-for-byte; evidence excerpts + prompt-version tracking intact.
NFR3 (Performance): resume parse <30s, scoring <15s, bias <10s within the 300s function budget; pages cold <3s / warm <1.5s; polling intervals bounded.
NFR4 (Security): 5-layer-minus-RLS defense with guards authoritative; rate-limiting on Upstash; secrets backend-only; webhook signatures verified (Svix).
NFR5 (Privacy): PII redaction before scoring; redacted recruiter resume downloads; GDPR export/delete preserved.
NFR6 (Reliability): cache fails open; Neon managed backups; AI graceful degradation retained.
NFR7 (Cost/Portfolio): runs on free tiers (Neon, Upstash, Clerk 50K MAU, Vercel, Resend) with a documented upgrade path; ⚠️ minute-resolution interview crons require Vercel Pro.
NFR8 (Accessibility/UX): existing WCAG 2.1 AA conformance and design system are preserved unchanged.

### Additional Requirements

(Technical requirements from the Architecture document that shape implementation.)

- AR1 (Compute foundation): add `apps/api/api/index.ts` Vercel Function entry; export `bootstrap` from `main.ts`; add `vercel.json`/`vercel.ts` (function build + crons + domain/rewrites). **First implementation story.**
- AR2 (Schema migration `0017`): add `profiles.clerk_user_id text UNIQUE`; drop `auth_tokens`; drop the `auth.uid()`-based RLS policies. Keep `profiles.id uuid` PK (15+ FKs depend on it).
- AR3 (Backend auth): replace `verify-supabase-jwt.ts` → `verify-clerk-jwt.ts`; `SupabaseAuthGuard` → `ClerkAuthGuard`; add a `webhooks` module (Svix-verified Clerk webhook); shrink the `auth` module (Clerk owns signup/verify/reset).
- AR4 (Remove realtime + queue): delete `apps/api/src/realtime` + `src/queue`; drop every `EventsService.emit(...)` call-site; remove `packages/shared/realtime`; add a shared `POLL_INTERVALS` constant.
- AR5 (Storage + DOCX→PDF): rewrite `StorageService` for `@vercel/blob`; remove the LibreOffice `docx-to-pdf` path; **resolve DOCX→PDF approach (deferred):** managed converter vs render-text vs docx-wasm.
- AR6 (Frontend auth + polling): `@clerk/nextjs` replaces `@supabase/ssr`; rewrite `middleware.ts` (clerkMiddleware + role gate) + `lib/auth/*` + root layout providers; remove socket provider + realtime hooks; add polling.
- AR7 (Retire old deploy): delete `deploy/` + `apps/api/Dockerfile`; move deploys to Vercel Git integration; update CI to drop droplet assumptions.
- AR8 (Env): new var set across apps (Neon `DATABASE_URL`(+`_UNPOOLED`), Upstash `REDIS_URL`, `CLERK_*`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, domain); remove `SUPABASE_*`, `SMTP_*`, `HOST`, `REDIS_PASSWORD`.
- AR9 (Type chain): regenerate the orval client after the auth/realtime contract changes.
- AR10 (Pre-cutover checks): verify the Vercel plan supports minute crons; verify the Nest bundle fits the 250 MB function limit.

### UX Design Requirements

None — the re-platform does **not** change the UI. The existing design system (`docs/main/design-system.md`), component library, and page inventory are preserved unchanged. The only surface touched is authentication screens, where Clerk-hosted/Clerk-component flows may replace the custom auth forms (tracked under the Auth epic, with the existing brand styling applied to Clerk's appearance API).

### FR Coverage Map

FR1: Epic 5 — NestJS API runs as a Vercel Function
FR2: Epic 1 — Neon Postgres persistence + existing migrations
FR3: Epic 2 — Clerk authentication (JWKS validation)
FR4: Epic 2 — Clerk identity mirror (`clerk_user_id`) + role-in-JWT
FR5: Epic 1 — Upstash Redis cache + rate-limit store
FR6: Epic 3 — Vercel Blob storage (incl. redacted variant)
FR7: Epic 4 — inline Profile/Match scoring (no queue)
FR8: Epic 4 — bounded admin batch rescore
FR9: Epic 5 — Vercel Cron scheduling
FR10: Epic 4 — polling replaces socket.io
FR11: Epic 6 — domain cutover to aurahire.cjjutba.com
FR12: Epic 6 — full feature preservation / PRD demo path (verified per-epic)

## Epic List

### Epic 1: Managed Data & Cache Cutover (Neon + Upstash)
Move persistence and cache to managed serverless backends: the existing Drizzle schema runs on Neon Postgres (migrations 0000–0016 applied via the unpooled connection; runtime pooled with `prepare:false`), and caching + rate-limiting run on Upstash Redis. The `auth.uid()`-based RLS policies are dropped (migration 0017) since access is backend-only and the guards are authoritative. Verifiable: the existing application runs green against Neon + Upstash.
**FRs covered:** FR2, FR5

### Epic 2: Authentication Re-platform (Clerk)
Replace Supabase Auth with Clerk end-to-end. Users sign up / sign in / verify / reset via Clerk; the backend validates Clerk JWTs via JWKS (`ClerkAuthGuard`); each Clerk user maps to one `profiles` row via `clerk_user_id` (provisioned by a Svix-verified webhook + lazy fallback); role rides in the JWT for per-role routing. Supabase auth, `@supabase/ssr`, and `auth_tokens` are removed (migration 0018). Verifiable: full auth flow + RBAC works on Clerk.
**FRs covered:** FR3, FR4

### Epic 3: Storage Re-platform (Vercel Blob + DOCX→PDF)
Move resume file storage off Supabase Storage to Vercel Blob (private), preserving upload, candidate download, and the redacted recruiter-facing variant. Remove the LibreOffice DOCX→PDF path and resolve the conversion approach (managed converter vs render-text vs docx-wasm). Verifiable: upload/parse/download (redacted + full) works on Blob.
**FRs covered:** FR6

### Epic 4: Remove Always-On Dependencies (realtime → polling, queue → inline scoring)
Make the app serverless-compatible by removing every stateful background dependency. Delete socket.io (gateway, Redis adapter, ws-jwt, EventsService) and replace live surfaces with TanStack Query polling on standardized intervals; delete BullMQ and run Profile/Match scoring inline within the triggering request (behind the AI shimmer), with admin batch rescore as a bounded cursor loop. Verifiable: no websockets/queue remain; scoring + live surfaces still work.
**FRs covered:** FR7, FR8, FR10

### Epic 5: Serverless Compute & Scheduling (Vercel Function + Vercel Cron)
Flip compute to serverless: the NestJS API runs as a single Vercel Function (cached bootstrap) and scheduled jobs fire via Vercel Cron hitting `CRON_SECRET`-guarded internal endpoints that call the existing cron logic. Retire the `deploy/` folder, Dockerfile, PM2, and droplet. Verify the bundle fits the 250 MB limit and the plan supports minute crons. Verifiable: API serves from a Vercel deployment; crons fire on schedule.
**FRs covered:** FR1, FR9

### Epic 6: Domain Cutover & Production Verification
Bring the system live on `aurahire.cjjutba.com` (web + API) with all environment, CORS, auth-redirect, email-from, and OpenAPI-server URLs updated, then verify the full PRD thesis demo path passes end-to-end on the new stack with explainability/fairness/audit intact. Verifiable: the locked demo path runs without faking on production.
**FRs covered:** FR11, FR12

---

## Epic 1: Managed Data & Cache Cutover (Neon + Upstash)

Move persistence and cache to Neon Postgres and Upstash Redis with the existing schema and behavior intact; drop the now-unusable RLS layer.

### Story 1.1: Run the existing schema on Neon

As a developer,
I want the AuraHire database running on Neon Postgres with all existing migrations applied,
So that persistence no longer depends on the lost Supabase project.

**Acceptance Criteria:**

**Given** a Neon project (PG18) with pooled and unpooled connection strings configured as `DATABASE_URL` (pooled, `prepare:false`) and `DATABASE_URL_UNPOOLED`
**When** `drizzle-kit migrate` is run against the unpooled connection
**Then** migrations 0000–0016 apply cleanly and all 21 tables + indexes exist on Neon
**And** the API boots and every existing repository query succeeds against the pooled endpoint
**And** `drizzle.config.ts`, `reset-db`, and `seed-db` scripts use the unpooled connection.

### Story 1.2: Drop the auth.uid()-based RLS (migration 0017)

As a developer,
I want the Supabase-specific RLS policies removed on Neon,
So that the schema is valid on Neon (where `auth.uid()` does not exist) and the authoritative guards remain the enforcement layer.

**Acceptance Criteria:**

**Given** migration `0017_drop_rls.sql` that drops every `auth.uid()`-based policy and disables RLS on the affected tables
**When** it is applied to Neon
**Then** no RLS policies remain and `migrate` succeeds
**And** all backend reads/writes (service-role connection) continue to function unchanged.

### Story 1.3: Back cache + rate-limiting with Upstash Redis

As a developer,
I want caching and rate-limiting served by Upstash Redis,
So that no self-hosted Redis container is required.

**Acceptance Criteria:**

**Given** `REDIS_URL` pointed at an Upstash `rediss://` endpoint
**When** the API runs against Upstash
**Then** cache-manager, the tag-aware `CacheService`, and the `@nestjs/throttler` Redis store all operate correctly (hit/miss, tag bust, throttle enforcement)
**And** when Redis is unreachable the cache fails open (loader runs, API stays up).

## Epic 2: Authentication Re-platform (Clerk)

Replace Supabase Auth with Clerk end-to-end while preserving RBAC, multi-tenancy, and the profile model.

### Story 2.1: Clerk identity schema (migration 0018)

As a developer,
I want a `clerk_user_id` mapping on `profiles` and the obsolete `auth_tokens` table removed,
So that a Clerk user maps to exactly one profile without changing the uuid primary key.

**Acceptance Criteria:**

**Given** migration `0018_clerk_identity.sql`
**When** applied to Neon
**Then** `profiles.clerk_user_id text UNIQUE` exists and `auth_tokens` is dropped
**And** `profiles.id` remains the uuid PK and all existing foreign keys are intact.

### Story 2.2: Validate Clerk JWTs in the backend guard

As a developer,
I want the backend to authenticate requests via Clerk JWTs,
So that protected endpoints work without Supabase.

**Acceptance Criteria:**

**Given** `verify-clerk-jwt.ts` (jose `createRemoteJWKSet` against the Clerk JWKS, issuer/audience checked) and `ClerkAuthGuard` replacing `SupabaseAuthGuard`
**When** a request arrives with a valid Clerk `Authorization: Bearer` token
**Then** the guard resolves the profile by `clerk_user_id` and attaches `req.user`
**And** an invalid/expired token returns 401, and `RolesGuard`/`ActiveCompanyGuard` continue to enforce as before.

### Story 2.3: Provision profiles from Clerk webhook

As a new user,
I want my profile created automatically when I sign up with Clerk,
So that I can use the app immediately after registration.

**Acceptance Criteria:**

**Given** a `webhooks` module exposing `POST /api/v1/webhooks/clerk` (`@Public`, Svix signature-verified)
**When** Clerk sends a `user.created`/`user.updated` event
**Then** a matching `profiles` row is upserted (with role) keyed by `clerk_user_id`
**And** a request from a not-yet-mirrored user lazily upserts the profile in the guard
**And** an event with an invalid signature is rejected with 401.

### Story 2.4: Clerk on the frontend (sign-in + token + routing)

As a user,
I want to sign up, sign in, and sign out through Clerk on the AuraHire UI,
So that authentication works on the new stack with the AuraHire brand.

**Acceptance Criteria:**

**Given** `@clerk/nextjs` (`<ClerkProvider>`, `clerkMiddleware`) replacing `@supabase/ssr`, with Clerk appearance themed to the design tokens
**When** I authenticate and navigate the app
**Then** sign-up/in/out work, protected routes are gated by role from the JWT claim, and `@supabase/ssr` + `AuthTokenProvider` are removed
**And** client + server API calls carry the Clerk token (orval fetcher reads `getToken()`).

### Story 2.5: Retire Supabase auth + sync role to Clerk

As a developer,
I want the Supabase auth module shrunk and role kept in sync with Clerk,
So that no Supabase auth code remains and per-role routing stays correct.

**Acceptance Criteria:**

**Given** Clerk owns signup/verify/reset (the `auth` module's Supabase-admin proxying removed)
**When** an admin changes a user's role
**Then** `profiles.role` updates and is mirrored to Clerk `publicMetadata.role` (so it rides in the JWT)
**And** the orval client is regenerated against the updated contract and no `@supabase/*` server imports remain.

## Epic 3: Storage Re-platform (Vercel Blob + DOCX→PDF)

Move resume files off Supabase Storage to Vercel Blob, preserving redacted recruiter downloads, and remove the LibreOffice dependency.

### Story 3.1: Store and serve resumes from Vercel Blob

As a candidate,
I want to upload my resume and download it on the new stack,
So that resume storage no longer depends on Supabase.

**Acceptance Criteria:**

**Given** `StorageService` rewritten for `@vercel/blob` (private `put`/`del`) with `BLOB_READ_WRITE_TOKEN` configured
**When** I upload a resume and later download it
**Then** the file is stored in Vercel Blob and served back via a short-lived signed URL or API proxy
**And** parsing still runs on the stored file.

### Story 3.2: Preserve redacted recruiter downloads

As a recruiter,
I want resume downloads to remain PII-redacted,
So that the fairness guarantee survives the storage migration.

**Acceptance Criteria:**

**Given** resume download served from Vercel Blob
**When** a recruiter downloads an applicant's resume
**Then** they receive the redacted variant, while the candidate/admin receive the full file
**And** access is authorized by the existing guards.

### Story 3.3: Rework DOCX→PDF without LibreOffice

As a candidate,
I want my DOCX resume to still produce a usable canonical view,
So that the upload flow works on serverless without the `soffice` binary.

**Acceptance Criteria:**

**Given** the LibreOffice `docx-to-pdf.service.ts` path removed
**When** I upload a DOCX resume
**Then** it parses successfully and a canonical view is produced via the chosen approach (default: render the parsed text; optional: a managed converter)
**And** no code depends on a system `soffice`/LibreOffice binary.

## Epic 4: Remove Always-On Dependencies (realtime → polling, queue → inline scoring)

Eliminate every stateful background dependency so the API can run on stateless Functions.

### Story 4.1: Compute scoring inline

As a candidate,
I want my Match and Profile scores computed immediately when I apply or change my inputs,
So that scoring works without a background worker.

**Acceptance Criteria:**

**Given** the scoring services called directly (awaited) in the apply / onboarding-complete / input-change paths, behind the AI shimmer
**When** I apply to a job
**Then** the Match score is computed within the request and `applications.score_status` resolves to `completed` (or `failed`) in the response
**And** the explainable output (components + evidence + redacted_fields) is unchanged.

### Story 4.2: Remove BullMQ infrastructure

As a developer,
I want BullMQ and its workers removed,
So that no persistent queue process is required.

**Acceptance Criteria:**

**Given** the `queue` module, processors, and the three producer services deleted
**When** the project builds
**Then** no `bullmq`/queue imports remain
**And** admin batch rescore runs as a bounded, cursor-paginated admin operation that completes within request/cron budgets.

### Story 4.3: Remove socket.io realtime

As a developer,
I want the socket.io server and client removed,
So that the app holds no persistent WebSocket connections.

**Acceptance Criteria:**

**Given** the `realtime` module (gateway, RedisIoAdapter, ws-jwt, `EventsService`), `packages/shared/realtime`, the web `SocketProvider`, and realtime hooks deleted, with every `EventsService.emit(...)` call-site removed
**When** the project builds and runs
**Then** no socket.io server or client code remains and all features still function.

### Story 4.4: Replace live updates with polling

As a user,
I want notification counts, application/score status, and the recruiter pipeline to update on their own,
So that I still see fresh data without websockets.

**Acceptance Criteria:**

**Given** a shared `POLL_INTERVALS` constant and TanStack Query `refetchInterval` + `refetchOnWindowFocus` wired on the previously-live surfaces
**When** the underlying data changes
**Then** those surfaces reflect the change within the configured interval
**And** the orval client is regenerated and mutations still call `useInvalidate()`.

## Epic 5: Serverless Compute & Scheduling (Vercel Function + Vercel Cron)

Flip compute to Vercel and retire the droplet.

### Story 5.1: Run the NestJS API as a Vercel Function

As a developer,
I want the NestJS API deployed as a Vercel Function,
So that no droplet or PM2 process is needed.

**Acceptance Criteria:**

**Given** `apps/api/api/index.ts` that bootstraps and caches the Nest app (`app ??= bootstrap()`), `bootstrap` exported from `main.ts`, and `vercel.json`/`vercel.ts` configured
**When** the API is deployed to Vercel
**Then** all `/api/v1` routes respond and warm invocations reuse the cached app + connections
**And** the deployed bundle is verified to fit the 250 MB function limit.

### Story 5.2: Schedule jobs via Vercel Cron

As a developer,
I want the existing cron jobs triggered by Vercel Cron,
So that scheduled work runs without an always-on process.

**Acceptance Criteria:**

**Given** an `internal/cron.controller` (`CRON_SECRET`-guarded, `@Public` to the user guard) that calls each existing `cron.execute()`, registered in `vercel.json` crons
**When** Vercel Cron invokes an endpoint with the correct secret
**Then** the corresponding job runs; a request without the secret returns 403
**And** the plan is confirmed to support the required (minute-resolution) cron cadence.

### Story 5.3: Retire the legacy deploy stack

As a developer,
I want the old Digital Ocean deploy assets removed,
So that the repo reflects the serverless reality.

**Acceptance Criteria:**

**Given** Vercel Git integration configured for auto-deploy
**When** the migration is in place
**Then** `deploy/` and `apps/api/Dockerfile` are deleted and CI no longer references droplet/PM2 steps
**And** pushing to the deploy branch triggers a Vercel deployment.

## Epic 6: Domain Cutover & Production Verification

Go live on the new domain and prove the thesis demo path on the new stack.

### Story 6.1: Cut over domain and production environment

As the product owner,
I want AuraHire served from `aurahire.cjjutba.com` with all environment wired,
So that the public site runs on the new stack.

**Acceptance Criteria:**

**Given** `aurahire.cjjutba.com` configured on the Vercel web + API projects, with `NEXT_PUBLIC_*`, `ALLOWED_ORIGINS`/`APP_URL`, the OpenAPI server URL, and the email from-domain updated, and all Supabase/SMTP/HOST/REDIS_PASSWORD vars removed
**When** I visit the site and exercise the API
**Then** the web app loads, API calls succeed with correct CORS, and transactional emails send from the new domain.

### Story 6.2: Verify the thesis demo path end-to-end

As the product owner,
I want the locked PRD demo path to pass on production,
So that the migration is proven complete and thesis-defensible.

**Acceptance Criteria:**

**Given** the migrated production system
**When** the 6-step PRD demo path is executed (register→onboard→Profile Score; browse→match→apply; recruiter pipeline→interview→offer; admin audit→tune weights; bias flag→override→monitor; AI shimmer/badges throughout)
**Then** every step succeeds without faking
**And** explainability (score breakdown + evidence), fairness (PII redaction), and the audit trail are intact and observable.
