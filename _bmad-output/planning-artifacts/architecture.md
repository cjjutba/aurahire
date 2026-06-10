---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-06-10'
inputDocuments:
  - docs/main/prd.md
  - docs/main/architecture.md
  - docs/main/tech-stack.md
  - docs/main/database-schema.md
  - docs/main/ai-design.md
  - docs/main/technical-specifications.md
  - docs/main/best-practices.md
  - docs/main/caching-strategy.md
  - _bmad-output/project-context.md
  - docs/index.md
  - docs/deployment-guide.md
  - docs/integration-architecture.md
  - docs/architecture-api.md
  - docs/architecture-web.md
  - docs/data-models-db.md
workflowType: 'architecture'
architectureType: 'brownfield-replatform'
project_name: 'aurahire'
user_name: 'Cjjutba'
date: '2026-06-10'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

> **Scope:** This is a **brownfield re-platform** architecture — moving AuraHire off Digital Ocean to a fully serverless stack (Vercel + Neon + Upstash), replacing Supabase Auth, and migrating the domain to `aurahire.cjjutba.com`. The product requirements (`docs/main/prd.md`) are unchanged; the framing for the change is the **Migration State** table in `_bmad-output/project-context.md` and `docs/deployment-guide.md`. Decisions here must preserve the existing 18-module backend, 21-table schema, and end-to-end type chain while removing every dependency on always-on infrastructure.

## Project Context Analysis

### Requirements Overview

**Functional scope (feature-complete, must be preserved):**
13 PRD areas — auth, candidate/recruiter onboarding, job management (+ bias check on publish), resume upload/parse, Profile Scoring engine, Match Scoring engine, bias detection, application workflow, interviews, offers, 8-feature admin portal, notifications/email, audit logging. PLUS post-PRD features now in code: multi-tenancy (companies/memberships/invites), socket.io realtime, in-app notifications + preferences, feedback inbox, interview venues, async BullMQ scoring. (The locked PRD predates these — the brownfield scan in `docs/` is the accurate baseline.)

**Non-Functional Requirements driving the re-platform:**
- **STATELESSNESS (new, decisive):** target compute has no always-on process. Affects socket.io WS, `@nestjs/schedule` cron, BullMQ workers, in-process cache single-flight, and the LibreOffice `soffice` binary (DOCX→PDF).
- **Explainability/fairness/audit (thesis-critical):** PII-redact → structured-output → audit on every AI call; evidence excerpts; append-only audit; prompt-version tracking. Must be byte-for-byte preserved.
- **Performance:** AI parse <30s, score <15s, bias <10s; page cold <3s / warm <1.5s. Function timeout must absorb in-line AI (Vercel default 300s is ample).
- **Security:** 5-layer defense (web middleware → CORS/Helmet → AuthGuard → Roles/Ownership → RLS); rate limiting; secrets backend-only.
- **Privacy:** PII redaction before scoring; GDPR export/delete; audit retention.
- **Reliability:** graceful AI degradation; cache fails open; managed DB backups.

**Scale & Complexity:**
- Primary domain: full-stack (Next.js 16 web + NestJS-on-Fastify API + Postgres)
- Complexity level: medium (multi-tenant + realtime + async AI + explainability), thesis/portfolio scale (~50+ concurrent), not enterprise
- Architectural components in scope for change: ~7 (compute host, DB host, auth, cache/queue/throttle store, realtime, cron, file storage/DOCX→PDF) + domain cutover

### Technical Constraints & Dependencies

- **Supabase account LOST** → cannot keep Supabase Postgres, Supabase Auth, OR Supabase Storage. DB → Neon (decided). Auth + Storage replacements are open decisions.
- All RLS policies + `profiles`/`auth_tokens` are coupled to Supabase `auth.uid()` / `auth.users` (no real FK). Re-platforming auth forces an RLS rethink.
- Drizzle + postgres.js is portable to Neon (connection-string swap; keep `prepare:false` for Neon's pooled endpoint); 17 checked-in SQL migrations must be applied on Neon.
- Redis backs **FOUR** roles (BullMQ, cache-manager, throttler storage, socket.io adapter) → the replacement must serve all four; Upstash is the candidate.
- LibreOffice-dependent DOCX→PDF (`storage/docx-to-pdf.service.ts`) won't run on serverless Functions — needs rework or a hosted conversion path.
- BullMQ requires a worker runtime; `@nestjs/schedule` cron requires an always-on process — neither fits stateless Functions as-is.
- The end-to-end type chain (Zod → nestjs-zod → OpenAPI → orval → TanStack Query) must remain intact across the move.
- Domain cutover `aurahire.site` → `aurahire.cjjutba.com` touches CORS, `NEXT_PUBLIC_API_URL`, auth redirect URLs, email from-domain, OpenAPI server URL.

### Cross-Cutting Concerns Identified

1. **Auth (highest risk)** — Supabase Auth replacement + RLS rework + frontend `@supabase/ssr` flow + backend JWKS validation + auth module's Supabase-admin proxying.
2. **Redis's four roles** — queues, cache, throttle store, realtime adapter.
3. **Realtime** — persistent socket.io WS on stateless compute.
4. **Scheduled work** — cron + async queue workers without an always-on host.
5. **File handling** — resume storage + DOCX→PDF conversion off Supabase Storage/LibreOffice.
6. **AI/audit/fairness pipeline** — preserved exactly through the move.
7. **Type-chain & contract integrity** — orval client regen across environments.

## Starter Template Evaluation

### Primary Technology Domain
Full-stack Turborepo monorepo (Next.js 16 web + NestJS-on-Fastify API + Postgres). **Brownfield re-platform — no greenfield starter applies.** The existing repo is the foundation; this step fixes the deployment substrate, not a scaffold.

### Starter Options Considered
N/A (greenfield starters like create-next-app / T3 / Nest CLI are irrelevant to an existing, locked codebase). The equivalent "foundation" decision is the deployment platform and its framework adapters.

### Selected Foundation: existing monorepo on Vercel (zero-config framework deploys)
**Rationale:** Vercel now deploys both halves of this stack with zero config — Next.js (already there) and NestJS-on-Fastify as a single Fluid-Compute Function. This removes the entire DO/PM2/Docker/Caddy layer without restructuring the apps, and keeps the monorepo + type chain intact.

**Verified current platform facts (June 2026):**
- NestJS → one Vercel Function on Fluid Compute, auto-scaling, Fastify adapter OK, 250 MB function size limit. ([vercel.com/docs/frameworks/backend/nestjs](https://vercel.com/docs/frameworks/backend/nestjs))
- Neon: postgres.js against the pooled (PgBouncer) endpoint needs `prepare:false`; unpooled string for migrations. ([neon.com/guides/drizzle-local-vercel](https://neon.com/guides/drizzle-local-vercel))
- BullMQ does NOT fit stateless Functions — needs QStash / Upstash Workflow / Inngest or a persistent worker. ([upstash.com/docs/qstash](https://upstash.com/docs/qstash/overall/compare))
- socket.io WebSockets unsupported on Functions — managed realtime (Ably / Pusher / PartyKit) or a separate always-on service. ([vercel.com/kb WebSocket guide](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections))

**Foundation initialization (first implementation story, not a scaffold):**
- `vercel link` each app; add a Vercel Function entry that bootstraps the Nest app (cached across invocations); set framework env + custom domain.
- Retire `deploy/` (provision/pm2/caddy/nginx/compose).

**Note:** Substantive platform decisions (queue strategy, realtime strategy, auth replacement, Neon driver choice, storage/DOCX→PDF) are made in the next step. The central fork to resolve: **100% serverless** vs **serverless + one small always-on service** for realtime/queue/cron.

## Core Architectural Decisions

> Resolved with the user: **Auth → Clerk**, **Realtime → drop socket.io, replace with polling**. Result: fully-serverless, zero always-on services — Vercel (web + API Function) + Neon + Upstash + Clerk + Vercel Blob + Vercel Cron + Resend. BullMQ and socket.io both removed; Redis roles drop 4→2 (cache + throttle).

### Decision Priority Analysis

**Critical (block implementation):**
- Auth → Clerk (replaces Supabase Auth)
- DB host → Neon Postgres
- Compute → NestJS as a single Vercel Function (Fluid Compute)
- Realtime → drop socket.io, replace with polling

**Important (shape architecture):**
- Cache + throttle store → Upstash Redis (Redis roles drop 4→2: socket.io adapter & BullMQ removed)
- Async scoring → inline in the function (300s ≫ 15s AI); BullMQ removed
- Cron → Vercel Cron
- File storage → Vercel Blob (private)
- RLS → dropped on Neon (auth.uid() is Supabase-only; access is backend-only so guards were always authoritative)
- Domain → aurahire.cjjutba.com

**Deferred (decide at implementation):**
- DOCX→PDF rework: managed converter (Nutrient/Apryse/CloudConvert) vs render DOCX text & drop canonical-PDF vs docx-wasm
- Admin batch rescore transport: chunked-in-function vs QStash/Inngest (only matters at volume)
- Optional future: Neon-native session-variable RLS for defense-in-depth

### Data Architecture
- **Neon Postgres** (PG18, AWS Singapore). Keep **Drizzle + postgres.js**; `prepare:false` on the pooled endpoint, a separate **unpooled** `DATABASE_URL_UNPOOLED` for `drizzle-kit migrate`. Apply existing migrations 0000–0016 on Neon. Adopt `drizzle-kit migrate` going forward (replaces the manual Supabase-MCP path). ([neon.com/guides/drizzle-local-vercel](https://neon.com/guides/drizzle-local-vercel))
- **Caching/throttle store → Upstash Redis** (`rediss://`). ioredis drop-in; cache-manager + tag-aware CacheService + @nestjs/throttler storage all keep working; fail-open preserved.
- **RLS dropped.** auth.uid() doesn't exist in Neon and the frontend never touches the DB — the 5-layer guard stack (minus RLS) remains fully authoritative. Documented as a deliberate, defensible decision.

### Authentication & Security
- **Clerk** (50K free MAU). Frontend: `@clerk/nextjs` (ClerkProvider + clerkMiddleware + prebuilt sign-in) replaces `@supabase/ssr`. Backend: validate Clerk JWT via **JWKS with jose** — reuse the existing `verify-supabase-jwt.ts` shape as `verify-clerk-jwt.ts` (swap issuer + JWKS URL + audience); the guard stays ~identical. ([clerk.com/pricing](https://clerk.com/pricing))
- **Identity mirroring:** `profiles.id` ← Clerk `userId`, synced via a Clerk webhook (`user.created`→upsert) or lazy-create on first authed request (same mirror pattern Supabase used).
- **Role in JWT:** store role in Clerk `publicMetadata` → it rides in the JWT claim, so `middleware.ts` can finally do **per-role routing** (fixes today's "no role claim" TODO). RolesGuard + ActiveCompanyGuard + RequireCompanyRole unchanged.
- **Auth module shrinks:** Clerk owns email-verify / password-reset / sessions → the `auth` module's Supabase-admin proxying and the `auth_tokens` table are removed.

### API & Communication Patterns
- REST `/api/v1` + OpenAPI + **orval type chain unchanged** (regenerate client after the move).
- **Realtime removed:** delete the socket.io gateway, RedisIoAdapter, WsJwtUtil, SocketRateLimiter, realtime module, `packages/shared/realtime`, web SocketProvider + realtime hooks. Live surfaces (notifications unread-count, application/score status, recruiter pipeline) move to **TanStack Query `refetchInterval` / on-focus refetch / `router.refresh()`**. Every backend `EventsService.emit(...)` call site drops its emit.
- **Async work removed:** BullMQ gone. Match + Profile scoring run **inline** (await + AI shimmer — restores the original PRD model). `applications.score_status` completes within the request. Admin batch rescore → chunked-in-function (cursor + 300s) or QStash if it grows.

### Frontend Architecture
- Next.js 16 on Vercel, largely unchanged. `@clerk/nextjs` replaces `@supabase/ssr`; `lib/auth/*` + `AuthTokenProvider` rewritten for Clerk (orval fetcher reads Clerk `getToken()`). SocketProvider + realtime hooks removed. TanStack Query otherwise unchanged.
- Env: add `NEXT_PUBLIC_CLERK_*`; point `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_APP_URL` at the new domain; remove `NEXT_PUBLIC_SUPABASE_*`.

### Infrastructure & Deployment
- **Both apps on Vercel.** API = one Vercel Function (Fluid Compute) via an entry handler that bootstraps the Nest app cached across invocations. Frontend unchanged.
- **Cron → Vercel Cron** (HTTP endpoints calling each cron's `execute()`). ⚠️ Verify plan: minute-resolution interview crons need **Vercel Pro** (Hobby cron granularity is limited).
- **Storage → Vercel Blob** (private); `StorageService` rewritten for `@vercel/blob`. **DOCX→PDF** LibreOffice path removed (deferred approach above).
- **CI/CD → Vercel Git integration** (auto-deploy). `ci.yml` validate job stays; the entire `deploy/` folder + Dockerfile are retired.
- **Env set:** Neon `DATABASE_URL` (+ `_UNPOOLED`), Upstash `REDIS_URL` (`rediss://`), `CLERK_*`, `BLOB_READ_WRITE_TOKEN`, `RESEND_*`, `ALLOWED_ORIGINS`/`APP_URL` → `aurahire.cjjutba.com`. Remove `SUPABASE_*`, `SMTP_*`, `HOST`, `REDIS_PASSWORD`.

### Decision Impact Analysis

**Implementation sequence:**
1. Neon up → apply migrations 0000–0016 → swap `DATABASE_URL` → drop RLS
2. Upstash Redis → swap `REDIS_URL`
3. Clerk: frontend SDK + backend JWKS guard + profile-mirror webhook + remove Supabase auth/auth_tokens
4. Remove socket.io realtime → polling
5. Remove BullMQ → inline scoring (+ batch path)
6. Vercel Blob storage + DOCX→PDF rework
7. NestJS-on-Vercel function entry + Vercel Cron
8. Domain cutover + env + retire `deploy/` → regenerate orval client → full QA

**Cross-component dependencies (→ epic boundaries for [CE]):**
- Auth change spans backend guards + auth module + frontend middleware/providers/lib + profiles + env
- Realtime removal spans backend realtime module + every EventsService caller + shared contracts + frontend providers/hooks
- BullMQ removal spans queue module + processors + 3 producer services + score_status flow

## Implementation Patterns & Consistency Rules

### Existing conventions — LOCKED (do not re-decide)
All current conventions survive the migration unchanged; agents follow them as-is: kebab-case filenames, snake_case DB columns ↔ camelCase JSON (at the Zod boundary), `{ data }` response envelope + standard error envelope, module→controller→service→repository structure, Server-Components-first, the Zod→DTO→OpenAPI→orval→TanStack type chain, no barrel exports, comments-WHY-only, JetBrains Mono for numbers. Source of truth: `docs/main/best-practices.md` + `_bmad-output/project-context.md`.

### New patterns introduced by the migration (where agents could diverge)

**Auth (Clerk):**
- Backend: `verify-clerk-jwt.ts` mirrors today's `verify-supabase-jwt.ts` — jose `createRemoteJWKSet(CLERK_JWKS_URL)`, verify issuer/audience. `SupabaseAuthGuard` → `ClerkAuthGuard` (same shape, attaches `req.user`).
- **IDENTITY MAPPING (decision):** KEEP `profiles.id uuid` as the PK (15+ FKs depend on it); ADD `profiles.clerk_user_id text UNIQUE` and look profiles up by it. Do NOT change the PK type to Clerk's `user_...` string — that would cascade through every FK. New migration.
- Profile sync: Clerk webhook `/api/v1/webhooks/clerk` (Svix-verified, `@Public`) upserts profile on `user.created/updated`; lazy-upsert fallback in the guard.
- Role: source of truth = `profiles.role`, mirrored to Clerk `publicMetadata.role` so it rides in the JWT → `clerkMiddleware()` does per-role routing. Keep in sync on role change.
- Frontend: `@clerk/nextjs` (`<ClerkProvider>`, `clerkMiddleware`, `getToken()` feeds the orval fetcher). Remove `@supabase/ssr`, `AuthTokenProvider`, Supabase bits of `lib/auth/*`.

**Polling (ex-realtime):**
- Removing a live surface = delete the `EventsService.emit(...)` + give the consuming query a `refetchInterval` + `refetchOnWindowFocus`. Mutations still call `useInvalidate()`.
- Standardize intervals in one shared `POLL_INTERVALS` const (e.g. unread-count 30s, active application/pipeline 15s, dashboards 60s) — agents never pick arbitrary numbers.

**Inline scoring:**
- Scoring services are `await`-ed directly in the triggering request (apply→match, onboarding/input-change→profile) behind the AI shimmer; `score_status` resolves to completed/failed within the request. No queue producer/processor. Admin batch rescore = a bounded, cursor-paginated admin endpoint loop, not a queue.

**Vercel Function (NestJS):**
- One Nest app instance cached in module scope across warm invocations (`app ??= await bootstrap()`); never create per-request. postgres.js pool + ioredis created once at module load and reused.

**Neon connection:** runtime → pooled endpoint with `prepare:false`; migrations/seeds/scripts → `DATABASE_URL_UNPOOLED`. Never run `drizzle-kit migrate` against the pooled URL.

**Storage (Vercel Blob):** `StorageService` uses `@vercel/blob` (`put`/`del`, private access); downloads via short-lived signed URL or API proxy. Recruiter downloads keep the REDACTED resume variant. Replace every Supabase Storage call.

**Cron (Vercel):** each cron = an authenticated internal endpoint (`/api/v1/internal/cron/:name`, `CRON_SECRET` header, `@Public` to the user guard) that calls the existing `cron.execute()`. Registered in `vercel.json`/`vercel.ts` crons. Cron classes unchanged — only the trigger changes.

**Env/secrets:** add `DATABASE_URL`(+`_UNPOOLED`), `REDIS_URL` (rediss://), `CLERK_SECRET_KEY`/`CLERK_PUBLISHABLE_KEY`/`CLERK_JWKS_URL`/`CLERK_WEBHOOK_SECRET`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`. Remove `SUPABASE_*`, `SMTP_*`, `HOST`, `REDIS_PASSWORD`.

### Enforcement — all agents MUST
- Keep the LOCKED conventions; use the NEW patterns above for any migration-touched code.
- Never reintroduce Supabase / socket.io / BullMQ.
- Regenerate the orval client after any contract change (keep the type chain intact).
- Preserve the AI redact→structured-output→audit pipeline byte-for-byte.

## Project Structure & Boundaries

### Target structure (same monorepo) — migration delta (➕ add · ➖ remove · ✏️ change)

```
aurahire/
├── vercel.json (or vercel.ts)             ➕ API Function build + crons + domain/rewrites
├── apps/
│   ├── web/                               (Next.js 16 — mostly unchanged)
│   │   ├── app/layout.tsx                 ✏️ <ClerkProvider> replaces AuthTokenProvider + SocketProvider
│   │   ├── app/(auth)/…                   ✏️ Clerk sign-in/up flows
│   │   ├── middleware.ts                  ✏️ clerkMiddleware + role gate from JWT claim
│   │   ├── lib/auth/                      ✏️ rewritten for Clerk (drop supabase client/server/ssr)
│   │   ├── lib/realtime/                  ➖ removed
│   │   ├── components/providers/auth-token-provider.tsx  ➖ removed
│   │   ├── components/providers/socket-provider.tsx      ➖ removed
│   │   ├── hooks/use-realtime-*.ts        ➖ removed
│   │   └── hooks/use-*.ts                 ✏️ add refetchInterval where realtime fed updates
│   └── api/                               (NestJS-on-Fastify)
│       ├── api/index.ts                   ➕ Vercel Function entry (cached `app ??= bootstrap()`)
│       ├── src/main.ts                    ✏️ export bootstrap; retained for local dev
│       ├── src/common/auth/verify-supabase-jwt.ts  ➖ removed
│       ├── src/common/auth/verify-clerk-jwt.ts     ➕ Clerk JWKS verify
│       ├── src/common/guards/clerk-auth.guard.ts   ✏️ (was supabase-auth.guard.ts)
│       ├── src/modules/auth/              ✏️ shrinks → profile sync (drop signup/verify/reset)
│       ├── src/modules/webhooks/          ➕ Clerk webhook controller (Svix-verified, @Public)
│       ├── src/realtime/                  ➖ removed (gateway, RedisIoAdapter, ws-jwt, EventsService)
│       ├── src/queue/                     ➖ removed (BullMQ producers)
│       ├── src/modules/*/                 ✏️ drop EventsService emits; scoring inline; producers → direct calls
│       ├── src/cron/                      ✏️ classes kept; triggered via internal endpoint
│       ├── src/modules/internal/cron.controller.ts  ➕ CRON_SECRET-guarded trigger
│       ├── src/storage/                   ✏️ Vercel Blob; ➖ docx-to-pdf.service.ts (LibreOffice)
│       ├── src/db/db.module.ts            ✏️ Neon conn (pooled prepare:false)
│       ├── Dockerfile                     ➖ removed
│       └── .env.example                   ✏️ new var set
├── packages/
│   ├── shared/src/realtime/               ➖ removed
│   ├── shared/src/constants/poll-intervals.ts  ➕ standardized intervals
│   └── db/
│       ├── drizzle.config.ts              ✏️ DATABASE_URL_UNPOOLED for migrate
│       └── drizzle/0017_clerk_identity.sql ➕ add profiles.clerk_user_id; drop auth_tokens; RLS dropped
├── deploy/                                ➖ entire folder retired
└── docker-compose.dev.yml                 ✏️ local-only (Redis/Mailpit for dev; prod = Upstash/Resend)
```

### Architectural boundaries
- **Web ↔ API:** unchanged REST `/api/v1` (Bearer Clerk JWT + `X-Active-Company-Id`). Frontend still owns no DB/AI/secrets.
- **Auth boundary:** Clerk issues, backend validates via JWKS (authoritative). Frontend never validates.
- **Realtime boundary:** REMOVED — same updates now via polling over the existing REST boundary.
- **Data boundary:** backend-only DB access to Neon; RLS dropped (guards authoritative).
- **Storage boundary:** Vercel Blob, backend-mediated (recruiter downloads stay redacted).
- **shared/db boundaries:** unchanged (web imports types/enums via `@aurahire/shared` only).

### Epic → location mapping (seeds [CE])
1. **Neon DB cutover** → packages/db (drizzle.config, migration runner), apps/api/src/db, env
2. **Auth → Clerk** → apps/api/src/common/auth + guards + modules/auth + modules/webhooks + 0017 migration; apps/web middleware + lib/auth + layout + (auth); env
3. **Remove realtime → polling** → apps/api/src/realtime + every EventsService caller; packages/shared/realtime; apps/web providers/hooks + POLL_INTERVALS
4. **Remove BullMQ → inline scoring** → apps/api/src/queue + producers/processors; modules/{applications,scoring}; score_status flow
5. **Storage + DOCX→PDF** → apps/api/src/storage
6. **Compute (Vercel Function) + Cron** → apps/api/api entry + vercel config + internal cron controller
7. **Domain + env + retire deploy/** → Vercel domain, env across apps, delete deploy/, regenerate orval client

### Integration points (external)
Neon (DB) · Upstash Redis (cache + throttle) · Clerk (auth + webhook) · Vercel Blob (files) · OpenAI · Resend · Vercel Cron. (Removed: Supabase ×3, self-hosted Redis-for-WS/queue, LibreOffice.)

## Architecture Validation Results

### Coherence Validation ✅
**Decision Compatibility:** All target services are mutually compatible serverless primitives — Vercel Function (NestJS) + Neon (postgres.js pooled, `prepare:false`) + Upstash (ioredis) + Clerk (JWKS) + Vercel Blob + Vercel Cron + Resend. No contradictory choices. The Clerk JWKS guard reuses the existing jose pattern; Upstash is an ioredis drop-in; Neon keeps postgres.js. One coupling to watch: minute-resolution interview crons require Vercel Pro (Hobby cron granularity is coarser).

**Pattern Consistency:** The new patterns (Clerk guard + `clerk_user_id` mapping, polling via `POLL_INTERVALS`, inline scoring, cached Function bootstrap, pooled/unpooled Neon, Blob storage, `CRON_SECRET` endpoints) each support a specific decision and don't conflict with the LOCKED conventions ({data} envelope, type chain, kebab-case, snake_case↔camelCase).

**Structure Alignment:** The delta tree maps every decision to concrete files; boundaries (web↔api REST, backend-only data, Clerk auth, Blob storage) are preserved or cleanly removed (realtime). No orphaned components.

### Requirements Coverage Validation ✅
**Functional coverage:** All 13 PRD feature areas + post-PRD features (multi-tenancy, notifications, feedback, interview venues) are preserved. The only user-facing change is realtime→polling (same updates, ~seconds-latency). Scoring moves async→inline but keeps the explainable output + shimmer. No functionality dropped.

**NFR coverage:** Statelessness ✅ (zero always-on services) · Explainability/fairness/audit ✅ (pipeline untouched) · Performance ✅ (inline AI within the 300s budget; bounded polling) · Security ✅ (guards authoritative; rate-limit on Upstash) · Privacy ✅ (PII redaction + redacted recruiter downloads preserved) · Reliability ✅ (cache fail-open; Neon managed backups) · ⚠️ Security tradeoff: RLS dropped — see gaps (accepted: backend-only access).

### Implementation Readiness Validation ✅
Decisions documented with rationale + sources; patterns comprehensive with the one real design call resolved (`clerk_user_id` column, not PK retype); structure complete and mapped to epics; integration points enumerated.

### Gap Analysis Results
**Critical (block implementation):** NONE.
**Important (decide during implementation, non-blocking):**
- DOCX→PDF approach not finalized (managed converter vs render-text vs docx-wasm). Affects only resume canonical-PDF preview; ships with a text-render fallback if undecided.
- Vercel plan check: minute crons (interview-start/autocomplete) need Pro. Verify before cutover.
- RLS dropped = one fewer defense layer. Accepted because access is backend-only; mitigation = never expose the DB directly; optional future Neon session-variable RLS.
- Vercel 250 MB function size: verify the Nest bundle fits (LibreOffice removal helps materially).

**Minor:** local dev keeps docker-compose Redis/Mailpit; `score_status` column retained for UI compat.

### Architecture Completeness Checklist
**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**
- [x] Naming conventions established (LOCKED + new patterns)
- [x] Structure patterns defined
- [x] Communication patterns specified (REST + polling)
- [x] Process patterns documented (auth, scoring, cron, storage)

**Project Structure**
- [x] Complete directory delta defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements→structure (epic) mapping complete

### Architecture Readiness Assessment
**Overall Status:** READY WITH MINOR GAPS (no critical gaps; 4 important items deferred to implementation, all non-blocking and scoped above)
**Confidence Level:** High
**Key Strengths:** zero always-on infra; thesis-critical AI/fairness/audit pipeline preserved byte-for-byte; auth decoupled from the DB (the big de-risk); the migration decomposes into 7 clean, low-coupling epics.
**Areas for Future Enhancement:** Neon-native RLS; managed DOCX→PDF fidelity; batch rescore via QStash/Inngest if volume grows; managed realtime (Ably/Pusher) if live UX is wanted back.

### Implementation Handoff
**AI Agent Guidelines:** follow these decisions exactly; use the new patterns; never reintroduce Supabase/socket.io/BullMQ; regenerate orval after contract changes; preserve the AI redaction→structured-output→audit pipeline.
**First Implementation Priority:** Neon DB up → apply migrations 0000–0016 → swap `DATABASE_URL` → drop RLS (epic 1), then Upstash + Clerk in parallel.
