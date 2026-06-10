# Deployment Guide

> Brownfield scan by `[DP] Document Project` · 2026-06-10 · Index: [index.md](./index.md)
> ⚠️ **This describes the topology being RETIRED.** See the Migration section — the DO-droplet path is dead; target is fully serverless (Vercel + Neon + Upstash).

## Current (as-built) topology — being retired

- **Frontend → Vercel.** Project `aurahire-thesis` (`.vercel/project.json`: `projectId prj_jXrwJ7BJJZOzCm80DVqCDUQtUMEn`, `orgId team_3mAiEwDWaFx0otQvMPYeMD3f`). Next.js 16; `next.config.ts` sets `outputFileTracingRoot` to the monorepo root and `transpilePackages: ["@aurahire/shared","@aurahire/db"]`. **No `vercel.json`** — config via the Vercel dashboard. Production domain: **`aurahire.site`** (+ `aurahire-thesis.vercel.app` previews).
- **Backend (NestJS) → Digital Ocean Droplet via PM2.** The dedicated `aurahire-prod` droplet was **destroyed 2026-05-20**; the API is currently co-tenanted on a shared **iams-backend** droplet at **`167.71.217.44`** (source-mode via swc-node under PM2).
- **Redis + Mailpit → Docker** on the droplet (`deploy/docker-compose.prod.yml`), bound to `127.0.0.1`.
- **Reverse proxy / HTTPS:** the shared droplet's **iams-nginx** (owns 80/443) using `deploy/nginx.aurahire.conf`. `deploy/Caddyfile` is retained only as reference for a future dedicated droplet.

**`deploy/` file-by-file:**
- **`provision.sh`** — one-shot Ubuntu 24.04 provisioning (deploy user, SSH hardening, UFW 22/80/443, fail2ban, Docker, Node 20 + pnpm, PM2, Caddy).
- **`deploy.sh`** — run as `deploy` from `/home/deploy/aurahire`: `git pull` → `pnpm install --frozen-lockfile` → `pnpm --filter @aurahire/api type-check` → **validate `apps/api/.env`** (asserts `NODE_ENV=production`, `USE_RESEND=true`, `APP_URL=https://aurahire.site`, `ALLOWED_ORIGINS` includes `https://aurahire.site`, `FROM_EMAIL` ends `@aurahire.site`, non-placeholder secrets) → `pm2 reload aurahire-api --update-env` → reload proxy. **These assertions hard-code the old domain/email — now stale.**
- **`ecosystem.config.cjs`** — PM2 app `aurahire-api`, runs `src/main.ts` via swc-node (fork mode, `max_memory_restart 1G`, `PORT=3333`).
- **`docker-compose.prod.yml`** (project `aurahire-prod`) — Redis (`127.0.0.1:6379`, `--requirepass`, `maxmemory 512mb`/**`noeviction`** so BullMQ jobs aren't dropped) + Mailpit (`127.0.0.1:1025`/`8025`, SSH-tunnel only).
- **`Caddyfile`** — reference reverse-proxy (auto Let's Encrypt, `/socket.io/*` passthrough, 60s REST timeouts). **Not active.**
- **`nginx.aurahire.conf`** — the live prod config (appended into iams-nginx): 80→443, TLS for `167-71-217-44.sslip.io`, `client_max_body_size 10M`, `/socket.io/` upgrade proxy (3600s), REST proxy with `limit_req` → upstream `http://172.18.0.1:3333`.
- **`env.api.production.example`** — prod `.env` template: `HOST=172.18.0.1` (docker-bridge gateway), `ALLOWED_ORIGINS=https://aurahire.site,…vercel.app`, `APP_URL=https://aurahire.site`, `USE_RESEND=true`, `FROM_EMAIL=hello@aurahire.site`, `REDIS_URL=redis://default:<pw>@127.0.0.1:6379`, `DATABASE_URL` → Supabase.
- **`deploy/.env.example`** — only `REDIS_PASSWORD`.

**CORS / origin model:** backend Fastify CORS reads `ALLOWED_ORIGINS` (prod must include `https://aurahire.site`). Frontend reaches backend via `NEXT_PUBLIC_API_URL`.

## CI (`.github/workflows/ci.yml`)
- **Triggers:** `pull_request` → `main`; `push` → `main` and `dev`. Concurrency cancels in-flight per ref.
- **Single `validate` job** (ubuntu-latest, 15-min, Node 20 + pnpm 9.12.3): checkout → `pnpm install --frozen-lockfile` → `pnpm format:check` → `pnpm type-check` → `pnpm lint` (**`continue-on-error: true`** — ESLint v9 not blocking) → `pnpm --filter @aurahire/api test` (Jest) → `pnpm --filter @aurahire/web test` (Vitest).
- **No build step, no deploy workflow.** The header references a deploy workflow gating on `needs: validate`, but no such file exists — deploys are manual via `deploy/deploy.sh`. Playwright E2E is not in CI.

## Migration context (critical) — target serverless topology

The DO droplet is **expiring/down**; the PM2-on-droplet + Docker-Redis/Mailpit + nginx/Caddy topology is being **retired** for **fully serverless**:

| Concern | From (current) | To (target) |
|---|---|---|
| API runtime | NestJS under PM2 on DO droplet | **Vercel Fluid Compute** running NestJS |
| Redis (cache/BullMQ/throttle/ws-adapter) | Docker `redis:7-alpine` on droplet | **Upstash Redis** |
| Database | Supabase Postgres | **Neon Postgres** (PG18, AWS Singapore) |
| Auth | Supabase Auth (account lost) | **TBD** (re-platform) |
| Cron (`@nestjs/schedule`) | in-process on always-on droplet | **Vercel Cron** / external scheduler |
| Realtime (socket.io) | gateway on droplet | **TBD** (stateless serverless can't hold WS) |
| Email | Resend | **Resend** (unchanged) |
| Domain | `aurahire.site` | **`aurahire.cjjutba.com`** |
| Reverse proxy / TLS | iams-nginx / Caddy | **Vercel-managed** (proxy removed) |

**What the migration must touch:**
- **`deploy/` becomes obsolete** — `provision.sh`, `deploy.sh`, `ecosystem.config.cjs`, `docker-compose.prod.yml`, `Caddyfile`, `nginx.aurahire.conf`, `env.api.production.example`, `deploy/.env.example`. PM2, the droplet, iams-nginx, sslip.io host, and `HOST=172.18.0.1` all disappear.
- **New Vercel build config for the API.** `apps/api/Dockerfile` (multi-stage, bundles **LibreOffice** for DOCX→PDF) was built for the droplet — serverless needs a `vercel.json`/build config, and the **`soffice`-dependent DOCX→PDF path** (`storage/docx-to-pdf.service.ts`) must be reworked (no system binary on Vercel Functions). NestJS adapted to a Vercel Function handler.
- **Env changes (prod `apps/api/.env`):** `DATABASE_URL` → Neon (keep `prepare:false`); `REDIS_URL` → Upstash (`rediss://`), drop `REDIS_PASSWORD`/`deploy/.env`; remove `HOST` + `SMTP_*`; keep `USE_RESEND=true` + `RESEND_API_KEY` + `FROM_EMAIL`; `APP_URL` + `ALLOWED_ORIGINS` → `https://aurahire.cjjutba.com`. Decide whether `SUPABASE_*` (auth) stays.
- **Frontend:** `NEXT_PUBLIC_API_URL` → new API host; `NEXT_PUBLIC_APP_URL` → `https://aurahire.cjjutba.com`; update `NEXT_PUBLIC_SUPABASE_*` if auth changes; set the custom domain on the Vercel project.
- **Cron:** move `@nestjs/schedule` jobs to HTTP-triggered Vercel Cron endpoints (minute-resolution interview crons are the trickiest).
- **CI:** revisit `ci.yml` push triggers + the missing deploy workflow; deploys move to Vercel's Git integration.
