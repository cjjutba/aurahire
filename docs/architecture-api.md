# Architecture — API (`apps/api`)

> Part: **api** (NestJS 10 on Fastify) · Brownfield deep-scan by `[DP] Document Project` · 2026-06-10 · Index: [index.md](./index.md)
> Companion docs: [API Contracts](./api-contracts-api.md) · [Data Models](./data-models-db.md) · [Integration Architecture](./integration-architecture.md)

## Entry point & bootstrap (`apps/api/src/main.ts`)

NestJS app created over the **Fastify adapter** (`@nestjs/platform-fastify`), with Fastify's own logger disabled (`logger: false`) and `genReqId` neutralized so the custom `RequestIdMiddleware` owns request IDs. `bufferLogs: true`, then `app.useLogger(app.get(Logger))` swaps in **nestjs-pino** as the app logger.

Bootstrap sequence:
- **Helmet** (`@fastify/helmet`) with an explicit CSP (self + `validator.swagger.io` images, `unsafe-inline` styles/scripts for Swagger UI).
- **Multipart** (`@fastify/multipart`) for resume upload: 10 MB file cap, 1 file max.
- **CORS** via `app.enableCors`: origins from `ALLOWED_ORIGINS` (comma-split, default `http://localhost:3000`), `credentials: true`, allowed headers include `Authorization`, `Content-Type`, `X-Request-Id`, `X-Active-Company-Id`.
- **WebSocket adapter**: `RedisIoAdapter` constructed, `connectToRedis()` awaited, then `app.useWebSocketAdapter(...)` — must run before `listen()`.
- **Global prefix** `api` + **URI versioning** (`VersioningType.URI`, `defaultVersion: "1"`) → effective base path **`/api/v1`** (health is `VERSION_NEUTRAL` → `/api/health`).
- **Global pipe**: `ZodValidationPipe` (nestjs-zod) — all DTOs are Zod-derived.
- **Global filter**: `HttpExceptionFilter` (`apps/api/src/common/filters/http-exception.filter.ts`) — normalizes all errors to `{ statusCode, code, message, errors?, ...extras, timestamp, path, requestId }`; special-cases `ZodError` → 422 `VALIDATION_FAILED`, preserves extra body fields (e.g. bias `flags`).
- **Swagger** at **`/api/docs`** (`DocumentBuilder`, bearer-auth scheme, `persistAuthorization`).
- **Listen**: `PORT` (default `3333`), `HOST` (default `0.0.0.0`; set to a private bind in prod so only the reverse-proxy reaches the API).

Global guards registered in `app.module.ts` as four `APP_GUARD` providers, executing in order: **ThrottlerGuard → SupabaseAuthGuard → RolesGuard → ActiveCompanyGuard**. `RequestIdMiddleware` is applied to `*` via `NestModule.configure`.

## Module map (18 feature modules under `src/modules/`)

| Module | Responsibility |
|---|---|
| `auth` | Public signup (candidate/recruiter), email verify, resend, forgot/reset password — proxies Supabase Auth admin; no JWT minting on backend. |
| `profiles` | Base `profiles` row reads: `/profiles/me`, memberships list, `lastActiveCompanyId` switch. |
| `recruiter-profiles` | Recruiter subprofile (about/company/focus sections). |
| `candidate-profiles` | Candidate subprofile (personal/preferences) + onboarding completion tracking. |
| `companies` | Company CRUD, member management, invites, ownership transfer, leave — the multi-tenant core. |
| `invitations` | Invitation preview (public), accept, decline. |
| `jobs` | Job CRUD, publish/archive lifecycle, public listing + candidate/recruiter views. |
| `resumes` | Resume upload (multipart → storage), parse trigger, list, set-default, reparse, delete, download. |
| `scoring` | Profile Score compute/read + per-job Match Preview compute/read/list (candidate-facing AI). |
| `applications` | Apply, candidate "mine" list, recruiter pipeline/stats/analytics/shortlist, status/notes mutations, resume download. |
| `bias` | Job-description bias check (stateless) + stateful scan, list flags, override flag. |
| `interviews` | Schedule/reschedule, conflict check, status transitions, no-show, feedback (update/share), ICS download. |
| `interview-venues` | Company-scoped interview venue CRUD + set-default. |
| `offers` | Offer create, candidate accept/decline, recruiter withdraw, list. |
| `notifications` | In-app notification feed: list, unread-count, mark/archive/dismiss. |
| `notification-preferences` | Per-user channel/event notification preferences + restore-defaults. |
| `feedback` | User-submitted product feedback (submit) + admin triage controller (`admin/feedback`). |
| `admin` | Admin console: analytics, applications, audit (+CSV), bias-monitor, companies, scoring-config, jobs, queue (rescore), stats, users. |

## Cross-cutting layers

- **`ai/`** — `@Global` `AiModule`. `OpenAIService` (single OpenAI client, model `gpt-4o-mini` via `OPENAI_MODEL`, `AI_TIMEOUT_MS` default 30s, `maxRetries: 1`; `generateStructured` uses `zodResponseFormat` strict JSON-schema mode + re-validates with `schema.parse`; throws `503 AI_SERVICE_FAILED`/`AI_NO_OUTPUT`). Feature services: `ParseResumeService`, `ScoreProfileService`, `ScoreMatchService`, `DetectBiasService`, `RedactPiiService` (+ `redact-text-deterministic.ts`). Prompts versioned under `ai/prompts/` (`parse-resume`, `parse-resume-v2`, `score-profile`, `score-match`, `detect-bias`, `redact-text`, `redact-batch`).
- **`audit/`** — `AuditService.log()` appends to `audit_logs` (Drizzle); **non-throwing** (failures logged only). Emits a realtime `audit.entry` event via `EventsService` after each write.
- **`cache/`** — `@Global` `AppCacheModule`. `CacheService` is a tag-aware cache-aside layer over its **own dedicated ioredis client** (`CACHE_REDIS` symbol): `getOrSet` (single-flight in-process dedup, fail-open on Redis error), `bustTag(s)`/`bustKey`. Namespace `ah:v1`. TTL bands `hot=60s / warm=5m / cool=1h / ai=24h`. **Separate** from the `@nestjs/cache-manager` keyv instance (namespace `aurahire`) wired in `app.module.ts`.
- **`common/`** — guards, decorators, JWT verifier (`verify-supabase-jwt.ts`), exception filter, `RequestIdMiddleware`, `pg-error.ts`, `auth-user.type.ts`.
- **`config/`** — No `src/config` dir; config is `@nestjs/config` (`isGlobal: true, cache: true`); services read env via `ConfigService.getOrThrow`/`get`.
- **`cron/`** — `@nestjs/schedule` cron services (see below) + dev-only `CronAdminController` (`POST /admin/cron/run/:cronName`, 403 in prod).
- **`db/`** — `@Global` `DbModule`. Single Drizzle client over **postgres.js** (`DRIZZLE_CLIENT` symbol): pool `max: 10`, `idle_timeout: 30`, `connect_timeout: 10`, **`prepare: false`** (required for Supabase pgbouncer transaction mode). Conn string from `DATABASE_URL`. Schema from `@aurahire/db`. SQL logging via `DRIZZLE_DEBUG=1`.
- **`email/`** — `EmailService` (transport switch: `USE_RESEND=true` → Resend SDK; else Nodemailer SMTP → Mailpit). React-Email templates rendered to HTML at send; **failures logged, never thrown**. Supports ICS attachments.
- **`queue/`** — `@Global` `QueueModule` (BullMQ over `REDIS_URL`, default `attempts: 1`, completed kept 1d / failed 7d). Producers: `MatchPreviewQueueService`, `MatchScoreQueueService`, `ProfileScoreQueueService`.
- **`realtime/`** — `@Global` `RealtimeModule`. `RealtimeGateway` (Socket.io, path `/socket.io`), `EventsService` (broadcast helper), `WsJwtUtil` (handshake JWT auth), `SocketRateLimiter`, `Rooms`. Cross-instance fan-out via `RedisIoAdapter` (`@socket.io/redis-adapter`, fails open to in-memory if `REDIS_URL` unset).
- **`storage/`** — `StorageService` over Supabase Storage (service-role key): `upload`/`delete`; `docx-to-pdf.service.ts` for resume conversion (relies on a system `soffice`/LibreOffice binary — **serverless-migration risk**).
- **`health/`** — `GET /api/health` (`@Public`, version-neutral): `{ status, uptime, version, timestamp }`.

## Auth / RBAC

Three layered guards (all global) plus a throttler guard:

1. **`SupabaseAuthGuard`** — skips `@Public()`. Extracts `Authorization: Bearer <token>`, **verifies the Supabase JWT via JWKS** using **`jose`** (`verify-supabase-jwt.ts`: `createRemoteJWKSet` against `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, `issuer = ${SUPABASE_URL}/auth/v1`, `audience = "authenticated"`, JWKS cached 24h). Then one DB query to `profiles` (by `payload.sub`) to load `role`/`status`/`email`/`fullName`; rejects missing profile (`PROFILE_MISSING`), `suspended`, `deleted`. Attaches `req.user: AuthUser`.
2. **`RolesGuard`** — reads `@Roles(...UserRole)`; no `@Roles` = any authenticated user. Rejects `403 INSUFFICIENT_ROLE`. Roles: `candidate | recruiter | admin`.
3. **`ActiveCompanyGuard`** — the **multi-tenancy** resolver. Bypass order: `@Public()` → no `req.user` → `admin` (cross-tenant, no `companyRole`) → `candidate` (scoped by `candidate_id`) → `@SkipActiveCompany()`. Otherwise resolves `companyId` from **`X-Active-Company-Id` header** (UUID-validated) → `profiles.last_active_company_id` → auto-heal single membership; else `403 NO_ACTIVE_COMPANY`. Verifies active membership (cached, negative-cached), then enforces `@RequireCompanyRole(owner|admin|member)`. Attaches `req.activeCompanyId` + `req.companyRole`.

**Decorators** (`common/decorators/`): `@Public()`, `@Roles(...)`, `@CurrentUser()`, `@RequireCompanyRole(...)`, `@SkipActiveCompany()`, `@ActiveCompany()`. No standalone `OwnershipGuard` — resource ownership is enforced in service/repository layers (e.g. recruiter→job ownership in `RealtimeGateway.canAccessResource`).

> **Auth-migration flag:** every protected request depends on Supabase JWKS validation. Re-platforming auth (Supabase account lost) means rewriting `verify-supabase-jwt.ts`, `SupabaseAuthGuard`, the `auth` module's Supabase-admin proxying, and the frontend `@supabase/ssr` flow.

## Data access pattern

Repositories (`*.repository.ts`) inject the Drizzle client via `@Inject(DRIZZLE_CLIENT)` and query through Drizzle's typed builder against `@aurahire/db` tables. Services orchestrate repos + AI + audit + cache + queue + events. `prepare: false` is load-bearing for Supabase pgbouncer. RLS in Postgres is a third defense layer; the backend connects with service-role privileges.

## AI services (`src/ai/`)

Pattern for every AI call: **(1) PII redaction first** (`RedactPiiService` strips structured contact PII to a `[REDACTED]` sentinel + LLM-scrubs free-text ≥50 chars, returns `redactedFields[]`); **(2) structured output** (`generateStructured` strict JSON-schema + re-validate); **(3) audit trail** (every result carries `promptVersion`, `model`, `latencyMs`, token counts, `redactedFields`). Prompt versions: `PARSE_RESUME_VERSION`, `SCORE_PROFILE_VERSION`, `SCORE_MATCH_VERSION`, `DETECT_BIAS_VERSION`.

## Cron jobs (`src/cron/`, `@nestjs/schedule`, TZ Asia/Manila)

| Cron class | Schedule | Purpose |
|---|---|---|
| `ArchivePastDeadlineJobsCron` | daily 00:00 | Archive jobs past application deadline. |
| `CleanupUnverifiedAccountsCron` | Sun 02:00 | Delete unverified accounts (weekly). |
| `DigestEmailCron` | daily 08:00 | Daily digest email. |
| `ExpireOffersCron` | hourly | Expire offers past expiry; notify. |
| `InterviewAutocompleteCron` | every minute | Auto-complete interviews past end time. |
| `InterviewStartCron` | every minute | Transition interviews to `in_progress` at start time. |
| `InterviewReminderCron` | hourly | Upcoming-interview reminder emails. |
| `InterviewFeedbackDueCron` | hourly | Nudge recruiters when feedback is due. |
| `NotificationsRetentionCron` | daily 03:00 | Purge old notifications. |
| `OfferExpiryReminderCron` | hourly | Remind candidates of soon-expiring offers. |

> **Serverless-migration flag:** these assume an always-on process. On Vercel they become HTTP-triggered Vercel Cron endpoints (or an external scheduler). The minute-resolution interview crons are the trickiest.

## Queue / realtime

**BullMQ queues**: `match-score` (per-application redact+score, `concurrency 3`, emits `application.scored`), `match-preview-precompute` (top-N=5 per resume parse, `concurrency 1`, rate-limited), `profile-score-recompute` (`concurrency 3`), `rescore-batch` (admin bulk, `concurrency 1`), `notification-email`. Processors are `@Processor` classes extending `WorkerHost`.

**Realtime**: single `RealtimeGateway`. Handshake JWT auth as Socket.io middleware (`WsJwtUtil`, rejects pre-connect). On connect auto-joins `user:<id>` (+ `recruiter:<id>` / `role:admin`). `subscribe`/`unsubscribe` (Zod-validated, rate-limited) join resource rooms (`job:<id>`) only after `canAccessResource`. `EventsService` is the broadcast API; `RedisIoAdapter` backs cross-instance fan-out.

> **Serverless-migration flag:** persistent Socket.io WebSocket connections + the Redis adapter do not fit stateless Vercel Functions. This needs an explicit decision (managed realtime, a small always-on service, or polling).

## Caching & throttling

- **cache-manager** (`@nestjs/cache-manager`): keyv + `@keyv/redis` at `REDIS_URL`, namespace `aurahire`, default TTL 60s, fail-open to in-memory on Redis outage.
- **Dedicated `CacheService`**: tag-based cache-aside over its own ioredis client (namespace `ah:v1`).
- **Throttling** (`@nestjs/throttler`, first global guard): **Redis-backed** storage. Global throttlers are deliberately permissive; the real limits live on per-route `@Throttle(...)`: auth `5/60s`; `scoring/profile/compute` `1/60s`; `scoring/match-preview/:jobId` `5/60s`; `resumes/upload` `5/hr`. Scoring also enforces a per-user/day DB cap (`DAILY_AI_LIMIT` → 429).

## Notable conventions / gotchas

- **Effective base path is `/api/v1`** (`GET /api/health` is the only version-neutral route).
- **Two distinct Redis cache layers** coexist (`aurahire` keyv vs `ah:v1` tag-aware) — don't conflate them.
- **`prepare: false`** on postgres.js is mandatory (Supabase pgbouncer) — re-evaluate when moving to Neon (Neon's pooler also wants `prepare: false`).
- **Audit & email writes never throw** — must not break user flows.
- **Throttle limits split** between loose global module and strict per-route `@Throttle()`.
- **Admins bypass tenant scoping** (no `companyRole`); candidates are never company-scoped.
- **Route ordering matters**: static segments declared before `:id` params.
- **Every AI call redacts PII first + uses a Zod structured schema**; bumping a `*_VERSION` is a deliberate, thesis-defensible event.
