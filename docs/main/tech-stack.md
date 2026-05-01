# AuraHire Tech Stack

**Version:** 2.0.0 (Split Architecture)
**Last Updated:** May 1, 2026
**Status:** Locked for Sprint

This document is the single source of truth for every dependency in AuraHire. Versions target compatibility with Next.js 16 + React 19 (frontend) and NestJS 10 + Node 20 (backend).

> **Note from `AGENTS.md`:** This is **Next.js 16**, not the Next.js you may know from training data. Before writing any code in `apps/web/`, consult the bundled docs at `apps/web/node_modules/next/dist/docs/`. Heed deprecation notices.

---

## Stack at a Glance

| Layer | Technology |
|---|---|
| **Monorepo** | Turborepo + pnpm workspaces |
| **Frontend framework** | Next.js 16 App Router |
| **Frontend UI** | React 19 + shadcn/ui + Tailwind CSS v4 |
| **Frontend forms** | React Hook Form + Zod |
| **Frontend server state** | TanStack Query |
| **Frontend → Backend client** | OpenAPI auto-generated TS client (orval / openapi-typescript-codegen) |
| **Backend framework** | NestJS 10 (with Fastify adapter) |
| **Backend ORM** | Drizzle ORM |
| **Backend validation** | nestjs-zod (shared Zod schemas) |
| **Backend auth** | Supabase JWT validation guard |
| **Backend queue** | BullMQ via `@nestjs/bullmq` |
| **Backend cron** | `@nestjs/schedule` |
| **Backend cache** | `@nestjs/cache-manager` (Redis store) |
| **Backend rate limit** | `@nestjs/throttler` (Redis store) |
| **Backend logging** | Pino (`nestjs-pino`) |
| **Backend API docs** | `@nestjs/swagger` |
| **Database** | Supabase Postgres |
| **Auth** | Supabase Auth (frontend SDK) |
| **Object Storage** | Supabase Storage |
| **Cache + Queue store** | Upstash Redis (or Railway Redis addon) |
| **Email — dev** | Mailpit (SMTP catcher) + Nodemailer |
| **Email — prod** | Resend |
| **Email templates** | React Email (rendered to HTML, sent via either transport) |
| **AI** | OpenAI API (`gpt-4o-mini`) |
| **File parsing** | pdf-parse (PDF), mammoth (DOCX) |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **Rich text editor** | Tiptap |
| **Dates** | date-fns |
| **Hosting — frontend** | Vercel |
| **Hosting — backend** | Railway |

---

## Monorepo & Tooling

### pnpm 9.x
- **Role:** Package manager + workspaces.
- **Why:** Faster than npm, content-addressed store saves disk, native workspaces support, industry default for Turborepo.
- **Install:** `npm install -g pnpm@9` (one-time, by the human).

### Turborepo 2.x
- **Role:** Monorepo build orchestrator.
- **Why:** Dependency-aware task graph, incremental caching, parallel execution, official Vercel integration.
- **Config:** `turbo.json` at repo root; per-app `package.json` defines `dev`, `build`, `lint`, `type-check`.
- **Concurrent dev:** `pnpm dev` at root → `turbo dev` runs `apps/web` and `apps/api` in parallel.

### concurrently (alternative consideration)
Skipped — Turborepo handles parallel scripts natively with better caching and dependency graphing.

---

## Frontend (`apps/web`)

### Next.js 16.2.4
- **Role:** Frontend framework — App Router for routes, Server Components for SSR, Server Actions for low-latency form submissions to backend, Route Handlers (none in our case — backend lives in `apps/api`).
- **Why:** Already installed; modern routing; React Server Components reduce bundle size.
- **Important:** Frontend has **no direct database access** in this architecture. All data fetching goes through the backend via the auto-generated REST client.

### React 19.2.4
- **Role:** UI library, server + client components.
- **Why:** Latest stable; Server Components GA, `useFormStatus`, `useActionState` simplify form UX.

### TypeScript 5+
- **Strict mode**, no `any`, `noUncheckedIndexedAccess`.

### Tailwind CSS v4
- **Role:** Utility-first styling with `@theme` tokens defined in `apps/web/app/globals.css`.

### shadcn/ui
- **Role:** Accessible component primitives copied into `apps/web/components/ui/`.
- **Components:** button, input, textarea, select, checkbox, radio-group, label, form, dialog, sheet, popover, tooltip, dropdown-menu, tabs, card, table, badge, separator, skeleton, avatar, progress, slider, sonner.

### React Hook Form ^7
+ **`@hookform/resolvers`** — Zod resolver glue.

### Zod ^3.23
- **Role:** Schema validation. Schemas live in `packages/shared/`.

### TanStack Query v5
- **Role:** Server-state caching for backend API calls. Wraps the auto-generated REST client.

### Auto-generated API client
Two options, pick one:
- **`orval`** — generates TanStack Query hooks from OpenAPI spec. Most ergonomic.
- **`openapi-typescript-codegen`** — simpler, generates a typed fetch client; we wrap with TanStack Query manually.

Recommendation: **orval** for sprint speed. Generated to `packages/shared/api-client/`.

### Tiptap ^2.x
- **Role:** Rich text editor for job descriptions.

### Recharts ^2.13
- **Role:** Charts.

### Lucide React
- **Role:** Icons.

### `@supabase/ssr` ^0.5
- **Role:** Supabase client integration with Next.js cookies for auth.
- **Auth flow:** frontend handles login/register/reset via Supabase SDK; JWT auto-attached to backend requests.

### Inter & JetBrains Mono fonts
- Loaded via `next/font/google`.

---

## Backend (`apps/api`)

### NestJS 10.x
- **Role:** Backend framework.
- **Why:** Decorator-based modular architecture matches our 10 features cleanly; first-party plugins for queue, cron, cache, throttle, swagger; Dependency Injection; testable.
- **Adapter:** Fastify (`@nestjs/platform-fastify`) for performance — same NestJS DX with 2× faster baseline req/s than Express.

### `@nestjs/swagger` ^7
- **Role:** Auto-generates OpenAPI 3 spec from controller decorators; serves Swagger UI at `/api/docs`.
- **Output:** spec also written to `packages/shared/openapi.json` for client codegen.

### `@nestjs/bullmq`
- **Role:** Queue management (background jobs).
- **Backed by:** Redis.
- **Use cases:** batch re-score applications when admin changes weights, weekly digest email generation.

### BullMQ
- **Role:** The actual queue library wrapped by `@nestjs/bullmq`.

### `@nestjs/schedule`
- **Role:** Cron jobs via `@Cron('0 * * * *')` decorators.
- **Use cases:** auto-archive jobs past deadline, expire offers past `expires_at`, cleanup unverified accounts.

### `@nestjs/cache-manager` + `cache-manager` + `cache-manager-redis-yet`
- **Role:** HTTP-level + service-level caching backed by Redis.
- **Use cases:** admin analytics aggregations (5-min TTL), public job listings (1-min TTL), Swagger UI assets.

### `@nestjs/throttler`
- **Role:** Rate limiting at controller level.
- **Backed by:** Redis storage (so limits persist across restarts and instances).
- **Use cases:** auth endpoints (5/60s), score recompute (1/60s per user), resume upload (5/hour per user).

### `nestjs-zod` ^3
- **Role:** Bridge between Zod schemas (in `packages/shared/`) and NestJS DTOs.
- **Why:** Single source of truth — same Zod schema validates frontend forms AND backend request bodies.

### Drizzle ORM ^0.36
- **Role:** Type-safe SQL builder for Postgres.
- **Schema:** lives in `packages/db/` so types can be exported for any cross-app needs (e.g., `JobStatus` enum). Backend imports queries; frontend imports types only (rare — most types come through Zod schemas).

### `postgres` ^3.4
- **Role:** Postgres driver used by Drizzle.

### `@supabase/supabase-js` ^2.45 (server-side)
- **Role:** Supabase service-role client for storage operations and admin queries.
- **Used in:** backend file upload endpoints, admin user management.

### `jose` ^5
- **Role:** JWT verification library for `SupabaseAuthGuard`.
- **Why:** Lightweight, modern, supports JWKs out of the box.

### `nestjs-pino` + Pino
- **Role:** Structured logging.
- **Why:** Fast, JSON-formatted, production-ready, integrates with Vercel/Railway log streams.

### `helmet`
- **Role:** Security HTTP headers.

### `@nestjs/config`
- **Role:** Typed environment variable management.

### OpenAI SDK ^4
- **Role:** AI client for parsing, scoring, bias detection.
- **Models:** `gpt-4o-mini` default. Structured outputs via `response_format: { type: "json_schema" }`.

### `pdf-parse` ^1.1, `mammoth` ^1.8
- **Role:** Resume text extraction from PDF and DOCX.

### `nodemailer` ^6
- **Role:** SMTP transport for Mailpit in dev.

### `resend` ^4
- **Role:** Resend SDK for production email.

### `react-email` ^3 (`@react-email/components`)
- **Role:** JSX email templates rendered to HTML; sent via Nodemailer (dev) or Resend (prod).

### `class-validator` + `class-transformer`
- Used minimally — most validation goes through `nestjs-zod`. Kept in dependency tree because some NestJS internals use them.

---

## Shared (`packages/shared`)

- **Zod schemas** — auth, onboarding, jobs, applications, interviews, offers, AI configs
- **Enums** — `UserRole`, `ApplicationStatus`, `JobStatus`, `ScoreBand`, `BiasCategory`, etc.
- **Constants** — `STRONG_MATCH_THRESHOLD`, `MAX_RESUME_SIZE_BYTES`, etc.
- **Auto-generated API client** (built from OpenAPI spec) — TanStack Query hooks
- **Common types** — `AuthUser`, `Pagination`, `ApiError`

Built once, imported by both apps. No runtime code beyond schemas + utility types.

---

## Database / Schema (`packages/db`)

- **Drizzle schema definitions** — all 15 tables (see `database-schema.md`)
- **RLS policies** — applied via Supabase SQL (deployed by human, not by Drizzle)
- **Type exports** — `typeof <table>.$inferSelect` types for both apps

Backend imports query helpers AND types. Frontend imports types only (where shared types haven't been factored into Zod schemas already).

---

## External Services

### Supabase (Free Tier)
- **Postgres** — primary DB (500MB free)
- **Auth** — email/password authentication, password reset, email verification, JWT issuance
- **Storage** — resume PDFs, avatars, company logos (1GB free)

### Redis
- **Cache** for `@nestjs/cache-manager`
- **Queue store** for BullMQ
- **Rate limit store** for `@nestjs/throttler`
- **Local dev:** Redis 7-alpine container managed via `docker-compose.dev.yml` (`localhost:6379`, persistent volume, 256MB LRU eviction). The human starts/stops via `docker compose`.
- **Production:** Railway Redis addon — same network as `apps/api`, zero latency, auto-injected `REDIS_URL`.
- **Alternative for prod:** Upstash Redis if backend moves off Railway. Free tier ~10K commands/day.

### OpenAI
- **Model:** `gpt-4o-mini`
- **Cost:** ~$5 budget covers entire sprint demo

### Resend (production email)
- **Free tier:** 100/day, 3000/month, single domain
- **Sender:** `onboarding@resend.dev` (no domain verification required for sprint)

### Mailpit (local dev email)
- **Role:** Captures all SMTP emails sent in dev, displays in web UI.
- **Run:** managed via `docker-compose.dev.yml` at repo root (`docker compose -f docker-compose.dev.yml up -d`). The human starts/stops; Claude does not.
- **Web UI:** http://localhost:8025
- **SMTP:** localhost:1025
- **Persistence:** named volume `mailpit-data` survives container restarts.

---

## Hosting & Deployment

### Vercel (Frontend)
- **Hobby tier** — sufficient for thesis demo
- **Auto-deploy** from `main` branch
- **Preview URLs** per commit
- **Env vars** managed in Vercel dashboard

### Railway (Backend + Redis)
- **Hobby tier** ($5 trial then pay-as-you-go; very low cost at thesis scale)
- **Auto-deploy** from `main` branch
- **Postgres addon** — not used (we use Supabase)
- **Redis addon** — used for BullMQ + cache + rate limit
- **Health checks** on `/api/health`

### Supabase Cloud
- DB, Auth, Storage all managed by Supabase. No self-hosting.

---

## Dev Tools

### ESLint ^9
- **Configs:** `eslint-config-next` for `apps/web`; standard NestJS rules for `apps/api`; root-level shared config in `packages/eslint-config`.

### Prettier ^3
- **Plugin:** `prettier-plugin-tailwindcss` for class sorting.

### Drizzle Kit ^0.27
- **Commands:** `drizzle-kit generate`, `drizzle-kit push`, `drizzle-kit studio`.
- **Run from:** `packages/db` (where the schema lives).
- **Run by:** the human only — Claude does not run migrations.

### TypeScript-only — no test framework in sprint
- Phase 2 introduces Vitest (unit) + Playwright (E2E).
- Manual QA covers the sprint per the test plan in `sprint-plan.md`.

---

## Concurrent Dev Setup

Root `package.json`:
```json
{
  "name": "aurahire",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "type-check": "turbo type-check",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "prettier": "^3.0.0",
    "prettier-plugin-tailwindcss": "^0.6.0"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": { "cache": false, "persistent": true },
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "lint": {},
    "type-check": {}
  }
}
```

`apps/web/package.json` includes:
```json
{ "scripts": { "dev": "next dev --turbo --port 3000" } }
```

`apps/api/package.json` includes:
```json
{ "scripts": { "dev": "nest start --watch --debug --preserveWatchOutput" } }
```

NestJS app starts on port 3333 by default (configurable via `PORT` env var).

**Run from repo root:** `pnpm dev` → both servers start in one terminal.

---

## Quick Install Reference (Day 1)

```bash
# At repo root, after cloning + pnpm 9 installed
pnpm install

# Workspace-level shared dev deps
pnpm add -D -w turbo prettier prettier-plugin-tailwindcss

# Frontend (apps/web)
cd apps/web
pnpm add zod react-hook-form @hookform/resolvers
pnpm add @supabase/supabase-js @supabase/ssr
pnpm add @tanstack/react-query
pnpm add recharts lucide-react
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-placeholder
pnpm add date-fns clsx tailwind-merge nanoid
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input textarea select checkbox radio-group label form dialog sheet popover tooltip dropdown-menu tabs card table badge separator skeleton avatar progress slider sonner

# Backend (apps/api)
cd ../api
pnpm add @nestjs/common @nestjs/core @nestjs/platform-fastify
pnpm add @nestjs/config @nestjs/swagger @nestjs/throttler
pnpm add @nestjs/bullmq bullmq @nestjs/schedule
pnpm add @nestjs/cache-manager cache-manager cache-manager-redis-yet ioredis
pnpm add nestjs-zod zod
pnpm add @supabase/supabase-js jose
pnpm add nestjs-pino pino-http pino-pretty
pnpm add helmet
pnpm add openai
pnpm add resend nodemailer
pnpm add react-email @react-email/components
pnpm add pdf-parse mammoth
pnpm add drizzle-orm postgres

pnpm add -D @nestjs/cli @nestjs/testing @nestjs/schematics
pnpm add -D drizzle-kit
pnpm add -D @types/nodemailer @types/pdf-parse

# Shared (packages/shared)
cd ../../packages/shared
pnpm add zod
pnpm add -D orval

# DB schema (packages/db)
cd ../db
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
```

(The human runs these commands; Claude proposes them.)

---

## Version Pinning

Pin **major versions** in `package.json` (`^16.2.4`, `^10.4.0`). After sprint completes, freeze to exact versions in lockfile — no auto-upgrade during thesis defense window.

---

## Known Gaps

- **No background AI scoring queue used during demo** — match scores compute inline (better demo UX). Queue exists for batch re-score and weekly digests only.
- **No observability stack** (Sentry, Datadog) in sprint. Pino logs streamed to Vercel + Railway log views suffice.
- **No CI/CD beyond Vercel + Railway auto-deploy** in sprint. Phase 2 adds GitHub Actions.
- **No test framework** in sprint (Vitest + Playwright = Phase 2).
- **No Storybook** — component documentation lives in `ui-patterns.md`.
