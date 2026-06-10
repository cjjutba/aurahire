# Development Guide

> Brownfield scan by `[DP] Document Project` · 2026-06-10 · Index: [index.md](./index.md) · Canonical setup doc: [docs/main/env-setup.md](./main/env-setup.md)

## Prerequisites
- **Node.js** `>=20.0.0` (root `engines`; 20.x LTS). CI pins Node `20`.
- **pnpm** `>=9.0.0`, pinned `pnpm@9.12.3` via `packageManager` (Corepack). CI uses the same.
- **Docker Desktop** running locally — required for the Mailpit + Redis dev containers started by `predev`. Monorepo uses **Turborepo** (`turbo ^2.3.3`) + pnpm workspace (`apps/*`, `packages/*`).

## Install & bootstrap
1. `pnpm install` at repo root.
2. `pnpm dev` runs `predev` first (`docker compose -f docker-compose.dev.yml up -d --wait` → Mailpit + Redis), then `turbo dev`.
3. `turbo dev` (`cache:false, persistent:true, dependsOn:["^build"]`) runs both apps in parallel:
   - `apps/web` → `next dev --turbo --port 3000` (**:3000**)
   - `apps/api` → `node --require @swc-node/register --inspect=9229 --watch src/main.ts` (**:3333**, debugger 9229)
4. Stop dev containers: `pnpm dev:down`.

> Per `CLAUDE.md`/`AGENTS.md`: only the human runs `pnpm dev`, Docker, DB migrations, and deploys. Agents type-check/lint/build/edit only.

## Environment setup
Env files are gitignored (`.env*` except `*.example`). Copy templates and fill real values:
- Root reference: `.env.example`
- Backend: `apps/api/.env.example` → `apps/api/.env`
- Frontend: web block of `.env.example` → `apps/web/.env.local`

**Frontend (`apps/web/.env.local`)** — browser-exposed vars are `NEXT_PUBLIC_*`:
| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (auth) — *changes with auth re-platform* |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_API_URL` | Backend base URL (`http://localhost:3333` dev) |
| `NEXT_PUBLIC_APP_URL` | Public web URL (`http://localhost:3000` dev) |

**Backend (`apps/api/.env`)** by concern:
- **Server/origins:** `NODE_ENV`, `PORT` (3333), `LOG_LEVEL`, `HOST`, `ALLOWED_ORIGINS` (CSV CORS), `APP_URL` (email links).
- **Database:** `DATABASE_URL` (Postgres conn string — *moves to Neon*).
- **Auth/storage:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service-role, backend only — *changes with auth re-platform*).
- **Redis (cache + BullMQ + throttler):** `REDIS_URL` (`redis://localhost:6379` dev — *moves to Upstash*).
- **OpenAI:** `OPENAI_API_KEY`, `OPENAI_MODEL` (`gpt-4o-mini`), `AI_TIMEOUT_MS` (`30000`).
- **Email:** `USE_RESEND` (switch — not `NODE_ENV`), `SMTP_HOST`, `SMTP_PORT` (`1025` Mailpit), `RESEND_API_KEY`, `FROM_EMAIL`.
- **Debug:** `DRIZZLE_DEBUG` (`1` logs all Drizzle SQL).

## Common commands (root)
| Command | Action |
|---|---|
| `pnpm build` | `turbo build` (`.next/**`, `dist/**`) |
| `pnpm lint` | `turbo lint` (ESLint per package) |
| `pnpm type-check` | `turbo type-check` (`tsc --noEmit`) |
| `pnpm format` / `format:check` | Prettier write / check |
| `pnpm clean` | `turbo run clean` + remove `node_modules`/`.turbo` |

**Tests** (no root `test` script — per package):
- API (Jest, `*.spec.ts` under `src/`): `pnpm --filter @aurahire/api test`
- Web unit (Vitest, jsdom): `pnpm --filter @aurahire/web test`
- Web E2E (Playwright): `pnpm --filter @aurahire/web e2e` (+ `e2e:headed`, `e2e:debug`, `e2e:ui`)

**Backend DB / utility scripts** (`apps/api/package.json`, each `--env-file=.env`; mutate a real DB → human runs them): `seed-db`, `reset-db`, `migrate-remove-screening`, `backfill-redacted-excerpts`, `backfill-match-score-components`, `generate:openapi` (regenerates `packages/shared/openapi.json` → orval), `test:ai-parse`, plus `scripts/generate-test-resumes.ts`, `scripts/smoke-test-openai.ts`.

**Schema (`packages/db`):** Drizzle schema in `src/schema.ts`; migrations are checked-in SQL under `drizzle/` (`0000`…`0016`, journal `drizzle/meta/_journal.json`). `drizzle.config.ts` loads `DATABASE_URL` from `apps/api/.env`. **No `db:push`/`db:migrate` scripts** — migrations are authored as SQL and applied manually (historically via Supabase MCP; revisit for Neon).

## Local services (`docker-compose.dev.yml`, project `aurahire-dev`)
- **Mailpit** (`axllent/mailpit`): SMTP **:1025**, web UI **http://localhost:8025**. Used when `USE_RESEND=false`.
- **Redis** (`redis:7-alpine`): **:6379**, AOF, `maxmemory 256mb`/`allkeys-lru`. Apps connect via `REDIS_URL=redis://localhost:6379` (no password in dev). Backs cache-manager, BullMQ, throttler.
- Both have healthchecks; `predev` waits with `--wait`.
