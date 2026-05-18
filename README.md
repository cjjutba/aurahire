# AuraHire

> **Explainable and Fair AI-Powered Recruitment.**
> A transparent resume-scoring platform with built-in bias mitigation.

[![CI](https://github.com/cjjutba/aurahire-final/actions/workflows/ci.yml/badge.svg)](https://github.com/cjjutba/aurahire-final/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3FCF8E?logo=supabase)](https://supabase.com)
[![OpenAI](https://img.shields.io/badge/OpenAI-gpt--4o--mini-412991?logo=openai)](https://platform.openai.com)
[![pnpm](https://img.shields.io/badge/pnpm-9-F69220?logo=pnpm)](https://pnpm.io)
[![Turborepo](https://img.shields.io/badge/Turborepo-2-EF4444?logo=turborepo)](https://turbo.build)
[![License](https://img.shields.io/badge/license-Proprietary-blue.svg)](#license)

AuraHire is a full-stack AI recruitment platform built as a thesis system. Every AI decision shows its work — scores come with component breakdowns and evidence excerpts from the resume; job descriptions are scanned for biased language before publish; admins can audit any score and tune the algorithm in real time. The system is the artifact: **no faked AI, no opaque scoring, no demo theatre**.

---

## Table of Contents

- [Why AuraHire](#why-aurahire)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Repository Layout](#repository-layout)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Development Workflow](#development-workflow)
- [AI Engines](#ai-engines)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [Security Model](#security-model)
- [Roles & Capabilities](#roles--capabilities)
- [Page Inventory](#page-inventory)
- [Deployment](#deployment)
- [Testing](#testing)
- [Observability](#observability)
- [Project Documentation](#project-documentation)
- [Operational Runbook](#operational-runbook)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## Why AuraHire

Most AI recruitment tools score candidates inside a black box. AuraHire was built around two academically-defensible commitments:

1. **Explainable scoring.** Every score has a structured breakdown — components, weights, plain-language explanations, and verbatim evidence excerpts pulled from the candidate's resume. No naked numbers anywhere in the product.
2. **Active bias mitigation.** PII is redacted before any scoring AI sees a resume. Job descriptions are scanned for gendered, age-coded, ableist, and exclusionary language at edit time. Recruiter overrides require a written reason that lands in the audit log.

The thesis claim — **"Explainable and Fair AI-Powered Recruitment: A Transparent Resume Scoring Platform with Bias Mitigation"** — shapes every product decision in this codebase. If a feature can't be defended in front of an examiner, it isn't in the system.

---

## Key Features

### Candidate experience

- 6-step resume-first onboarding wizard (upload → AI parse → review prefilled fields → preferences → Profile Score reveal)
- AI resume parsing to structured JSON (contact, education, experience, skills, certifications) with confidence indicator
- **Profile Score** with component breakdown (Completeness · Skill Depth · Experience Clarity · Education Quality) and 2–3 actionable improvement suggestions
- Public + authenticated job browsing with **per-job match score chips**
- One-tap apply with synchronous **Match Score** computation and visible AI affordance
- Application pipeline tracking (Applied → Screening → Interview → Offer → Hired/Rejected)
- Interview list and in-portal offer Accept/Decline
- Multi-version resume manager with default-resume selection (triggers re-scoring)
- Notification preferences per category and GDPR-aligned data download / account deletion

### Recruiter experience

- 3-step onboarding (about you · company · hiring focus)
- Rich-text job description editor (Tiptap) with **inline bias-flag chips** that highlight problematic terms as you type
- Publish-gate: jobs with unresolved bias flags can only ship after an explicit override with a written reason
- Application pipeline per job, sortable by **Best Match** with full Score Breakdown + evidence callouts
- Interview scheduling (phone / video / in-person) with candidate notification email
- Offer letter generation with live preview, candidate accept/decline buttons
- Shortlist with bulk actions and CSV export
- Per-recruiter analytics (applications over time, funnel, top skills, score distribution)

### Admin experience (8 surfaces)

1. **Command Center** — system KPIs, AI processing health, recent audit events, bias-flag counts
2. **User Management** — full CRUD, suspend with reason, role change, GDPR delete with cascade
3. **Job Moderation** — review all jobs, archive, see complete bias-flag history per posting
4. **Application Oversight** — system-wide audit, drill into any AI score, view redacted resume snapshot used for scoring
5. **AI Scoring Configuration** — tune match + profile weights, set band thresholds, **Preview Impact** against last 100 applications before saving
6. **Audit Log** — immutable, filterable, CSV-exportable
7. **System Analytics** — user growth, applications by status, score distribution, top skills
8. **Bias & Fairness Monitor** — flag counts by category, top flagged terms, override rate, recent override decisions with reasons

### AI surfaces (all backend-only, all structured)

| Surface | Inputs | Output | Trigger |
| --- | --- | --- | --- |
| Resume parsing | PDF / DOCX | Structured resume JSON (Zod-validated) | Onboarding step 1, every new upload |
| PII redaction | Parsed resume | Redacted copy + `redacted_fields` audit list | Before any scoring call |
| Profile Score | Redacted resume + preferences | Component breakdown + evidence + improvement suggestions | End of onboarding, on resume/preferences change |
| Match Score | Redacted resume + job posting | Component breakdown + evidence + red/green flags | At application time, on demand |
| Bias detection | Job description text | Flagged terms by category with severity + suggestion | On blur + on publish |
| Fairness aggregates | DB aggregations | Counts, distributions, top terms (SQL only — no LLM) | Admin Bias Monitor |

Every score row records `prompt_version`, `model_used`, `latency_ms`, `redacted_fields`, and the full `raw_output` JSON. Thesis examiners can reproduce any decision from the audit trail.

---

## Architecture

AuraHire is a **Turborepo monorepo** with a deliberately split frontend and backend. The frontend is a UI layer; the backend owns all business logic, data, AI, queue, cron, secrets, and email.

```
                    ┌────────────────────────────────────┐
                    │        User (Browser)              │
                    │ React Server / Client Components   │
                    └────────────┬───────────────────────┘
                                 │ HTTPS
        ┌────────────────────────▼─────────────────────────┐
        │   Frontend — Next.js 16 (Vercel)                 │
        │   apps/web                                       │
        │   - App Router, Server Components by default     │
        │   - Supabase Auth (browser + SSR cookies)        │
        │   - RHF + Zod forms                              │
        │   - TanStack Query + auto-generated API client   │
        │   - NO DB. NO AI keys. NO storage SDK.           │
        └────────────────────────┬─────────────────────────┘
                                 │ HTTPS · Bearer <Supabase JWT>
                                 │
        ┌────────────────────────▼─────────────────────────┐
        │   Backend — NestJS (Digital Ocean Droplet, PM2)  │
        │   apps/api                                       │
        │   - Fastify adapter; Swagger at /api/docs        │
        │   - SupabaseAuthGuard + RolesGuard               │
        │   - 18 feature modules + AI + queue + cron       │
        │   - Drizzle ORM, nestjs-zod, Pino, Helmet        │
        │   - BullMQ, @nestjs/schedule, cache-manager      │
        │   - OpenAI SDK (server-only)                     │
        └──┬─────────┬──────────┬──────────┬──────────┬────┘
           │         │          │          │          │
   ┌───────▼──┐ ┌────▼────┐ ┌──▼─────┐ ┌──▼──────┐ ┌─▼────────┐
   │ Supabase │ │  Redis  │ │ OpenAI │ │ Mailpit │ │ Supabase │
   │ Postgres │ │ (Docker │ │  API   │ │  (dev)  │ │ Storage  │
   │  + RLS   │ │ on host)│ │        │ │ Resend  │ │ resumes/ │
   │          │ │ cache · │ │        │ │ (prod)  │ │ avatars/ │
   │          │ │ queue · │ │        │ │         │ │ logos/   │
   │          │ │ throttle│ │        │ │         │ │          │
   └──────────┘ └─────────┘ └────────┘ └─────────┘ └──────────┘
```

### Defense in depth (five layers)

1. **Frontend middleware** — redirects unauthenticated/wrong-role users at the URL boundary
2. **Backend CORS + Helmet** — `ALLOWED_ORIGINS` whitelist, hardened HTTP headers
3. **`SupabaseAuthGuard`** — validates JWT signature, expiry, and JWKs on every protected request
4. **`RolesGuard` + ownership checks** — RBAC at the controller, per-resource ownership in services
5. **Postgres RLS** — every table enforces `auth.uid()` and role rules; service-role client only on the server

Even if layers 1–4 are bypassed (a frontend bug, a misconfigured CORS, a malformed guard), the database itself refuses unauthorized reads and writes.

---

## Technology Stack

### Monorepo & build

| Tool | Role |
| --- | --- |
| **pnpm 9** | Package manager with workspaces |
| **Turborepo 2** | Task graph + incremental cache for `dev`, `build`, `lint`, `type-check` |
| **TypeScript 5.7 (strict)** | End-to-end type safety; `noUncheckedIndexedAccess`, no `any` |
| **Prettier 3 + Tailwind plugin** | Format-on-save, class sorting |

### Frontend (`apps/web`)

| Tool | Version | Role |
| --- | --- | --- |
| Next.js | **16.2** (App Router) | Routes, Server Components, streaming |
| React | 19.2 | UI runtime |
| Tailwind CSS | 4 | Utility-first styling with `@theme` tokens |
| shadcn/ui + Radix | Latest | Accessible primitives extended with AuraHire patterns |
| React Hook Form | 7 | Form state |
| Zod | 3 (shared schemas) | Validation, type inference |
| TanStack Query | 5 | Server state, mutation hooks |
| Tiptap | 3 | Rich-text editor for job descriptions |
| Recharts | 3 | Analytics charts |
| Lucide React | 1 | Icon library |
| `@supabase/ssr` | 0.10 | Cookie-aware Supabase Auth client |
| Socket.io client | 4 | Real-time notifications |
| Vitest + Playwright | Latest | Unit + E2E testing |

### Backend (`apps/api`)

| Tool | Version | Role |
| --- | --- | --- |
| NestJS | **10** (Fastify adapter) | Decorator-based modular HTTP API |
| `@nestjs/swagger` | 8 | Auto-generated OpenAPI 3 spec + Swagger UI |
| `nestjs-zod` | 5 | Bridges shared Zod schemas to DTOs |
| Drizzle ORM | 0.36 | Type-safe Postgres queries |
| `postgres` | 3.4 | Pg driver |
| `@nestjs/bullmq` + BullMQ | 11 / 5 | Background jobs (Redis-backed) |
| `@nestjs/schedule` | 6 | Cron decorator (`@Cron`) for scheduled tasks |
| `@nestjs/cache-manager` | 3 | Redis-backed cache |
| `@nestjs/throttler` + Redis storage | 6 | Per-route rate limiting |
| `@nestjs/websockets` + Socket.io | 10 / 4 | Live notification stream |
| OpenAI SDK | 6 | `gpt-4o-mini` with structured outputs |
| `jose` | 6 | Supabase JWT verification with JWKs |
| `pdf-parse` + `mammoth` | 2 / 1 | Resume text extraction |
| React Email | 1 | JSX email templates |
| Nodemailer | 8 | SMTP transport for Mailpit (dev) |
| Resend | 6 | Production transactional email |
| `nestjs-pino` + Pino | 4 / 9 | Structured JSON logs |
| Helmet (Fastify) | 11 | Security headers |

### Database

| Component | Role |
| --- | --- |
| **Supabase Postgres** | Primary data store with Row-Level Security |
| **Supabase Auth** | Email/password + JWT issuance + verification flow |
| **Supabase Storage** | Resumes (private + signed URLs), avatars, company logos |
| **Drizzle schema** (`packages/db`) | 15 tables across Identity / Recruitment / Candidate Data / AI / Audit |
| **RLS policies** (`packages/db/src/rls`) | Hand-written SQL applied via Supabase Dashboard |

### Infrastructure & hosting

| Service | Purpose |
| --- | --- |
| **Vercel** | Frontend hosting, auto-deploy from `main`, preview URLs per commit |
| **Digital Ocean Droplet** (Ubuntu 24.04, 2 vCPU / 2 GB) | Backend host |
| **PM2** | Node process supervisor with auto-restart and rotating log files |
| **Caddy** | Reverse proxy with auto-renewing Let's Encrypt TLS |
| **Docker Compose** | Redis + Mailpit containers on the same host (localhost-bound only) |
| **UFW** + **fail2ban** | Firewall (22/80/443 only) + SSH brute-force protection |
| **GitHub Actions** | CI: format, type-check, lint, test on every PR + push to `main` |

The deployment is intentionally **explicit and inspectable** — no PaaS magic. Every moving part (Node, PM2, Docker, Caddy, UFW) is editable and visible. Redis and Mailpit bind to `127.0.0.1` only; Caddy is the only thing reachable from the public internet.

---

## Repository Layout

```
aurahire/
├── apps/
│   ├── web/                       # Next.js 16 frontend → Vercel
│   │   ├── app/                   # App Router (public, auth, candidate, recruiter, admin, legal, onboarding)
│   │   ├── components/            # shadcn primitives + feature components (jobs, score, bias, ai, interview, ...)
│   │   ├── contexts/              # React contexts (active company, etc.)
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── lib/                   # Auth, query, realtime, utils, toast
│   │   ├── e2e/                   # Playwright tests
│   │   ├── middleware.ts          # Edge auth + RBAC redirects
│   │   ├── next.config.ts
│   │   ├── postcss.config.mjs
│   │   ├── playwright.config.ts
│   │   └── vitest.config.ts
│   └── api/                       # NestJS backend → DO Droplet (PM2)
│       ├── src/
│       │   ├── main.ts            # Fastify bootstrap, Swagger, global pipes
│       │   ├── app.module.ts
│       │   ├── modules/           # admin, applications, auth, bias, candidate-profiles,
│       │   │                      # companies, feedback, interviews, interview-venues,
│       │   │                      # invitations, jobs, notifications, notification-preferences,
│       │   │                      # offers, profiles, recruiter-profiles, resumes, scoring
│       │   ├── common/            # Guards, decorators, interceptors, pipes, filters
│       │   ├── ai/                # OpenAI client, parse / score / bias / redact services,
│       │   │                      # versioned prompts, structured-output JSON schemas
│       │   ├── queue/             # BullMQ processors
│       │   ├── cron/              # @nestjs/schedule jobs
│       │   ├── cache/             # cache-manager wiring
│       │   ├── email/             # Mailpit / Resend transport switching + React Email templates
│       │   ├── storage/           # Supabase Storage helpers + signed URLs
│       │   ├── audit/             # AuditService
│       │   ├── realtime/          # Socket.io gateway
│       │   ├── db/                # Drizzle client provider (DI)
│       │   ├── config/            # Zod-validated env schema
│       │   └── health/            # GET /api/health probed by Caddy + PM2
│       ├── scripts/               # OpenAPI generation, db reset/seed, AI corpus tests
│       └── Dockerfile
├── packages/
│   ├── shared/                    # Zod schemas, enums, constants, auto-generated API client
│   │   ├── src/
│   │   │   ├── schemas/           # auth, jobs, applications, score, bias, ai-config, ...
│   │   │   ├── enums/
│   │   │   ├── constants/
│   │   │   ├── api-client/        # Generated by orval from openapi.json
│   │   │   ├── realtime/          # WS event types
│   │   │   ├── onboarding/        # Step shapes shared across both apps
│   │   │   └── types/             # AuthUser, ApiError, Pagination
│   │   ├── openapi.json           # Source of truth for client codegen
│   │   └── orval.config.ts
│   └── db/                        # Drizzle schema + RLS SQL
│       ├── src/
│       │   ├── schema.ts          # All 15 table definitions
│       │   ├── relations.ts
│       │   ├── enums.ts
│       │   ├── rls/               # One SQL file per table + all-policies.sql
│       │   └── index.ts
│       ├── drizzle/               # Generated migrations
│       └── drizzle.config.ts
├── deploy/                        # Production droplet artefacts
│   ├── docker-compose.prod.yml    # Redis + Mailpit (127.0.0.1-only)
│   ├── Caddyfile                  # TLS termination + reverse proxy + WS support
│   ├── ecosystem.config.cjs       # PM2 process config
│   ├── deploy.sh                  # Pull, validate env, build, pm2 reload
│   ├── provision.sh               # One-shot droplet provisioning (UFW, fail2ban, Docker, Node, PM2, Caddy)
│   └── env.api.production.example
├── docs/
│   └── main/                      # Living spec — read these before changing code
│       ├── prd.md
│       ├── architecture.md
│       ├── tech-stack.md
│       ├── project-structure.md
│       ├── database-schema.md
│       ├── ai-design.md
│       ├── technical-specifications.md
│       ├── best-practices.md
│       ├── design-system.md
│       ├── ui-patterns.md
│       ├── page-inventory.md
│       ├── sprint-plan.md
│       ├── caching-strategy.md
│       └── env-setup.md
├── .github/workflows/             # CI: format · type-check · lint · test
│   └── ci.yml
├── docker-compose.dev.yml         # Local Mailpit + Redis
├── .env.example                   # Combined web + api env template
├── AGENTS.md                      # Agent rules (Next.js 16 warning, monorepo discipline)
├── CLAUDE.md                      # Claude Code project instructions
├── DESIGN.md                      # Brand design summary (tokens, components, do's/don'ts)
├── README.md                      # This file
├── package.json                   # Root workspace + scripts
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── turbo.json
└── tsconfig.base.json
```

---

## Getting Started

### Prerequisites

- **macOS, Linux, or WSL2 on Windows**
- **Node.js 20.x LTS** — `node --version` must report 20+
- **pnpm 9+** — `npm install -g pnpm@9`
- **Docker Desktop** — must be running (Mailpit + Redis run as containers)
- **Git**
- A modern browser
- Service accounts (all free tier sufficient for local dev):
  - **Supabase** — Postgres + Auth + Storage
  - **Resend** — production email (Mailpit covers dev)
  - **OpenAI** — add $10–20 in billing credit for development

### One-time setup

```bash
# 1. Clone the repo
git clone https://github.com/cjjutba/aurahire-final.git
cd aurahire-final

# 2. Install workspace dependencies
pnpm install

# 3. Bring up local services (Mailpit + Redis)
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps   # both healthy

# 4. Copy the env template
cp .env.example apps/web/.env.local
cp .env.example apps/api/.env

# 5. Fill in real values in both env files (see "Environment Variables")

# 6. Push the Drizzle schema + RLS policies to Supabase (one-time)
pnpm --filter @aurahire/db drizzle-kit push
# Then paste packages/db/src/rls/all-policies.sql into Supabase → SQL Editor → Run

# 7. Seed the default scoring config + create an admin user
pnpm --filter @aurahire/api seed-db
```

### Daily development

```bash
# Start everything (frontend + backend) from the repo root
pnpm dev
```

Turbo runs both apps in parallel with interleaved logs:

```
apps/web:dev: ▲ Next.js 16.2.4
apps/web:dev:   - Local:        http://localhost:3000
apps/api:dev: [Nest] LOG [NestApplication] Nest application successfully started
apps/api:dev:   - Local:        http://localhost:3333
apps/api:dev:   - Swagger:      http://localhost:3333/api/docs
```

Open in browser:

- **Frontend:** http://localhost:3000
- **Backend Swagger UI:** http://localhost:3333/api/docs
- **Mailpit inbox:** http://localhost:8025

Smoke test path: register a candidate → check Mailpit for the verification email → click the link → onboarding wizard → upload a real resume → review prefilled steps → see Profile Score with evidence.

---

## Environment Variables

Two env files are required. Never commit either.

### `apps/web/.env.local` (frontend)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
NEXT_PUBLIC_API_URL=http://localhost:3333
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

Only `NEXT_PUBLIC_*` vars are bundled into the client. The Supabase anon key is safe to ship; the service-role key never appears here.

### `apps/api/.env` (backend)

```bash
NODE_ENV=development
PORT=3333

# Database — Supabase pooler, port 6543 for transaction mode
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres

# Supabase (JWT validation + storage)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...

# Redis (BullMQ + cache + throttle)
REDIS_URL=redis://localhost:6379

# OpenAI
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini

# Email — Mailpit (dev) vs Resend (prod)
SMTP_HOST=localhost
SMTP_PORT=1025
RESEND_API_KEY=re_...
FROM_EMAIL=onboarding@resend.dev

# Public web URL — used in email links
APP_URL=http://localhost:3000

# CORS
ALLOWED_ORIGINS=http://localhost:3000

# Logging
LOG_LEVEL=info
```

In production, `NODE_ENV=production` flips the email transport to Resend and the backend reads from `deploy/.env` on the Droplet (`chmod 600`, owned by the `deploy` user, never committed). See `deploy/env.api.production.example`.

---

## Development Workflow

The repo enforces a strict discipline so the system stays defensible:

### Hard rules

- **The frontend has no DB access.** Period. All data flows through the NestJS REST API.
- **The frontend has no AI keys.** OpenAI is backend-only.
- **All input validation goes through Zod schemas in `packages/shared`.** Same schema validates the frontend form and the backend DTO.
- **All consequential mutations write to `audit_logs`.** Append-only; admin-readable.
- **All AI calls use OpenAI structured outputs.** Never parse free text from the model.
- **All resumes pass through PII redaction before scoring.** Always.
- **RLS policies are mandatory** for every user-data table.
- **Type safety is end-to-end.** Zero `any`. Zero `as` casts beyond inference rescue.

### Available scripts (run from repo root)

| Command | What it does |
| --- | --- |
| `pnpm dev` | Boots Docker services (predev) and runs both apps with hot reload |
| `pnpm build` | Builds frontend + backend via Turbo |
| `pnpm lint` | ESLint on both apps |
| `pnpm type-check` | `tsc --noEmit` across all packages |
| `pnpm format` | Prettier write across the repo |
| `pnpm format:check` | Prettier check (CI gate) |
| `pnpm dev:down` | Stop the Mailpit + Redis containers |
| `pnpm clean` | Remove `node_modules` and Turbo cache |

### Per-package scripts

```bash
# Frontend
pnpm --filter @aurahire/web build         # next build
pnpm --filter @aurahire/web test          # vitest run
pnpm --filter @aurahire/web e2e           # playwright test
pnpm --filter @aurahire/web e2e:ui        # Playwright UI mode

# Backend
pnpm --filter @aurahire/api build         # nest build
pnpm --filter @aurahire/api test          # jest
pnpm --filter @aurahire/api test:ai-parse # parse a curated corpus of resumes
pnpm --filter @aurahire/api generate:openapi   # regenerate packages/shared/openapi.json
pnpm --filter @aurahire/api seed-db
pnpm --filter @aurahire/api reset-db

# Shared types (regenerates the TS API client from openapi.json via orval)
pnpm --filter @aurahire/shared build

# Database
pnpm --filter @aurahire/db drizzle-kit push      # apply schema to Supabase
pnpm --filter @aurahire/db drizzle-kit studio    # inspect DB in browser
pnpm --filter @aurahire/db drizzle-kit generate  # produce a migration
```

### Feature loop (vertical slice discipline)

When adding a new feature, work in this order:

1. Add or update the Zod schema in `packages/shared/src/schemas/`
2. If new entity, add the Drizzle table in `packages/db/src/schema.ts` and the RLS policy under `packages/db/src/rls/`
3. Build the NestJS module under `apps/api/src/modules/<feature>/` (controller + service + repository + DTOs)
4. Add `AuditService` writes for every consequential mutation
5. Decorate controller methods for Swagger
6. Run `pnpm --filter @aurahire/api generate:openapi`
7. Run `pnpm --filter @aurahire/shared build` so orval regenerates TanStack Query hooks
8. Build the frontend page under `apps/web/app/...` with components in `apps/web/components/<feature>/`
9. Wire the form to the shared schema (RHF + zodResolver) and the generated mutation hook
10. Manually QA the end-to-end path; update the relevant doc in `docs/main/`

---

## AI Engines

All AI runs server-side in `apps/api/src/ai/`. The frontend never sees a model. Every call returns a Zod-validated JSON document, never free text.

### 1. Resume parsing

PDF (`pdf-parse`) or DOCX (`mammoth`) → plain text → OpenAI structured output:

```ts
parsedResumeSchema = z.object({
  contact: { full_name, email, phone, location_city, location_country, linkedin_url, portfolio_url },
  summary,
  education: [ { institution, degree, field_of_study, start_year, end_year, gpa } ],
  experience: [ { company, title, start_date, end_date, is_current, responsibilities, technologies_used } ],
  skills,
  certifications,
  languages,
  parse_confidence: "high" | "medium" | "low",
})
```

If parsing times out or returns `parse_confidence: "low"`, the wizard falls back to manual entry — never a wall.

### 2. PII redaction (hybrid)

A **rule-based** pass nulls out `contact.full_name`, `contact.email`, `contact.phone`, and social URLs. An **LLM-assisted** pass scans free-text fields (summary, responsibilities) for residual names, pronouns, age references, and gender markers. The `redacted_fields` array is persisted on every score row so admins can prove redaction happened.

### 3. Profile Score

| Component | Default Weight | Measures |
| --- | --- | --- |
| Completeness | 25 | Section coverage |
| Skill Depth | 30 | Modernity + relevance to desired role |
| Experience Clarity | 30 | Outcomes, technologies, duration clarity |
| Education Quality | 15 | Degree match + certifications |

Total 100. Every component returns `score`, `max`, `weight`, plain-language `explanation`, and 1–3 evidence excerpts with `relevance` (positive / negative / neutral). The engine also produces up to 3 improvement suggestions with estimated point impact.

### 4. Match Score

| Component | Default Weight | Measures |
| --- | --- | --- |
| Skills Match | 40 | Required-skill coverage + adjacent skills |
| Experience Match | 35 | Years + seniority + role alignment |
| Education Match | 15 | Degree level + field relevance |
| Cultural / Language Fit | 10 | Tone + soft-skill alignment |

Output includes the breakdown, a one-paragraph summary, and optional `red_flags` (gaps) and `green_flags` (standout strengths). Bands: **Strong** (≥70), **Partial** (40–69), **Limited** (<40). Each `match_scores` row stores `weights_used` so historical scores stay interpretable even after admins re-tune.

### 5. Bias detection

Scans job descriptions for **gendered**, **age-coded**, **ableist**, and **exclusionary** language plus admin-defined custom terms. Triggers on description blur (debounced), on Save Draft, and on Publish. Publishing with unresolved flags requires the recruiter to supply a written reason that lands in `bias_flags.override_reason` and `audit_logs`.

### 6. Aggregate fairness monitor

SQL-only — no LLM cost. Surfaces flag counts, top flagged terms, override rate, score distribution, and recent override decisions to admins. Documented thesis tradeoff: we deliberately don't collect demographic labels (it contradicts the redaction philosophy), so we surface aggregate distributions rather than disparate-impact statistical tests.

### Prompt versioning

Every prompt is stored as `PARSE_RESUME_PROMPT_V1` style constants with a paired `*_VERSION` literal. Each score row records the version used. The thesis appendix is reconstructed from this audit trail.

---

## Database Schema

15 tables across 6 functional groups, all with RLS enabled. Conventions: UUIDv4 PKs, `created_at` / `updated_at` on every row, JSONB for flexible structured data validated by Zod at write time, hard deletes only.

| Group | Tables |
| --- | --- |
| **Identity** | `profiles`, `candidate_profiles`, `recruiter_profiles`, `companies` |
| **Recruitment** | `jobs`, `applications`, `interviews`, `offers` |
| **Candidate Data** | `resumes` |
| **AI / Scoring** | `profile_scores`, `match_scores`, `evidence_excerpts`, `bias_flags`, `scoring_config` |
| **Audit** | `audit_logs` |

Highlights:

- `applications` is unique on `(candidate_id, job_id)` — one application per pair
- `match_scores` is unique on `application_id` — one score per application
- `audit_logs` is append-only — no UPDATE / DELETE RLS policy from any role
- `scoring_config` has a partial unique index on `is_active` — exactly one active row
- `bias_flags.status` evolves through `flagged → resolved | overridden`; overrides require `override_reason`

See [docs/main/database-schema.md](docs/main/database-schema.md) for full column definitions, indexes, and RLS policy SQL.

---

## API Documentation

The backend ships an **auto-generated OpenAPI 3 spec** via `@nestjs/swagger`. Swagger UI is served at:

- **Local:** http://localhost:3333/api/docs
- **Production:** `https://<your-api-host>/api/docs`

The same spec is written to `packages/shared/openapi.json` on every backend build and consumed by `orval` to regenerate the TanStack Query hooks under `packages/shared/api-client/`. Frontend mutations use those generated hooks directly:

```tsx
"use client";
import { useApplyToJob } from "@aurahire/shared";

export function ApplyButton({ jobId, resumeId }: Props) {
  const apply = useApplyToJob({
    onSuccess: (data) => router.push(`/candidate/applications/${data.id}`),
  });
  return (
    <Button disabled={apply.isPending} onClick={() => apply.mutate({ jobId, resumeId })}>
      {apply.isPending ? "Submitting..." : "Apply"}
    </Button>
  );
}
```

### Standard envelopes

```json
// Success
{ "data": { /* resource */ }, "meta": { "requestId": "uuid", "timestamp": "..." } }

// Paginated
{ "data": [ /* items */ ], "meta": { "page": 1, "limit": 25, "total": 142 } }

// Error
{
  "statusCode": 422,
  "code": "BIAS_FLAGS_REQUIRE_OVERRIDE",
  "message": "Resolve or override bias flags before publishing",
  "errors": [ /* details */ ],
  "timestamp": "...",
  "path": "/api/v1/jobs/.../publish",
  "requestId": "uuid"
}
```

### Common HTTP statuses

| Status | Meaning |
| --- | --- |
| 200 | OK (GET, PATCH, action) |
| 201 | Created |
| 204 | No Content (DELETE) |
| 400 | Zod validation failure |
| 401 | Missing / invalid JWT |
| 403 | Wrong role or no ownership |
| 404 | Not found |
| 409 | Conflict (e.g., duplicate application, job already closed) |
| 422 | Bias flags require override |
| 429 | Rate limited |
| 503 | AI service down (graceful "Score temporarily unavailable") |

Full per-feature specs in [docs/main/technical-specifications.md](docs/main/technical-specifications.md).

---

## Security Model

### Authentication

- **Frontend** signs users in with `@supabase/ssr` (HTTP-only cookies, automatic refresh)
- **Backend** receives `Authorization: Bearer <jwt>` on every protected request
- `SupabaseAuthGuard` fetches Supabase JWKs (cached 24 h), verifies the JWT via `jose`, and attaches `req.user` typed as `AuthUser`
- `RolesGuard` checks `user.role` against the `@Roles('candidate' | 'recruiter' | 'admin')` decorator
- Per-resource ownership is checked in services (e.g., "recruiter owns this job")
- Postgres RLS is the last word — even a buggy guard cannot reach unauthorized rows

### Secrets

| Secret | Where it lives |
| --- | --- |
| Supabase anon key | `apps/web/.env.local` (`NEXT_PUBLIC_*`, bundled to client — safe) |
| Supabase service role key | `apps/api/.env` only (server) |
| OpenAI key | `apps/api/.env` only |
| Resend API key | `apps/api/.env` only |
| Postgres password | `apps/api/.env` only |
| Redis password (prod) | `deploy/.env` only on the droplet, `chmod 600` |

### Rate limiting

`@nestjs/throttler` backed by Redis, configured per route:

| Endpoint | Limit |
| --- | --- |
| Auth (`login`, `register`) | 5 / 60s per IP + email |
| Resume upload | 5 / hour per user |
| Score recompute | 1 / 60s per user |
| Bias check during typing | 10 / 60s per user |

### Transport

- **Frontend → Backend** over HTTPS (TLS terminated by Vercel and Caddy)
- **Backend → Postgres** over TLS (Supabase pooler)
- **Backend → Redis** over `127.0.0.1` (never on the public network)
- **Backend → OpenAI / Resend** over HTTPS

### Input safety

- All bodies validated by Zod (`nestjs-zod`)
- File uploads checked for MIME + size + magic bytes server-side
- Rich-text HTML sanitized on render
- Audit logs sanitize sensitive fields (no passwords, no tokens)

---

## Roles & Capabilities

| Capability | Candidate | Recruiter | Admin |
| --- | --- | --- | --- |
| Register + complete onboarding | ✅ (6 steps) | ✅ (3 steps) | seeded |
| Upload resumes, set default | ✅ | — | — |
| Compute Profile Score | ✅ (rate-limited 1/60s) | — | — |
| Browse public jobs | ✅ | ✅ | ✅ |
| Apply to a job (synchronous Match Score) | ✅ | — | — |
| Withdraw application | ✅ | — | — |
| Post / edit / archive jobs | — | ✅ (own jobs) | ✅ (all) |
| Bias check on description | — | ✅ (auto + manual) | — |
| Override bias flag with reason | — | ✅ | — |
| View applications to a job | — | ✅ (own jobs) | ✅ (all) |
| See full Score Breakdown + evidence | ✅ (own) | ✅ (own jobs) | ✅ (all) |
| Update application status | — | ✅ (own jobs) | ✅ |
| Schedule interview / record feedback | — | ✅ | ✅ |
| Send offer / accept-decline | recruiter sends, candidate responds | ✅ | ✅ |
| Suspend / delete users | — | — | ✅ |
| Moderate jobs / archive | — | — | ✅ |
| Tune AI scoring weights | — | — | ✅ |
| Preview weight impact against last 100 apps | — | — | ✅ |
| Trigger batch re-score | — | — | ✅ (BullMQ job) |
| Read audit log | — | — | ✅ |
| View Bias & Fairness Monitor | — | — | ✅ |
| Read system analytics | — | — | ✅ |

---

## Page Inventory

~45 distinct routes across six surfaces. See [docs/main/page-inventory.md](docs/main/page-inventory.md) for ASCII layouts of every page.

| Surface | Routes | Auth |
| --- | --- | --- |
| **Marketing** | `/`, `/about`, `/jobs`, `/jobs/[id]`, `/contact` | Public |
| **Auth** | `/login`, `/register`, `/register/candidate`, `/register/recruiter`, `/forgot-password`, `/reset-password`, `/verify-email`, `/verify-email/sent` | Public |
| **Onboarding** | Candidate (6 steps + result) · Recruiter (3 steps) | Authed, pre-onboarded |
| **Candidate** | `/candidate`, `/candidate/jobs`, `/candidate/jobs/[id]`, `/candidate/jobs/[id]/apply`, `/candidate/applications`, `/candidate/applications/[id]`, `/candidate/interviews`, `/candidate/profile`, `/candidate/resume`, `/candidate/settings` | Candidate role |
| **Recruiter** | `/recruiter`, `/recruiter/jobs`, `/recruiter/jobs/new`, `/recruiter/jobs/[id]`, `/recruiter/jobs/[id]/edit`, `/recruiter/jobs/[id]/applications`, `/recruiter/applications/[id]`, `/recruiter/candidates/[id]`, `/recruiter/shortlist`, `/recruiter/interviews`, `/recruiter/offers/new`, `/recruiter/analytics`, `/recruiter/settings` | Recruiter role |
| **Admin** | `/admin`, `/admin/users`, `/admin/jobs`, `/admin/applications`, `/admin/ai-config`, `/admin/audit`, `/admin/analytics`, `/admin/bias-monitor` | Admin role |

Every page ships with explicit **loading**, **error**, and **empty** states. Mobile responsiveness collapses portal sidebars to drawers, tables to vertically stacked cards, and the layered Score Ring mockups to a single card.

---

## Deployment

### Frontend → Vercel

1. Import the repo into Vercel as a new project
2. Set **Root Directory** to `apps/web`
3. Framework preset: **Next.js** (Vercel auto-detects pnpm + the monorepo)
4. Add the env vars from `apps/web/.env.local`, replacing local URLs with production ones:
   - `NEXT_PUBLIC_API_URL=https://api.your-domain` (or the sslip.io alternative)
   - `NEXT_PUBLIC_APP_URL=https://your-frontend.vercel.app`
5. Trigger first deploy. Subsequent pushes to `main` auto-deploy.

### Backend → Digital Ocean Droplet

The backend deployment is intentionally manual SSH + PM2 + Docker — every step inspectable.

#### One-time droplet provisioning

```bash
# From your Mac
scp deploy/provision.sh root@<DROPLET_IP>:/root/
ssh root@<DROPLET_IP> 'bash /root/provision.sh'
```

`deploy/provision.sh` performs nine steps as root: system update, create `deploy` user with passwordless sudo, harden SSH (no root login, no password auth), UFW firewall (22/80/443 only), fail2ban, Docker + Compose plugin, Node 20 + pnpm via corepack, PM2, Caddy with auto-HTTPS.

#### First production deploy

```bash
# As deploy@<DROPLET>
git clone https://github.com/cjjutba/aurahire-final.git /home/deploy/aurahire
cd /home/deploy/aurahire

# Production env (NEVER commit)
cp deploy/env.api.production.example apps/api/.env
nano apps/api/.env  # fill real values
chmod 600 apps/api/.env

# Redis + Mailpit on the host (localhost-bound)
docker compose -f deploy/docker-compose.prod.yml --env-file apps/api/.env up -d

# Caddy
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy

# Build + run the API under PM2
pnpm install --frozen-lockfile
pnpm --filter @aurahire/api build
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup systemd   # follow the printed command as root for boot-survival
```

#### Subsequent deploys

```bash
# As deploy@<DROPLET>
cd /home/deploy/aurahire
bash deploy/deploy.sh
```

`deploy/deploy.sh` pulls latest, runs `pnpm install --frozen-lockfile`, type-checks the API, **validates the production `.env`** (asserts `NODE_ENV=production`, `USE_RESEND=true`, `APP_URL=https://aurahire.site`, required secrets present, `FROM_EMAIL` on the verified Resend domain), then `pm2 reload aurahire-api --update-env` and reloads Caddy.

#### Caddyfile highlights

- TLS auto-issued for the configured hostname via Let's Encrypt
- WebSocket support for `/socket.io/*` with `read_timeout 0`
- Long timeouts (60s) for REST so resume parsing and AI scoring don't get severed
- Hardened headers: HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, server name stripped
- JSON-formatted access logs to `/var/log/caddy/access.log`

#### Health checks

- `GET /api/health` → `{ status: "ok", uptime, version }` — probed by Caddy and PM2
- PM2 auto-restarts on crash; max memory restart at 1 GB
- Logs at `/home/deploy/.pm2/logs/aurahire-api-out.log` and `aurahire-api-error.log`

---

## Testing

| Layer | Tool | Where |
| --- | --- | --- |
| **Static** | TypeScript strict mode + Zod | Every package |
| **Backend unit** | Jest (`ts-jest`) | `apps/api/src/**/*.spec.ts` |
| **Backend AI corpus** | Custom runner over curated resumes | `apps/api/scripts/run-ai-parse-corpus.ts` |
| **Frontend unit** | Vitest + Testing Library | `apps/web/**/*.test.{ts,tsx}` |
| **Frontend E2E** | Playwright | `apps/web/e2e/` |
| **CI gate** | GitHub Actions | `.github/workflows/ci.yml` |

```bash
# All checks at once
pnpm format:check && pnpm type-check && pnpm lint && pnpm --filter @aurahire/api test && pnpm --filter @aurahire/web test
```

Playwright UI mode for visual debugging:

```bash
pnpm --filter @aurahire/web e2e:ui
```

### CI pipeline

`.github/workflows/ci.yml` runs on every PR to `main` and every push to `main` or `dev`:

1. Checkout
2. Setup pnpm 9.12.3 + Node 20 with pnpm cache
3. `pnpm install --frozen-lockfile`
4. `pnpm format:check`
5. `pnpm type-check` (all packages)
6. `pnpm lint` (best-effort while ESLint v9 surface stabilizes)
7. `pnpm --filter @aurahire/api test`
8. `pnpm --filter @aurahire/web test`

Concurrency is set to cancel-in-progress per PR ref so a push supersedes any in-flight run.

---

## Observability

### Logs

- **Frontend** — Pino-formatted logs ingested by Vercel
- **Backend** — `nestjs-pino` writes structured JSON to stdout, captured by PM2 into rotating log files (`/home/deploy/.pm2/logs/aurahire-api-*.log`)
- **Caddy** — JSON access log at `/var/log/caddy/access.log`, 10 MB rotation × 5 keep

### Audit trail

The `audit_logs` table is the first-class observability surface for the thesis: every consequential action by every actor (user / system / AI) is captured with `actor_id`, `actor_type`, `action`, `entity_type`, `entity_id`, `details` (JSONB), `ip_address`, and `user_agent`. Admins query and export it from `/admin/audit`.

### Health

- `GET /api/health` — uptime + version
- PM2 status: `pm2 status`, `pm2 logs aurahire-api`, `pm2 monit`

### Production hardening (Phase 2)

- Sentry for error tracking
- PostHog for product analytics
- OpenTelemetry traces
- GitHub Actions deploy workflow gated on `needs: validate` (CI green)

---

## Project Documentation

The single source of truth for every architectural and product decision lives in `docs/main/`. Read these before changing related code.

| Doc | Scope |
| --- | --- |
| [prd.md](docs/main/prd.md) | Product requirements, sprint scope, deferred features, acceptance criteria, demo path |
| [architecture.md](docs/main/architecture.md) | System architecture, request lifecycles, layered defense, decision log |
| [tech-stack.md](docs/main/tech-stack.md) | Every dependency with rationale and version |
| [project-structure.md](docs/main/project-structure.md) | Monorepo layout, file naming, where to put new code |
| [database-schema.md](docs/main/database-schema.md) | All 15 tables, indexes, RLS policy SQL |
| [ai-design.md](docs/main/ai-design.md) | Prompts, structured-output schemas, redaction, evaluation, prompt versioning |
| [technical-specifications.md](docs/main/technical-specifications.md) | Per-endpoint request / response / validation / side-effect / edge-case specs |
| [best-practices.md](docs/main/best-practices.md) | Engineering standards (NestJS + Next.js + monorepo discipline) |
| [design-system.md](docs/main/design-system.md) | Tokens (canonical) |
| [ui-patterns.md](docs/main/ui-patterns.md) | Every component, variants, signature patterns |
| [page-inventory.md](docs/main/page-inventory.md) | Every route, ASCII layout, edge states |
| [sprint-plan.md](docs/main/sprint-plan.md) | Day-by-day sprint slices with definitions of done |
| [caching-strategy.md](docs/main/caching-strategy.md) | Cache surfaces, TTLs, invalidation rules |
| [env-setup.md](docs/main/env-setup.md) | First-time local dev setup + production deploy |

### Root-level reference docs

| File | Scope |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Agent rules including the Next.js 16 caveat |
| [CLAUDE.md](CLAUDE.md) | Claude Code project instructions + hard "do nots" |
| [DESIGN.md](DESIGN.md) | Brand design summary (editorial reference) |

---

## Operational Runbook

### Common dev tasks

```bash
# Inspect the database in your browser
pnpm --filter @aurahire/db drizzle-kit studio

# Regenerate the typed API client (after a backend controller change)
pnpm --filter @aurahire/api generate:openapi
pnpm --filter @aurahire/shared build

# Run the AI parsing corpus
pnpm --filter @aurahire/api test:ai-parse

# Reset the dev DB (destructive — only on dev project)
pnpm --filter @aurahire/api reset-db

# Tail logs from local services
docker compose -f docker-compose.dev.yml logs -f mailpit
docker compose -f docker-compose.dev.yml logs -f redis
```

### Production tasks (on the droplet, as `deploy`)

```bash
# Tail API logs
pm2 logs aurahire-api

# Hot-reload the API after a code change
bash /home/deploy/aurahire/deploy/deploy.sh

# Inspect Caddy access logs
sudo tail -f /var/log/caddy/access.log | jq

# Verify Redis health
docker exec aurahire-redis redis-cli -a "$REDIS_PASSWORD" ping

# Inspect Mailpit (tunnel to localhost first)
ssh -L 8025:localhost:8025 deploy@<DROPLET_IP>
# open http://localhost:8025 in your browser
```

### Recovery procedures

| Symptom | Investigation |
| --- | --- |
| `pnpm dev` only starts one app | Check `turbo.json` has `dev` with `persistent: true`; verify both apps have a `dev` script |
| Backend can't reach Postgres | Confirm `DATABASE_URL` uses pooler port `6543`; password URL-encoded |
| Frontend can't reach backend | Confirm `NEXT_PUBLIC_API_URL`; confirm backend `ALLOWED_ORIGINS` includes the frontend URL |
| Mailpit not catching emails | `docker compose -f docker-compose.dev.yml ps`; verify `NODE_ENV=development`, `SMTP_HOST=localhost`, `SMTP_PORT=1025` |
| Redis connection refused | Container up? `docker exec aurahire-redis redis-cli ping` → `PONG` |
| RLS blocking a query | The service role client bypasses RLS for system ops; check the right Supabase client is being used |
| Resume parsing fails | OpenAI billing balance? Check `apps/api` logs for the parse attempt |
| Production deploy fails env validation | `deploy/deploy.sh` lists exactly which env key was wrong — fix `apps/api/.env` on the droplet |

---

## Contributing

This repo is a thesis project, so external contributions are not actively solicited. If you fork or borrow patterns:

1. Respect the architecture — the frontend/backend split is load-bearing for the security model
2. Keep the discipline — structured AI outputs, PII redaction, audit logs, RLS on every table
3. Read the relevant doc in `docs/main/` before changing related code
4. Run the full validation chain locally before opening a PR: `pnpm format:check && pnpm type-check && pnpm --filter @aurahire/api test && pnpm --filter @aurahire/web test`
5. CI will gate the merge on `main`

### Commit style

Conventional commits flavor (`feat`, `fix`, `refactor`, `docs`, `chore`, `test`) with optional scope:

```
feat(scoring): exclude already-applied jobs from Recommended feed
fix(jobs): excludeApplied was hidden-on by default
docs(superpowers): add implementation plan for symmetric evidence reasoning
refactor(offers): align Send Offer page with Post Job layout
```

---

## License

Proprietary — © 2026 CJ Jutba. All rights reserved.

This project is the implementation artifact for the thesis **"Explainable and Fair AI-Powered Recruitment: A Transparent Resume Scoring Platform with Bias Mitigation."** Code, design, schemas, prompts, and documentation are provided here for academic review and demonstration. Reuse without explicit written permission is not authorized.

---

## Acknowledgements

- **Supabase** — Postgres, Auth, and Storage on a generous free tier
- **Vercel** — Next.js hosting with preview URLs that make every PR demoable
- **Digital Ocean** — a transparent, inspectable Droplet that fits the thesis story
- **OpenAI** — `gpt-4o-mini` for structured outputs at thesis-scale cost
- **Resend** — production transactional email
- **Mailpit** — local SMTP catcher that makes dev email a one-click inbox
- **The Next.js, NestJS, Drizzle, shadcn/ui, Radix, TanStack, Tiptap, Recharts, and Lucide teams** — for the open-source primitives this system is built on

Built by **CJ Jutba** as a thesis defense of explainable, fair AI in hiring.
