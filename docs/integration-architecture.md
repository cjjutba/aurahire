# Integration Architecture

> Brownfield scan by `[DP] Document Project` · 2026-06-10 · Index: [index.md](./index.md)
> How the monorepo parts (`web`, `api`, `shared`, `db`) and external services connect.

## Part topology

```
apps/web (Next.js 16, Vercel)
   │  REST: Authorization: Bearer <JWT> + X-Active-Company-Id  →  NEXT_PUBLIC_API_URL
   │  WebSocket: socket.io (/socket.io)                        →  realtime gateway
   ▼
apps/api (NestJS-on-Fastify)  ── Drizzle/postgres.js ──►  Postgres (Supabase → Neon)
   │   ├─ OpenAI (gpt-4o-mini, structured outputs)
   │   ├─ Redis (BullMQ queues · cache-manager · throttler · socket.io adapter)  → Upstash
   │   ├─ Supabase Auth JWKS (JWT validation) + Supabase Storage (resume files)
   │   └─ Resend (transactional email)
   ▲
packages/shared  (Zod schemas · enums · orval REST client · realtime contracts)  ← imported by BOTH web & api
packages/db      (Drizzle schema · enums · relations · RLS SQL · migrations)     ← api queries; web imports types only
```

## Integration points

| From → To | Channel | Contract |
|---|---|---|
| `web` → `api` | REST/HTTPS | orval-generated client + `serverApiFetch`/`clientApiFetch`; base `/api/v1`; `Authorization: Bearer <Supabase JWT>`, `X-Active-Company-Id` (recruiter) |
| `web` ↔ `api` | WebSocket (socket.io) | `/socket.io`; handshake JWT auth; rooms `user:<id>`, `recruiter:<id>`, `role:admin`, `job:<id>`; event names + payloads from `@aurahire/shared/realtime` |
| `api` → Postgres | Drizzle + postgres.js | `DATABASE_URL`, `prepare:false`; schema from `@aurahire/db`; RLS is defense-in-depth (backend uses service role) |
| `api` → OpenAI | HTTPS SDK | `gpt-4o-mini`, strict JSON-schema (`zodResponseFormat`), PII-redacted inputs, audited |
| `api` → Redis | ioredis / BullMQ | `REDIS_URL`; queues, cache, throttler storage, socket.io cross-instance adapter |
| `api` → Supabase | JWKS + Storage | JWT validation (`jose`, JWKS); resume file storage (service-role) |
| `api` → Resend | HTTPS SDK | transactional email when `USE_RESEND=true` (else Mailpit SMTP) |
| both → `shared`/`db` | TS imports | type-safe contracts; `web` never imports `@aurahire/db` directly (gets enums/types via `@aurahire/shared`) |

## The end-to-end type chain (do not break)
`Zod schema (packages/shared)` → `NestJS DTO (nestjs-zod)` → `OpenAPI (@nestjs/swagger → packages/shared/openapi.json)` → `orval client (packages/shared/api-client)` → `TanStack Query hook` → `RHF + JSX`. Changing a contract = update the Zod schema, regenerate OpenAPI (`pnpm --filter @aurahire/api generate:openapi`), regenerate the client (orval). Don't patch one layer alone.

## `packages/shared` — the shared contract layer
Single import point (`@aurahire/shared`, `AURAHIRE_SHARED_VERSION = "0.4.0"`), UI-agnostic. Barrel re-exports:
- **Zod schemas** (`schemas/*` + `onboarding/*`) — single source of truth for input shapes, consumed by NestJS DTOs (nestjs-zod) and web forms (RHF resolver). Domains: `shared` (atoms, pagination, response-meta), `auth`, `onboarding`, `jobs`, `parsed-resume` (AI resume-parse structured output, with `*_source` verbatim strings for PDF highlight positioning), `score` (AI profile/match structured outputs + calibration warning), `bias`/`bias-requests`, `applications`, `interviews`, `interview-venues`, `offers`, `companies`, `notifications`, `feedback`, `admin` (scoring-config nested schemas, audit/analytics/bias-monitor queries, rescore-batch).
- **Enums** (`enums/index.ts`) — pure re-export of `@aurahire/db` const tuples, so the frontend imports enums from `@aurahire/shared`, never `@aurahire/db`.
- **Constants** — `score-thresholds.ts` (`STRONG=70`, `PARTIAL=40`, `AUTO_REJECT=75`, `DEFAULT_MATCH_WEIGHTS` skills 40/exp 35/edu 15/cultural 10, `DEFAULT_PROFILE_WEIGHTS` completeness 25/skill_depth 30/exp_clarity 30/edu 15 — runtime reads the `scoring_config` row, these are fallbacks); `ai-limits.ts` (`MAX_RESUME_SIZE_BYTES` 10MB, PDF+DOCX MIME, `AI_TIMEOUT_MS` 30s, `DEFAULT_AI_MODEL` gpt-4o-mini); `pagination.ts` (default 25/max 100); `proactive-system.ts` (caps + cron lead-hours + `PRECOMPUTE_TOP_N`).
- **Skills taxonomy** (`skills-taxonomy.ts`) — ~120 static skill names backing the onboarding Skills typeahead.
- **Types** (`types/`) — `AuthUser` (shape attached to `req.user`, returned by `/profiles/me`) and `ApiErrorResponse` (standard error envelope).

## orval API client (`packages/shared/api-client/`)
- **Generation** (`orval.config.ts`, orval v8.9.0): input `packages/shared/openapi.json` (from the NestJS backend) → output `src/api-client/generated.ts`, client `react-query` (`useQuery`+`useMutation`, default `staleTime` 5min), prettier post-gen.
- **Custom fetcher/mutator** (`src/api-client/fetcher.ts`): resolves base URL (`globalThis.__AURAHIRE_API_URL__` → `NEXT_PUBLIC_API_URL` → `http://localhost:3333`); injects `Authorization: Bearer <jwt>` from a module-level token + `X-Active-Company-Id` from a pluggable resolver; `credentials: include`; throws `Error` with `{ response, body, status }`; `undefined` on 204.
- **Singletons exposed:** `fetcher`, `setAccessToken`/`getAccessToken` (web's `AuthTokenProvider` sets it on session change), `setActiveCompanyResolver` (web installs a localStorage resolver), types `Fetcher`/`FetcherOptions`. Hooks named per controller+method+version (e.g. `useApplicationsControllerApplyV`).

## Realtime contracts (`packages/shared/realtime/`)
Shared between backend gateway (emitter) and web client (listener). Past-tense dotted event names (`RealtimeEvent`): `application.{created,status_changed,scored,recommendationSet,withdrawn}`, `interview.{scheduled,status_changed,completed,rescheduled,feedbackShared}`, `offer.sent`, `audit.entry`, `bias.flag_created`, `match-preview.created`, `profile-score.updated`, `notification.{created,read,archived,archive_all}`. Zod payload schemas (UUID ids, ISO timestamps) + `RealtimeEventPayloadMap` typed handler map. Client→server `subscribeMessageSchema` (`{ resource:"job", id }`).

> **Migration flags concentrated here:** the auth contract (Supabase JWT), the Redis-backed realtime adapter, and the always-on socket.io gateway are the integration points most affected by the serverless move. The REST type chain, Drizzle schema, and shared Zod contracts are portable as-is.
