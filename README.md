<div align="center">

# AuraHire

**Explainable and Fair AI-Powered Recruitment**
_A transparent resume-scoring platform with built-in bias mitigation._

[![CI](https://github.com/cjjutba/aurahire-final/actions/workflows/ci.yml/badge.svg)](https://github.com/cjjutba/aurahire-final/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs)](https://nestjs.com)
[![React](https://img.shields.io/badge/React-19.2-149ECA?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7%20strict-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3FCF8E?logo=supabase)](https://supabase.com)
[![Drizzle](https://img.shields.io/badge/Drizzle%20ORM-0.36-C5F74F?logo=drizzle)](https://orm.drizzle.team)
[![OpenAI](https://img.shields.io/badge/OpenAI-gpt--4o--mini-412991?logo=openai)](https://platform.openai.com)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwindcss)](https://tailwindcss.com)
[![pnpm](https://img.shields.io/badge/pnpm-9.12-F69220?logo=pnpm)](https://pnpm.io)
[![Turborepo](https://img.shields.io/badge/Turborepo-2-EF4444?logo=turborepo)](https://turbo.build)
[![Node](https://img.shields.io/badge/Node-20.x%20LTS-339933?logo=node.js)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Proprietary-blue.svg)](#license)

</div>

AuraHire is a full-stack, production-grade AI recruitment platform built as a thesis system. Every AI decision shows its work — scores ship with component breakdowns, weighting transparency, and verbatim evidence excerpts from the candidate's resume; job descriptions are scanned for biased language before publish; admins can audit any score and retune the algorithm in real time with a Preview Impact pass. **The system is the artifact: no faked AI, no opaque scoring, no demo theatre.**

> _"Explainable and Fair AI-Powered Recruitment: A Transparent Resume Scoring Platform with Bias Mitigation."_

---

## Table of Contents

- [Project Snapshot](#project-snapshot)
- [Why AuraHire](#why-aurahire)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Repository Layout](#repository-layout)
- [Quick Start](#quick-start)
- [Getting Started (Detailed)](#getting-started-detailed)
- [Environment Variables](#environment-variables)
- [Development Workflow](#development-workflow)
- [AI Engines](#ai-engines)
- [Database Schema](#database-schema)
- [Background Jobs & Cron](#background-jobs--cron)
- [Real-time](#real-time)
- [Email System](#email-system)
- [Caching Strategy](#caching-strategy)
- [API Documentation](#api-documentation)
- [Security Model](#security-model)
- [Multi-tenancy](#multi-tenancy)
- [Roles & Capabilities](#roles--capabilities)
- [Page Inventory](#page-inventory)
- [Design System](#design-system)
- [Performance & Scaling](#performance--scaling)
- [Accessibility & Browser Support](#accessibility--browser-support)
- [Internationalization](#internationalization)
- [Deployment](#deployment)
- [Testing](#testing)
- [Observability](#observability)
- [Project Documentation](#project-documentation)
- [Operational Runbook](#operational-runbook)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Security Policy](#security-policy)
- [Code of Conduct](#code-of-conduct)
- [Glossary](#glossary)
- [FAQ](#faq)
- [License](#license)
- [Acknowledgements](#acknowledgements)
- [Author & Contact](#author--contact)

---

## Project Snapshot

| Metric                            | Value                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------- |
| **Monorepo apps**                 | 2 (`apps/web`, `apps/api`)                                                        |
| **Internal packages**             | 2 (`packages/shared`, `packages/db`)                                              |
| **Frontend routes**               | 80+ pages across 6 surfaces (marketing, auth, candidate, recruiter, admin, legal) |
| **Backend feature modules**       | 18 NestJS modules                                                                 |
| **Database tables**               | 23 with RLS enabled on every user-data table                                      |
| **Background queues**             | 4 (BullMQ on Redis)                                                               |
| **Scheduled cron jobs**           | 9 (`@nestjs/schedule`)                                                            |
| **Transactional email templates** | 16 (React Email)                                                                  |
| **AI engines**                    | 6 (parse, redact, profile-score, match-score, bias-detect, fairness)              |
| **User roles**                    | 3 (candidate, recruiter, admin) + multi-tenant company members                    |
| **Authentication**                | Supabase Auth (JWT) + JWKs verification on backend                                |
| **Hosting (frontend)**            | Vercel                                                                            |
| **Hosting (backend)**             | Digital Ocean Droplet (Ubuntu 24.04) + PM2 + Caddy + Docker (Redis/Mailpit)       |
| **CI**                            | GitHub Actions — format, type-check, lint, test                                   |

---

## Why AuraHire

Most AI recruitment tools score candidates inside a black box. AuraHire was built around two academically-defensible commitments:

1. **Explainable scoring.** Every score has a structured breakdown — components, weights, plain-language explanations, and verbatim evidence excerpts pulled from the candidate's resume. No naked numbers anywhere in the product.
2. **Active bias mitigation.** PII is redacted before any scoring AI sees a resume. Job descriptions are scanned for gendered, age-coded, ableist, and exclusionary language at edit time. Recruiter overrides require a written reason that lands in the audit log.

The thesis claim shapes every product decision in this codebase. If a feature can't be defended in front of an examiner, it isn't in the system.

### What makes this implementation different

- **No prompt without a JSON schema.** Every OpenAI call uses structured outputs. Free-text parsing is forbidden.
- **No score without evidence.** Every numeric component renders alongside 1–3 verbatim resume excerpts and a plain-language explanation.
- **No mutation without an audit row.** Every consequential action — score, override, status change, suspension, delete — writes to `audit_logs` with actor, entity, IP, user-agent, and JSONB details.
- **No silent AI failure.** Resume parsing falls back to manual entry. Score computation falls back to a graceful "Score temporarily unavailable" surface. Bias detection failure does not block publishing (logged as warning).
- **No demographic labels stored anywhere.** Demographic data isn't collected; fairness is measured upstream (redaction + bias detection) and reported as aggregate distributions, not disparate-impact statistics.

---

## Key Features

### Candidate experience

- **6-step resume-first onboarding wizard** — upload → AI parse → review prefilled fields → preferences → Profile Score reveal → confirm
- **AI resume parsing** to structured JSON (contact, education, experience, skills, certifications, languages) with `parse_confidence` indicator
- **Profile Score** with 4-component breakdown (Completeness · Skill Depth · Experience Clarity · Education Quality), 2–3 actionable improvement suggestions, and live evidence callouts
- **Public + authenticated job browsing** with per-job match score chips (prefetched via the match-preview queue when resumes change)
- **One-tap apply** with synchronous Match Score computation and visible AI affordance
- **Application pipeline tracking** (Applied → Screening → Interview → Offer → Hired/Rejected) with status timeline
- **Interview list + detail view** (phone / video / in-person) with reschedule, cancel, and feedback acknowledgement
- **In-portal offer Accept / Decline** with surfaced expiry
- **Multi-version resume manager** with default-resume selection (triggers re-scoring across active applications)
- **Notification preferences per category** (status changes, interviews, offers, system) and GDPR-aligned data download / account deletion
- **Real-time notification badge** via WebSocket — appears instantly on offer/interview/status events

### Recruiter experience

- **3-step onboarding** (about you · company · hiring focus) with company creation or invite acceptance
- **Multi-company support** — one recruiter can belong to multiple companies via `company_members`; an active-company context governs every recruiter view
- **Rich-text job description editor (Tiptap)** with inline bias-flag chips that highlight problematic terms as you type
- **Publish-gate**: jobs with unresolved bias flags can only ship after an explicit override with a written reason
- **Application pipeline per job**, sortable by Best Match with full Score Breakdown + evidence callouts
- **Interview scheduling** (phone / video / in-person) with location/link, candidate notification email, and reminder cron
- **Interview venues library** for reusable in-person locations
- **Offer letter generation** with live preview, candidate accept/decline buttons, expiry, and admin auditability
- **Shortlist** with bulk actions and CSV export
- **Per-recruiter analytics** — applications over time, funnel, top skills, score distribution, time-to-fill
- **Team members management** — invite teammates with role (member / admin) per company
- **Settings**: profile, company, interview venues, integrations, scoring (preview only), bias preferences, members, notifications, privacy, security, danger zone

### Admin experience (11 surfaces)

1. **Command Center** — system KPIs, AI processing health, recent audit events, bias-flag counts, recent feedback summary
2. **User Management** — full CRUD, suspend with reason, role change, GDPR delete with cascade
3. **Job Moderation** — review all jobs, archive, see complete bias-flag history per posting
4. **Application Oversight** — system-wide audit, drill into any AI score, view redacted resume snapshot used for scoring
5. **AI Scoring Configuration** — tune match + profile weights, set band thresholds, **Preview Impact** against last 100 applications before saving (vs. current production weights)
6. **Audit Log** — immutable, filterable by actor/action/entity, CSV-exportable
7. **System Analytics** — user growth, applications by status, score distribution, top skills, funnel conversion
8. **Bias & Fairness Monitor** — flag counts by category, top flagged terms, override rate, recent override decisions with reasons, time-series trend
9. **Companies** — admin view of every tenant company + member roster
10. **Feedback** — read in-app feedback submissions; triage with status (open / acknowledged / resolved)
11. **Help / How It Works** — built-in admin guides for non-obvious flows (re-score batch, schema migration, weight tuning)

### AI surfaces (all backend-only, all structured)

| Surface             | Inputs                        | Output                                                     | Trigger                                 |
| ------------------- | ----------------------------- | ---------------------------------------------------------- | --------------------------------------- |
| Resume parsing      | PDF / DOCX                    | Structured resume JSON (Zod-validated)                     | Onboarding step 1, every new upload     |
| PII redaction       | Parsed resume                 | Redacted copy + `redacted_fields` audit list               | Before any scoring call                 |
| Profile Score       | Redacted resume + preferences | 4-component breakdown + evidence + improvement suggestions | End of onboarding, resume/prefs change  |
| Match Score         | Redacted resume + job posting | 4-component breakdown + evidence + red/green flags         | At application time, on demand          |
| Match Preview       | Top-N jobs per candidate      | Cached match score chips for the Jobs feed                 | Resume change (BullMQ async)            |
| Bias detection      | Job description text          | Flagged terms by category with severity + suggestion       | On blur (debounced) + on Save / Publish |
| Fairness aggregates | DB aggregations               | Counts, distributions, top terms (SQL only — no LLM)       | Admin Bias Monitor                      |

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
        │   - Socket.io client for realtime                │
        │   - NO DB. NO AI keys. NO storage SDK.           │
        └────────────────────────┬─────────────────────────┘
                                 │ HTTPS · Bearer <Supabase JWT>
                                 │ WSS  · Socket.io
        ┌────────────────────────▼─────────────────────────┐
        │   Backend — NestJS 10 (Digital Ocean Droplet)    │
        │   apps/api                                       │
        │   - Fastify adapter; Swagger at /api/docs        │
        │   - SupabaseAuthGuard + RolesGuard + ActiveCo.   │
        │   - 18 feature modules + AI + queue + cron       │
        │   - Drizzle ORM, nestjs-zod, Pino, Helmet        │
        │   - BullMQ, @nestjs/schedule, cache-manager      │
        │   - Socket.io WS gateway (Redis adapter)         │
        │   - OpenAI SDK (server-only)                     │
        └──┬─────────┬──────────┬──────────┬──────────┬────┘
           │         │          │          │          │
   ┌───────▼──┐ ┌────▼────┐ ┌──▼─────┐ ┌──▼──────┐ ┌─▼────────┐
   │ Supabase │ │  Redis  │ │ OpenAI │ │ Mailpit │ │ Supabase │
   │ Postgres │ │ (Docker │ │  API   │ │  (dev)  │ │ Storage  │
   │  + RLS   │ │ on host)│ │        │ │ Resend  │ │ resumes/ │
   │   23     │ │ cache · │ │ gpt-4o │ │ (prod)  │ │ avatars/ │
   │  tables  │ │ queue · │ │  -mini │ │ 16 tmpl │ │ logos/   │
   │          │ │ throttle│ │        │ │         │ │          │
   └──────────┘ └─────────┘ └────────┘ └─────────┘ └──────────┘
```

### Defense in depth (five layers)

1. **Frontend middleware** — redirects unauthenticated/wrong-role users at the URL boundary; enforces onboarded vs not-onboarded
2. **Backend CORS + Helmet** — `ALLOWED_ORIGINS` whitelist, hardened HTTP headers
3. **`SupabaseAuthGuard`** — validates JWT signature, expiry, and JWKs on every protected request
4. **`RolesGuard` + `ActiveCompanyGuard` + ownership checks** — RBAC at the controller, active-tenant gating, per-resource ownership in services
5. **Postgres RLS** — every user-data table enforces `auth.uid()` and role rules; the service-role client only operates on the server side

Even if layers 1–4 are bypassed (a frontend bug, a misconfigured CORS, a malformed guard), the database itself refuses unauthorized reads and writes.

### Data flow patterns

**Read path (candidate views a job):**

```
Browser → middleware (auth) → Next.js Server Component → fetch(<api>/jobs/:id, Bearer JWT)
       → SupabaseAuthGuard → RolesGuard → JobsController → JobsService
       → Drizzle (RLS-aware) → Postgres → response → render
```

**Write path with side effects (recruiter publishes a job):**

```
Form submit → RHF + zodResolver (shared schema) → useUpdateJob mutation (orval-generated)
           → PATCH /jobs/:id/publish → SupabaseAuthGuard → RolesGuard("recruiter")
           → JobsController.publish → JobsService → BiasService.check (must be resolved/overridden)
           → DB UPDATE jobs.status='published' + audit_logs INSERT
           → MatchPreviewQueue.enqueue({ jobId }) (BullMQ)
           → response → invalidate ['jobs', id] query
```

**AI scoring path (candidate applies):**

```
Apply button → POST /applications → AuthGuard → ApplicationsService
            → Find resume → RedactPiiService → ScoreMatchService (OpenAI structured output)
            → INSERT applications, match_scores, evidence_excerpts, audit_logs in a transaction
            → emit("application.created") via Socket.io
            → return { applicationId, matchScore }
```

---

## Technology Stack

### Monorepo & build

| Tool                             | Role                                                                    |
| -------------------------------- | ----------------------------------------------------------------------- |
| **pnpm 9.12**                    | Package manager with workspaces                                         |
| **Turborepo 2**                  | Task graph + incremental cache for `dev`, `build`, `lint`, `type-check` |
| **TypeScript 5.7 (strict)**      | End-to-end type safety; `noUncheckedIndexedAccess`, no `any`            |
| **Prettier 3 + Tailwind plugin** | Format-on-save, class sorting                                           |
| **ESLint 9**                     | Lint for both apps (best-effort gate while v9 surface stabilizes)       |

### Frontend (`apps/web`)

| Tool                                    | Version                 | Role                                                  |
| --------------------------------------- | ----------------------- | ----------------------------------------------------- |
| Next.js                                 | **16.2.4** (App Router) | Routes, Server Components, streaming, Turbopack dev   |
| React                                   | 19.2.4                  | UI runtime                                            |
| Tailwind CSS                            | 4.x                     | Utility-first styling with `@theme` tokens            |
| shadcn/ui + Radix UI (`@base-ui/react`) | Latest                  | Accessible primitives extended with AuraHire patterns |
| React Hook Form                         | 7                       | Form state                                            |
| Zod                                     | 3 (shared schemas)      | Validation, type inference                            |
| `@hookform/resolvers`                   | 5                       | RHF ↔ Zod bridge                                      |
| TanStack Query                          | 5                       | Server state, mutation hooks                          |
| Tiptap                                  | 3                       | Rich-text editor for job descriptions                 |
| Recharts                                | 3                       | Analytics charts                                      |
| Lucide React                            | 1                       | Icon library                                          |
| `@supabase/ssr`                         | 0.10                    | Cookie-aware Supabase Auth client                     |
| Socket.io client                        | 4                       | Real-time notifications                               |
| pdfjs-dist                              | 5                       | Client-side PDF preview                               |
| sonner                                  | 2                       | Toast notifications                                   |
| next-themes                             | 0.4                     | Theme toggling (light fixed for marketing)            |
| tailwind-merge / clsx                   | 3 / 2                   | Class composition                                     |
| Vitest + Playwright                     | Latest                  | Unit + E2E testing                                    |

### Backend (`apps/api`)

| Tool                                | Version                    | Role                                                  |
| ----------------------------------- | -------------------------- | ----------------------------------------------------- |
| NestJS                              | **10.4** (Fastify adapter) | Decorator-based modular HTTP API                      |
| `@nestjs/swagger`                   | 8                          | Auto-generated OpenAPI 3 spec + Swagger UI            |
| `nestjs-zod`                        | 5                          | Bridges shared Zod schemas to DTOs                    |
| Drizzle ORM                         | 0.36                       | Type-safe Postgres queries                            |
| `postgres`                          | 3.4                        | Pg driver                                             |
| `@nestjs/bullmq` + BullMQ           | 11 / 5                     | Background jobs (Redis-backed)                        |
| `@nestjs/schedule`                  | 6                          | Cron decorator (`@Cron`) for scheduled tasks          |
| `@nestjs/cache-manager` + Keyv      | 3 / 5                      | Redis-backed cache (`cache-manager-redis-yet`)        |
| `@nestjs/throttler` + Redis storage | 6                          | Per-route rate limiting                               |
| `@nestjs/websockets` + Socket.io    | 10 / 4                     | Live notification stream (Redis adapter for HA-ready) |
| `@socket.io/redis-adapter`          | 8                          | Cross-process WS broadcast                            |
| OpenAI SDK                          | 6                          | `gpt-4o-mini` with structured outputs                 |
| `jose`                              | 6                          | Supabase JWT verification with JWKs                   |
| `pdf-parse` + `mammoth`             | 2 / 1                      | Resume text extraction                                |
| React Email                         | 1                          | JSX email templates                                   |
| Nodemailer                          | 8                          | SMTP transport for Mailpit (dev)                      |
| Resend                              | 6                          | Production transactional email                        |
| `nestjs-pino` + Pino                | 4 / 9                      | Structured JSON logs                                  |
| `@fastify/helmet`                   | 11                         | Security headers                                      |
| `@fastify/multipart`                | 8                          | File uploads                                          |
| pdfkit                              | 0.18                       | Offer letter / receipt PDF generation                 |
| ioredis                             | 5                          | Direct Redis client (queues + cache + throttle)       |

### Shared types & API client (`packages/shared`)

| Tool                 | Role                                                               |
| -------------------- | ------------------------------------------------------------------ |
| Zod                  | Single source of truth for input shapes — validates DTOs and forms |
| TanStack React Query | Co-located with generated hooks                                    |
| Orval                | Generates typed TanStack Query hooks from `openapi.json`           |
| `zod-to-json-schema` | Generates JSON schemas for OpenAI structured outputs               |

### Database & data layer (`packages/db`)

| Component                                                 | Role                                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Supabase Postgres**                                     | Primary data store with Row-Level Security                                            |
| **Supabase Auth**                                         | Email/password + JWT issuance + verification flow                                     |
| **Supabase Storage**                                      | Resumes (private + signed URLs), avatars, company logos                               |
| **Drizzle schema** (`packages/db/src/schema.ts`)          | 23 tables across Identity / Recruitment / Candidate Data / AI / Audit / Notifications |
| **Drizzle migrations**                                    | `packages/db/drizzle/` — generated, version-controlled SQL                            |
| **RLS policies** (`packages/db/src/rls/all-policies.sql`) | Hand-written SQL applied via Supabase Dashboard or psql                               |

### Infrastructure & hosting

| Service                                                 | Purpose                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| **Vercel**                                              | Frontend hosting, auto-deploy from `main`, preview URLs per commit |
| **Digital Ocean Droplet** (Ubuntu 24.04, 2 vCPU / 2 GB) | Backend host                                                       |
| **PM2**                                                 | Node process supervisor with auto-restart and rotating log files   |
| **Caddy 2**                                             | Reverse proxy with auto-renewing Let's Encrypt TLS                 |
| **Docker Compose**                                      | Redis + Mailpit containers on the same host (localhost-bound only) |
| **UFW** + **fail2ban**                                  | Firewall (22/80/443 only) + SSH brute-force protection             |
| **GitHub Actions**                                      | CI: format, type-check, lint, test on every PR + push to `main`    |

The deployment is intentionally **explicit and inspectable** — no PaaS magic. Every moving part (Node, PM2, Docker, Caddy, UFW) is editable and visible. Redis and Mailpit bind to `127.0.0.1` only; Caddy is the only thing reachable from the public internet.

---

## Repository Layout

```
aurahire/
├── apps/
│   ├── web/                       # Next.js 16 frontend → Vercel
│   │   ├── app/
│   │   │   ├── (public)/          # Homepage, public jobs board, marketing
│   │   │   ├── (auth)/            # Login, register, forgot/reset password, verify-email
│   │   │   ├── (candidate)/       # Candidate portal — dashboard, jobs, applications, interviews, profile, resume, settings
│   │   │   ├── (recruiter)/       # Recruiter portal — jobs, applications, interviews, offers, shortlist, analytics, settings
│   │   │   ├── (admin)/           # Admin portal — users, jobs, applications, ai-config, audit, analytics, bias-monitor, companies, feedback, help
│   │   │   ├── (legal)/           # Terms, privacy
│   │   │   ├── onboarding/        # 6-step candidate + 3-step recruiter wizards
│   │   │   ├── invite/[token]     # Team invitation acceptance
│   │   │   ├── layout.tsx         # Root layout (theme, fonts, providers)
│   │   │   └── globals.css        # Tailwind 4 entry + design tokens
│   │   ├── components/            # ai/, auth/, bias/, brand/, help/, how-it-works/, interview/, invite/, jobs/, layout/, legal/, onboarding/, portal/, providers/, score/, settings/, ui/ (shadcn)
│   │   ├── contexts/              # React contexts (active company, theme)
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── lib/                   # Auth helpers, query client, realtime, toast, utils
│   │   ├── e2e/                   # Playwright tests + fixtures
│   │   ├── middleware.ts          # Edge auth + RBAC + onboarding redirects
│   │   ├── next.config.ts
│   │   ├── postcss.config.mjs
│   │   ├── playwright.config.ts
│   │   └── vitest.config.ts
│   └── api/                       # NestJS backend → DO Droplet (PM2)
│       ├── src/
│       │   ├── main.ts            # Fastify bootstrap, Swagger, global pipes, Helmet
│       │   ├── app.module.ts
│       │   ├── modules/           # 18 feature modules — admin, applications, auth, bias,
│       │   │                      # candidate-profiles, companies, feedback, interviews,
│       │   │                      # interview-venues, invitations, jobs, notifications,
│       │   │                      # notification-preferences, offers, profiles,
│       │   │                      # recruiter-profiles, resumes, scoring
│       │   ├── common/            # Guards (Supabase auth, roles, active company),
│       │   │                      # decorators (@Roles, @CurrentUser, @ActiveCompany, @Public,
│       │   │                      # @RequireCompanyRole, @SkipActiveCompany), filters, types
│       │   ├── ai/                # OpenAI client + parse/score/bias/redact services,
│       │   │                      # versioned prompts/, structured-output JSON schemas
│       │   ├── queue/             # BullMQ processors (4 queues)
│       │   ├── cron/              # @nestjs/schedule jobs (9 schedules)
│       │   ├── cache/             # cache-manager wiring (Redis via Keyv)
│       │   ├── email/             # Mailpit / Resend transport switching + 16 React Email templates
│       │   ├── storage/           # Supabase Storage helpers + signed URLs
│       │   ├── audit/             # AuditService
│       │   ├── realtime/          # Socket.io gateway (Redis adapter)
│       │   ├── db/                # Drizzle client provider (DI)
│       │   ├── config/            # Zod-validated env schema
│       │   ├── health/            # GET /api/health probed by Caddy + PM2
│       │   └── lib/               # Helpers (date, errors, pagination)
│       ├── scripts/               # generate-openapi, reset-db, seed-db, run-ai-parse-corpus,
│       │                          # smoke-test-openai, generate-test-resumes
│       └── Dockerfile             # (Phase 2 — containerized API option)
├── packages/
│   ├── shared/                    # Zod schemas, enums, constants, auto-generated API client
│   │   ├── src/
│   │   │   ├── schemas/           # admin, applications, auth, bias, bias-requests,
│   │   │   │                      # companies, feedback, interviews, interview-venues,
│   │   │   │                      # jobs, notifications, offers, onboarding, parsed-resume,
│   │   │   │                      # score, shared
│   │   │   ├── enums/             # All shared enums (status types, roles, bands)
│   │   │   ├── constants/         # ai-limits, pagination, proactive-system, score-thresholds
│   │   │   ├── api-client/        # Generated by orval from openapi.json
│   │   │   ├── realtime/          # WS event types + payload contracts
│   │   │   ├── onboarding/        # Step shapes shared across both apps
│   │   │   ├── types/             # AuthUser, ApiError, Pagination
│   │   │   └── skills-taxonomy.ts # Canonical skills list (admin-editable in Phase 2)
│   │   ├── openapi.json           # Source of truth for client codegen
│   │   └── orval.config.ts
│   └── db/                        # Drizzle schema + RLS SQL
│       ├── src/
│       │   ├── schema.ts          # All 23 table definitions
│       │   ├── relations.ts
│       │   ├── enums.ts
│       │   ├── rls/all-policies.sql   # Single canonical RLS file
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
├── .github/workflows/
│   └── ci.yml                     # Format · type-check · lint · test
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

## Quick Start

If you already have a Supabase project, OpenAI key, and Docker running:

```bash
git clone https://github.com/cjjutba/aurahire-final.git
cd aurahire-final
pnpm install
docker compose -f docker-compose.dev.yml up -d
cp .env.example apps/web/.env.local
cp .env.example apps/api/.env
# Fill in apps/web/.env.local and apps/api/.env (see "Environment Variables")
pnpm --filter @aurahire/db drizzle-kit push                             # apply schema
# Paste packages/db/src/rls/all-policies.sql into Supabase SQL Editor → Run
pnpm --filter @aurahire/api seed-db                                     # default scoring config + admin user
pnpm dev                                                                # → http://localhost:3000 + http://localhost:3333/api/docs
```

---

## Getting Started (Detailed)

### Prerequisites

- **macOS, Linux, or WSL2 on Windows**
- **Node.js 20.x LTS** — `node --version` must report 20+
- **pnpm 9.12+** — `corepack enable && corepack prepare pnpm@9.12.3 --activate` (or `npm install -g pnpm@9`)
- **Docker Desktop** — must be running (Mailpit + Redis run as containers)
- **Git**
- A modern browser (Chrome 120+, Safari 17+, Firefox 121+, Edge 120+)
- Service accounts (all free tier sufficient for local dev):
  - **Supabase** — Postgres + Auth + Storage. Create a project at https://supabase.com
  - **Resend** — production email (Mailpit covers dev). Get an API key at https://resend.com
  - **OpenAI** — add $10–20 in billing credit for development at https://platform.openai.com

### One-time setup

```bash
# 1. Clone the repo
git clone https://github.com/cjjutba/aurahire-final.git
cd aurahire-final

# 2. Install workspace dependencies
pnpm install

# 3. Bring up local services (Mailpit + Redis)
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps   # both should show "healthy"

# 4. Copy the env template
cp .env.example apps/web/.env.local
cp .env.example apps/api/.env

# 5. Fill in real values in both env files (see "Environment Variables")

# 6. Push the Drizzle schema + RLS policies to Supabase (one-time)
pnpm --filter @aurahire/db drizzle-kit push
# Then paste packages/db/src/rls/all-policies.sql into:
#   Supabase Dashboard → SQL Editor → New query → Paste → Run

# 7. Seed the default scoring config + create an admin user
pnpm --filter @aurahire/api seed-db

# 8. Create a Supabase Storage bucket (one-time)
#    Dashboard → Storage → New bucket: "resumes" (private)
#    Dashboard → Storage → New bucket: "avatars" (public-read)
#    Dashboard → Storage → New bucket: "company-logos" (public-read)
```

### Daily development

```bash
# Start everything (frontend + backend) from the repo root
pnpm dev
```

`pnpm dev` runs `predev` first, which ensures Docker is up (`docker compose -f docker-compose.dev.yml up -d --wait`), then Turbo runs both apps in parallel with interleaved logs:

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
- **Drizzle Studio (optional):** `pnpm --filter @aurahire/db drizzle-kit studio` → opens https://local.drizzle.studio

Smoke test path: register a candidate → check Mailpit for the verification email → click the link → onboarding wizard → upload a real resume → review prefilled steps → see Profile Score with evidence.

---

## Environment Variables

Two env files are required. **Never commit either.**

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

### Env validation

Backend env vars are validated by a **Zod schema** in `apps/api/src/config/`. The process crashes at boot with a precise message if anything is missing or malformed — no silent fallback. The same schema is used by `deploy/deploy.sh` to gate production deploys: an env that wouldn't boot won't deploy.

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

| Command             | What it does                                                      |
| ------------------- | ----------------------------------------------------------------- |
| `pnpm dev`          | Boots Docker services (predev) and runs both apps with hot reload |
| `pnpm build`        | Builds frontend + backend via Turbo                               |
| `pnpm lint`         | ESLint on both apps                                               |
| `pnpm type-check`   | `tsc --noEmit` across all packages                                |
| `pnpm format`       | Prettier write across the repo                                    |
| `pnpm format:check` | Prettier check (CI gate)                                          |
| `pnpm dev:down`     | Stop the Mailpit + Redis containers                               |
| `pnpm clean`        | Remove `node_modules` and Turbo cache                             |

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
pnpm --filter @aurahire/shared codegen

# Database
pnpm --filter @aurahire/db drizzle-kit push      # apply schema to Supabase
pnpm --filter @aurahire/db drizzle-kit studio    # inspect DB in browser
pnpm --filter @aurahire/db drizzle-kit generate  # produce a migration
```

### Feature loop (vertical slice discipline)

When adding a new feature, work in this order:

1. Add or update the Zod schema in `packages/shared/src/schemas/`
2. If new entity, add the Drizzle table in `packages/db/src/schema.ts` and the RLS policy in `packages/db/src/rls/all-policies.sql`
3. Build the NestJS module under `apps/api/src/modules/<feature>/` (controller + service + repository + DTOs)
4. Add `AuditService` writes for every consequential mutation
5. Decorate controller methods for Swagger
6. Run `pnpm --filter @aurahire/api generate:openapi`
7. Run `pnpm --filter @aurahire/shared codegen` so orval regenerates TanStack Query hooks
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
  contact: {
    full_name,
    email,
    phone,
    location_city,
    location_country,
    linkedin_url,
    portfolio_url,
  },
  summary,
  education: [
    { institution, degree, field_of_study, start_year, end_year, gpa },
  ],
  experience: [
    {
      company,
      title,
      start_date,
      end_date,
      is_current,
      responsibilities,
      technologies_used,
    },
  ],
  skills,
  certifications,
  languages,
  parse_confidence: "high" | "medium" | "low",
});
```

If parsing times out or returns `parse_confidence: "low"`, the wizard falls back to manual entry — never a wall. Prompt versions: `parse-resume.ts` (v1), `parse-resume-v2.ts` (current default with stricter date normalization).

### 2. PII redaction (hybrid)

A **rule-based** pass nulls out `contact.full_name`, `contact.email`, `contact.phone`, and social URLs. An **LLM-assisted** pass (`redact-text.ts`, `redact-batch.ts`) scans free-text fields (summary, responsibilities) for residual names, pronouns, age references, and gender markers. The `redacted_fields` array is persisted on every score row so admins can prove redaction happened.

### 3. Profile Score

| Component          | Default Weight | Measures                                 |
| ------------------ | -------------- | ---------------------------------------- |
| Completeness       | 25             | Section coverage                         |
| Skill Depth        | 30             | Modernity + relevance to desired role    |
| Experience Clarity | 30             | Outcomes, technologies, duration clarity |
| Education Quality  | 15             | Degree match + certifications            |

Total 100. Every component returns `score`, `max`, `weight`, plain-language `explanation`, and 1–3 evidence excerpts with `relevance` (positive / negative / neutral). The engine also produces up to 3 improvement suggestions with estimated point impact.

### 4. Match Score

| Component               | Default Weight | Measures                                  |
| ----------------------- | -------------- | ----------------------------------------- |
| Skills Match            | 40             | Required-skill coverage + adjacent skills |
| Experience Match        | 35             | Years + seniority + role alignment        |
| Education Match         | 15             | Degree level + field relevance            |
| Cultural / Language Fit | 10             | Tone + soft-skill alignment               |

Output includes the breakdown, a one-paragraph summary, and optional `red_flags` (gaps) and `green_flags` (standout strengths). Bands: **Strong** (≥70), **Partial** (40–69), **Limited** (<40). Each `match_scores` row stores `weights_used` so historical scores stay interpretable even after admins re-tune.

### 5. Match Preview (background)

When a candidate uploads or changes their default resume, the `MATCH_PREVIEW_PRECOMPUTE_QUEUE` job recomputes Match Score chips for the **top-N most relevant active jobs** (default N = 5). The chips appear instantly when the candidate visits `/candidate/jobs` — no spinner, no synchronous AI cost on read paths.

### 6. Bias detection

Scans job descriptions for **gendered**, **age-coded**, **ableist**, and **exclusionary** language plus admin-defined custom terms. Triggers on description blur (debounced), on Save Draft, and on Publish. Publishing with unresolved flags requires the recruiter to supply a written reason that lands in `bias_flags.override_reason` and `audit_logs`.

### 7. Aggregate fairness monitor

SQL-only — no LLM cost. Surfaces flag counts, top flagged terms, override rate, score distribution, and recent override decisions to admins. Documented thesis tradeoff: we deliberately don't collect demographic labels (it contradicts the redaction philosophy), so we surface aggregate distributions rather than disparate-impact statistical tests.

### Prompt versioning

Every prompt is stored as `PARSE_RESUME_PROMPT_V1` style constants with a paired `*_VERSION` literal. Each score row records the version used. The thesis appendix is reconstructed from this audit trail.

### Evaluation harness

Run the curated AI parse corpus locally to catch regressions before tuning a prompt:

```bash
pnpm --filter @aurahire/api test:ai-parse
```

The script (`apps/api/scripts/run-ai-parse-corpus.ts`) iterates over a folder of real anonymized resumes and reports per-resume coverage, latency, and structural validity.

### Cost & rate limits

`gpt-4o-mini` with structured outputs is the default. Empirical per-call token budgets:

| Call                      | Avg input tokens | Avg output tokens | Avg latency |
| ------------------------- | ---------------- | ----------------- | ----------- |
| Parse resume              | ~2,500           | ~1,000            | 3–5 s       |
| Redact (LLM-assisted)     | ~1,200           | ~600              | 1–2 s       |
| Profile Score             | ~2,200           | ~1,200            | 3–4 s       |
| Match Score               | ~2,800           | ~1,400            | 4–6 s       |
| Bias detect (300-word JD) | ~600             | ~300              | 1–2 s       |

Throttler caps protect the budget — see [Security Model → Rate limiting](#rate-limiting). A `503` is returned (and the UI degrades to "Score temporarily unavailable") if OpenAI fails three times with backoff.

---

## Database Schema

23 tables across 6 functional groups, all with RLS enabled. Conventions: UUIDv4 PKs, `created_at` / `updated_at` on every row, JSONB for flexible structured data validated by Zod at write time, hard deletes only.

| Group              | Tables                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Identity**       | `profiles`, `candidate_profiles`, `recruiter_profiles`, `companies`, `company_members`, `auth_tokens`         |
| **Recruitment**    | `jobs`, `applications`, `interviews`, `interview_venues`, `offers`                                            |
| **Candidate Data** | `resumes`                                                                                                     |
| **AI / Scoring**   | `profile_scores`, `match_scores`, `match_score_previews`, `evidence_excerpts`, `bias_flags`, `scoring_config` |
| **Notifications**  | `notifications`, `notification_preferences`                                                                   |
| **System & Audit** | `audit_logs`, `feedback`                                                                                      |

### Key invariants

- `applications` is **unique on `(candidate_id, job_id)`** — one application per pair
- `match_scores` is **unique on `application_id`** — one score per application
- `match_score_previews` is **unique on `(candidate_id, job_id)`** — feed-chip caches
- `audit_logs` is append-only — no UPDATE / DELETE RLS policy from any role
- `scoring_config` has a **partial unique index on `is_active=true`** — exactly one active row at a time
- `bias_flags.status` evolves through `flagged → resolved | overridden`; overrides require `override_reason` (NOT NULL when status='overridden')
- `company_members` is **unique on `(company_id, user_id)`** — one membership per pair, role per company

### RLS philosophy

Policies are written by hand in `packages/db/src/rls/all-policies.sql` and applied via the Supabase SQL editor (not migrations, deliberately — so policies stay reviewable independently of schema). Every table that holds user data enforces:

- **Read:** `auth.uid()` must match `user_id` (or role must be admin / recruiter-with-ownership)
- **Write:** the same predicate plus column-level checks where needed
- **Delete:** restricted to owner or admin

See [docs/main/database-schema.md](docs/main/database-schema.md) for full column definitions, indexes, and RLS policy SQL.

---

## Background Jobs & Cron

### BullMQ queues (`apps/api/src/queue/`)

| Queue                      | Trigger                                                        | Job                                                                        |
| -------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `match-score`              | Async path of POST /applications (fallback when sync AI fails) | Compute the per-application Match Score and persist breakdown + evidence   |
| `match-preview-precompute` | Candidate resume change (insert/update/default flip)           | Recompute top-N match preview chips for the Jobs feed                      |
| `profile-score-recompute`  | Resume / preferences change                                    | Recompute Profile Score + evidence                                         |
| `rescore-batch`            | Admin "Re-score all" action in AI Config                       | Iterate active applications and enqueue per-application `match-score` jobs |

Workers run inside the same NestJS process for sprint scope; the architecture is ready for split workers (just point `BullModule.forRoot()` at the same Redis URL from another process).

### Cron schedules (`apps/api/src/cron/`)

All times are in the `Asia/Manila` timezone unless noted.

| Cron                          | Schedule              | Purpose                                                       |
| ----------------------------- | --------------------- | ------------------------------------------------------------- |
| `archive-past-deadline-jobs`  | Every midnight UTC    | Auto-archive jobs whose `deadline_at` has passed              |
| `cleanup-unverified-accounts` | Sunday 02:00 UTC      | Hard-delete unverified Supabase users older than 7 days       |
| `digest-email`                | Every day 08:00       | Send daily recruiter digest (new applications by job)         |
| `expire-offers`               | Top of every hour UTC | Mark offers past `expires_at` as `expired` + notify candidate |
| `offer-expiry-reminder`       | Top of every hour     | 24h-before-expiry reminder to candidate                       |
| `interview-reminder`          | Top of every hour     | Reminder email 24h before scheduled interview                 |
| `interview-autocomplete`      | Top of every hour     | Move past interviews from `scheduled` → `completed`           |
| `interview-feedback-due`      | Top of every hour     | Nudge recruiter to leave feedback for completed interviews    |
| `notifications-retention`     | Every day 03:00       | Prune notifications older than 90 days                        |

The admin can manually trigger any cron from `/admin/cron` (gated by `RolesGuard("admin")`) for debugging via `cron-admin.controller.ts`.

---

## Real-time

A NestJS Socket.io gateway (`apps/api/src/realtime/`) backed by a **Redis adapter** broadcasts events to authenticated clients. Each event payload is typed in `packages/shared/src/realtime/`.

### Event types

| Event                        | Direction       | Payload                                            |
| ---------------------------- | --------------- | -------------------------------------------------- |
| `notification.created`       | server → client | New notification (offer, interview, status change) |
| `application.status_changed` | server → client | Candidate's application moved to a new stage       |
| `interview.scheduled`        | server → client | Candidate received an interview                    |
| `offer.received`             | server → client | Candidate received an offer                        |
| `score.profile_updated`      | server → client | Profile Score recomputation completed              |
| `score.match_updated`        | server → client | Match Score recomputation completed                |

### Connection model

- **Authentication**: client sends the Supabase JWT as an `auth.token` field; gateway validates via the same `jose` JWKs check as the REST guards
- **Rooms**: every authenticated user joins `user:<uuid>`; recruiters also join `company:<uuid>`
- **Transport**: WebSocket only (no long-polling fallback) under Caddy with `read_timeout 0` on the `/socket.io/*` path
- **Redis adapter**: ready for horizontal scaling — adding a second API process requires no code change

The frontend uses `lib/realtime.ts` to manage the socket and `useEffect` cleanup. A toast pops on receipt and a badge increments on the topbar.

---

## Email System

All emails are JSX components in `apps/api/src/email/templates/` (React Email), rendered to HTML on send. Transport switches by `NODE_ENV`:

- **Development** — Nodemailer → Mailpit at `localhost:1025` (no real sends)
- **Production** — Resend SDK with verified `FROM_EMAIL` domain

### Templates (16 total)

| Template                     | Trigger                                            |
| ---------------------------- | -------------------------------------------------- |
| `verify-email`               | Registration                                       |
| `password-reset`             | Forgot password                                    |
| `application-received`       | Candidate applies                                  |
| `application-status-changed` | Recruiter moves applicant stage                    |
| `interview-scheduled`        | Recruiter schedules interview                      |
| `interview-rescheduled`      | Recruiter or candidate reschedules                 |
| `interview-cancelled`        | Either party cancels                               |
| `interview-reminder`         | Cron — 24h before                                  |
| `interview-feedback-shared`  | Recruiter records feedback                         |
| `offer-sent`                 | Recruiter sends offer                              |
| `offer-decision`             | Candidate accepts/declines                         |
| `offer-expired`              | Cron — past `expires_at`                           |
| `position-filled`            | Recruiter hires; sends to all remaining applicants |
| `team-invitation`            | Recruiter invites a teammate                       |
| `test-email`                 | Admin SMTP smoke test                              |
| `_brand-header`              | Shared header partial                              |

Every email uses the canonical AuraHire brand header partial (`_brand-header.tsx`) — centered logo, ink color, no em-dash punctuation per the recent copy pass.

---

## Caching Strategy

`@nestjs/cache-manager` with `cache-manager-redis-yet` (Keyv adapter) provides a typed cache facade. See [docs/main/caching-strategy.md](docs/main/caching-strategy.md) for the full matrix; highlights:

| Surface                          | TTL    | Invalidation                                    |
| -------------------------------- | ------ | ----------------------------------------------- |
| Public job listing (anon)        | 60 s   | Auto-expire (intentionally short)               |
| Job detail (anon)                | 5 min  | On `job.update` / `job.publish` / `job.archive` |
| Skills taxonomy (admin-editable) | 1 h    | On admin save                                   |
| User profile (`/profile/me`)     | 5 min  | On any profile mutation                         |
| Active scoring config            | 10 min | On admin save (replaces the active row)         |
| Match preview chips              | 24 h   | On resume change → enqueue precompute           |

Cache keys are namespaced: `aurahire:cache:<resource>:<id>`. Throttler state lives separately at `aurahire:throttle:*`.

---

## API Documentation

The backend ships an **auto-generated OpenAPI 3 spec** via `@nestjs/swagger`. Swagger UI is served at:

- **Local:** http://localhost:3333/api/docs
- **Production:** `https://<your-api-host>/api/docs`

The same spec is written to `packages/shared/openapi.json` on every backend build and consumed by `orval` to regenerate the TanStack Query hooks under `packages/shared/src/api-client/`. Frontend mutations use those generated hooks directly:

```tsx
"use client";
import { useApplyToJob } from "@aurahire/shared";

export function ApplyButton({ jobId, resumeId }: Props) {
  const apply = useApplyToJob({
    onSuccess: (data) => router.push(`/candidate/applications/${data.id}`),
  });
  return (
    <Button
      disabled={apply.isPending}
      onClick={() => apply.mutate({ jobId, resumeId })}
    >
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

| Status | Meaning                                                    |
| ------ | ---------------------------------------------------------- |
| 200    | OK (GET, PATCH, action)                                    |
| 201    | Created                                                    |
| 204    | No Content (DELETE)                                        |
| 400    | Zod validation failure                                     |
| 401    | Missing / invalid JWT                                      |
| 403    | Wrong role, no ownership, or missing active company        |
| 404    | Not found                                                  |
| 409    | Conflict (duplicate application, job already closed)       |
| 422    | Bias flags require override                                |
| 429    | Rate limited                                               |
| 503    | AI service down (graceful "Score temporarily unavailable") |

### Versioning

All routes live under `/api/v1`. Breaking changes increment the prefix and the previous version remains live for ≥30 days.

Full per-feature specs in [docs/main/technical-specifications.md](docs/main/technical-specifications.md).

---

## Security Model

### Authentication

- **Frontend** signs users in with `@supabase/ssr` (HTTP-only cookies, automatic refresh)
- **Backend** receives `Authorization: Bearer <jwt>` on every protected request
- `SupabaseAuthGuard` fetches Supabase JWKs (cached 24 h), verifies the JWT via `jose`, and attaches `req.user` typed as `AuthUser`
- `RolesGuard` checks `user.role` against the `@Roles('candidate' | 'recruiter' | 'admin')` decorator
- `ActiveCompanyGuard` ensures recruiter routes have a selected company in scope (skipped on `@SkipActiveCompany()` endpoints)
- `RequireCompanyRole('admin' | 'member')` for per-tenant role checks (e.g., only company admin can invite)
- Per-resource ownership is checked in services (e.g., "recruiter owns this job")
- Postgres RLS is the last word — even a buggy guard cannot reach unauthorized rows

### Secrets

| Secret                    | Where it lives                                                    |
| ------------------------- | ----------------------------------------------------------------- |
| Supabase anon key         | `apps/web/.env.local` (`NEXT_PUBLIC_*`, bundled to client — safe) |
| Supabase service role key | `apps/api/.env` only (server)                                     |
| OpenAI key                | `apps/api/.env` only                                              |
| Resend API key            | `apps/api/.env` only                                              |
| Postgres password         | `apps/api/.env` only                                              |
| Redis password (prod)     | `deploy/.env` only on the droplet, `chmod 600`                    |

### Rate limiting

`@nestjs/throttler` backed by Redis, configured per route:

| Endpoint                   | Limit                   |
| -------------------------- | ----------------------- |
| Auth (`login`, `register`) | 5 / 60 s per IP + email |
| Resume upload              | 5 / hour per user       |
| Score recompute            | 1 / 60 s per user       |
| Bias check during typing   | 10 / 60 s per user      |
| Default                    | 60 / 60 s per IP        |

### Transport

- **Frontend → Backend** over HTTPS (TLS terminated by Vercel and Caddy)
- **Backend → Postgres** over TLS (Supabase pooler)
- **Backend → Redis** over `127.0.0.1` (never on the public network)
- **Backend → OpenAI / Resend** over HTTPS

### Input safety

- All bodies validated by Zod (`nestjs-zod`)
- File uploads checked for MIME, size limit (5 MB), and magic bytes server-side
- Rich-text HTML sanitized on render
- Audit logs sanitize sensitive fields (no passwords, no tokens)

### Headers (Caddy + Helmet)

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- Server name stripped

---

## Multi-tenancy

A recruiter can belong to multiple companies via `company_members`. The model:

```
companies (1) ──── (N) company_members (N) ──── (1) recruiter_profiles
```

- Each recruiter has a **default company** picked at onboarding
- The frontend stores the **active company** in a React context (`contexts/active-company.tsx`) and includes it as a header on every API call
- Server-side, `ActiveCompanyGuard` reads the header, validates membership, and attaches `req.activeCompany`
- All recruiter writes (post job, invite, schedule interview, send offer) are scoped to the active company
- Admin company role (`company_admin`) can invite, change roles, and delete the company; `member` cannot
- An admin can drill into any company from `/admin/companies` without joining it

This is the seed for a future "Agencies" feature (one recruiter, many client companies) without retrofitting.

---

## Roles & Capabilities

| Capability                                  | Candidate                           | Recruiter          | Admin           |
| ------------------------------------------- | ----------------------------------- | ------------------ | --------------- |
| Register + complete onboarding              | ✅ (6 steps)                        | ✅ (3 steps)       | seeded          |
| Upload resumes, set default                 | ✅                                  | —                  | —               |
| Compute Profile Score                       | ✅ (rate-limited 1/60 s)            | —                  | —               |
| Browse public jobs                          | ✅                                  | ✅                 | ✅              |
| Apply to a job (synchronous Match Score)    | ✅                                  | —                  | —               |
| Withdraw application                        | ✅                                  | —                  | —               |
| Receive real-time notifications             | ✅                                  | ✅                 | ✅              |
| Post / edit / archive jobs                  | —                                   | ✅ (own jobs)      | ✅ (all)        |
| Bias check on description                   | —                                   | ✅ (auto + manual) | —               |
| Override bias flag with reason              | —                                   | ✅                 | —               |
| View applications to a job                  | —                                   | ✅ (own jobs)      | ✅ (all)        |
| See full Score Breakdown + evidence         | ✅ (own)                            | ✅ (own jobs)      | ✅ (all)        |
| Update application status                   | —                                   | ✅ (own jobs)      | ✅              |
| Schedule interview / record feedback        | —                                   | ✅                 | ✅              |
| Manage interview venues                     | —                                   | ✅ (per-company)   | —               |
| Send offer / accept-decline                 | recruiter sends, candidate responds | ✅                 | ✅              |
| Manage team members per company             | —                                   | ✅ (company admin) | ✅              |
| Suspend / delete users                      | —                                   | —                  | ✅              |
| Moderate jobs / archive                     | —                                   | —                  | ✅              |
| Tune AI scoring weights                     | —                                   | —                  | ✅              |
| Preview weight impact against last 100 apps | —                                   | —                  | ✅              |
| Trigger batch re-score                      | —                                   | —                  | ✅ (BullMQ job) |
| Read audit log                              | —                                   | —                  | ✅              |
| View Bias & Fairness Monitor                | —                                   | —                  | ✅              |
| Read system analytics                       | —                                   | —                  | ✅              |
| Review user feedback submissions            | —                                   | —                  | ✅              |

---

## Page Inventory

80+ distinct routes across six surfaces. See [docs/main/page-inventory.md](docs/main/page-inventory.md) for ASCII layouts of every page.

| Surface        | Routes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Auth                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **Marketing**  | `/`, `/jobs`, `/jobs/[id]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Public                          |
| **Auth**       | `/login`, `/register`, `/register/candidate`, `/register/recruiter`, `/forgot-password`, `/reset-password`, `/verify-email`, `/verify-email/sent`                                                                                                                                                                                                                                                                                                                                                                               | Public                          |
| **Onboarding** | Candidate (`start`, `personal`, `review`, `preferences`, `analyzing` → result) · Recruiter (`start`, `company-create`, `focus`) · `invite/[token]`                                                                                                                                                                                                                                                                                                                                                                              | Authed, pre-onboarded           |
| **Candidate**  | `/candidate`, `/candidate/jobs`, `/candidate/jobs/[id]`, `/candidate/jobs/[id]/apply`, `/candidate/applications`, `/candidate/applications/[id]`, `/candidate/interviews`, `/candidate/interviews/[id]`, `/candidate/profile`, `/candidate/resume`, `/candidate/settings` (profile, security, notifications, privacy), `/candidate/help`, `/candidate/how-it-works`                                                                                                                                                             | Candidate role                  |
| **Recruiter**  | `/recruiter`, `/recruiter/jobs`, `/recruiter/jobs/new`, `/recruiter/jobs/[id]`, `/recruiter/jobs/[id]/edit`, `/recruiter/jobs/[id]/applications`, `/recruiter/applications/[id]`, `/recruiter/shortlist`, `/recruiter/interviews`, `/recruiter/interviews/[id]`, `/recruiter/offers`, `/recruiter/offers/new`, `/recruiter/analytics`, `/recruiter/settings` (profile, company, interview-venues, members, scoring, bias, integrations, notifications, security, privacy, danger), `/recruiter/help`, `/recruiter/how-it-works` | Recruiter role + active company |
| **Admin**      | `/admin`, `/admin/users`, `/admin/jobs`, `/admin/applications`, `/admin/companies`, `/admin/ai-config`, `/admin/audit`, `/admin/analytics`, `/admin/bias-monitor`, `/admin/feedback`, `/admin/help`, `/admin/how-it-works`                                                                                                                                                                                                                                                                                                      | Admin role                      |
| **Legal**      | `/legal/terms`, `/legal/privacy`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Public                          |

Every page ships with explicit **loading**, **error**, and **empty** states. Mobile responsiveness collapses portal sidebars to drawers, tables to vertically stacked cards, and the layered Score Ring mockups to a single card.

---

## Design System

The brand voice is **institutional, AI-forward, editorial calm** — single accent color (`#2563eb` AuraHire Blue), display weight at 400 (never 700+), pill-geometry CTAs, full-bleed dark editorial heroes with layered Score Ring + Breakdown Bar mockup cards.

Read these before building UI:

- [DESIGN.md](DESIGN.md) — the brand design summary at repo root
- [docs/main/design-system.md](docs/main/design-system.md) — canonical token definitions
- [docs/main/ui-patterns.md](docs/main/ui-patterns.md) — every component, variants, signature patterns

### Tokens at a glance

- **Color:** AuraHire Blue (`#2563eb`) for primary CTAs, wordmark, score-progress fill, focus rings — _used scarcely_. Surfaces are white / soft gray / surface-strong / surface-dark. Scoring semantics are red (`<40`) / amber (`40–69`) / green (`≥70`), used only inside Score Ring fill, Breakdown Bar segments, and inline match labels.
- **Typography:** Inter Display (weight 400) for hero headlines, Inter (400 / 500 / 600) for body and UI, JetBrains Mono (weight 500) for every numeric value.
- **Geometry:** `rounded-pill` (100 px) for every CTA, `rounded-full` for avatars and score glyphs, `rounded-xl` (24 px) for marketing cards, `rounded-lg` (16 px) for portal cards.
- **Spacing:** 96 px section rhythm for marketing, 32 px for portal surfaces. Base unit 4 px.
- **Elevation:** flat (80% of surfaces), hairline border, one soft drop tier, modal tier. No multiple shadow tiers.

### Signature pattern

A **dark editorial hero** with floating Score Ring + Breakdown Bar mockup cards is the most distinctive component. See `apps/web/components/score/` for the actual implementation.

---

## Performance & Scaling

### Frontend

- **Streaming SSR** — Server Components stream from the edge; client islands hydrate on demand
- **Per-route bundles** — App Router code-splits automatically per route group
- **TanStack Query** — stale-while-revalidate semantics; default `staleTime: 60s`, `gcTime: 5min`
- **Turbopack dev** — fast HMR; Webpack-free `next dev --turbo`
- **Vercel edge caching** — for static pages (marketing) and ISR where used

### Backend

- **Fastify adapter** — ~2x req/sec over Express on equivalent hardware
- **Connection pooling** — Postgres pooler on port `6543` (transaction mode); pool size tuned per droplet vCPU count
- **Redis-backed cache + throttler + queue** — single Redis instance with `maxmemory 256mb` and `allkeys-lru` eviction
- **Async AI fallback** — if synchronous match scoring exceeds the 30 s ceiling, the request returns a "computing…" state and a BullMQ job finishes the work; the WebSocket pushes the result back to the candidate
- **Health check** — `GET /api/health` returns `{ status, uptime, version }`, probed every 30 s by Caddy and PM2

### Targets (Sprint 1, single 2 vCPU / 2 GB droplet)

| Metric                                         | Target     |
| ---------------------------------------------- | ---------- |
| **Frontend TTI (homepage, 4G)**                | < 2.5 s    |
| **API p50 latency (CRUD)**                     | < 80 ms    |
| **API p95 latency (CRUD)**                     | < 250 ms   |
| **Resume parse end-to-end**                    | < 8 s p95  |
| **Match Score end-to-end (sync)**              | < 10 s p95 |
| **Concurrent users (single droplet)**          | 100–200    |
| **Daily active applications (single droplet)** | ~5,000     |

### Scaling out

The architecture is ready for horizontal scaling without code changes:

- **Frontend** — Vercel auto-scales
- **API** — Redis adapter on the WebSocket gateway lets you run N backend processes behind a load balancer; PM2 cluster mode is one flag away (`exec_mode: "cluster", instances: "max"` in `ecosystem.config.cjs`)
- **Database** — Supabase scales the Postgres tier on demand
- **Workers** — BullMQ workers can run in separate processes / hosts (point them at the same Redis URL)

---

## Accessibility & Browser Support

- **WCAG 2.1 AA target.** Color contrast on every text-on-surface combination meets 4.5:1 (AAA on key surfaces).
- **Keyboard navigation.** Every interactive element is reachable; focus rings are visible (2px AuraHire Blue).
- **Screen readers.** Semantic HTML, proper `aria-*` on Radix primitives, evidence callouts announced as quotes.
- **Touch targets.** Primary CTAs at 44px, hero CTAs at 56px — meets / exceeds WCAG AAA.
- **Motion.** Animations respect `prefers-reduced-motion` (Score Ring fill, AI shimmer, modal enter).
- **Forms.** All inputs labeled; error messages associated via `aria-describedby`.

### Browser matrix

| Browser           | Minimum |
| ----------------- | ------- |
| Chrome / Chromium | 120     |
| Safari            | 17      |
| Firefox           | 121     |
| Edge              | 120     |
| iOS Safari        | 17      |
| Android Chrome    | 120     |

Legacy IE / older Safari are not supported. Service-worker offline mode is a Phase 2 enhancement.

---

## Internationalization

The current sprint ships **English-only**. The architecture is i18n-ready:

- All user-facing strings live in component code (not hard-coded in JSON yet — this is the explicit choice for thesis defense clarity)
- Date / time / number formatting goes through `Intl.*` APIs, not a stringifier
- All forms / validation messages come from Zod schemas — a single point to swap to `next-intl` in Phase 2
- The schema `language` field on `candidate_profiles` and `jobs` is captured but not currently used to filter UI

Adding a locale = wrap the root layout in `next-intl`, extract strings into messages catalogs, and swap `Intl.DateTimeFormat()` defaults. No table schema changes required.

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

#### Rollback

```bash
# As deploy@<DROPLET>
cd /home/deploy/aurahire
git log --oneline -n 10               # find a known-good SHA
git checkout <good-sha>                # detached HEAD is fine
pnpm install --frozen-lockfile
pnpm --filter @aurahire/api build
pm2 reload aurahire-api --update-env
```

The DB schema is forward-only — schema rollback requires a new migration that explicitly undoes the change.

---

## Testing

| Layer                   | Tool                                    | Where                                       |
| ----------------------- | --------------------------------------- | ------------------------------------------- |
| **Static**              | TypeScript strict mode + Zod            | Every package                               |
| **Backend unit**        | Jest (`ts-jest`)                        | `apps/api/src/**/*.spec.ts`                 |
| **Backend AI corpus**   | Custom runner over curated resumes      | `apps/api/scripts/run-ai-parse-corpus.ts`   |
| **Backend integration** | Jest with a live Supabase dev project   | per-feature `*.integration.spec.ts`         |
| **Frontend unit**       | Vitest + Testing Library                | `apps/web/**/*.test.{ts,tsx}`               |
| **Frontend E2E**        | Playwright                              | `apps/web/e2e/`                             |
| **Smoke**               | `apps/api/scripts/smoke-test-openai.ts` | Validates the OpenAI key + model end-to-end |
| **CI gate**             | GitHub Actions                          | `.github/workflows/ci.yml`                  |

```bash
# All checks at once
pnpm format:check && pnpm type-check && pnpm lint && \
  pnpm --filter @aurahire/api test && pnpm --filter @aurahire/web test
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

Concurrency is set to **cancel-in-progress per PR ref** so a push supersedes any in-flight run.

### E2E coverage (Playwright)

- `onboarding-happy-pdf.spec.ts` — PDF resume → parse → review → preferences → Profile Score
- `onboarding-happy-docx.spec.ts` — DOCX resume → same path
- `onboarding-skip.spec.ts` — Skip parse → manual entry → Profile Score
- `onboarding-reupload.spec.ts` — Re-upload mid-flow rewires the score
- `onboarding-mobile.spec.ts` — Mobile viewport flow
- `proactive-system-notification-roundtrip.spec.ts` — WS notification arrives in real time
- `proactive-system-onboarding.spec.ts` — System nudge surfaces on home

---

## Observability

### Logs

- **Frontend** — Pino-formatted logs ingested by Vercel
- **Backend** — `nestjs-pino` writes structured JSON to stdout, captured by PM2 into rotating log files (`/home/deploy/.pm2/logs/aurahire-api-*.log`)
- **Caddy** — JSON access log at `/var/log/caddy/access.log`, 10 MB rotation × 5 keep
- **Request ID** — every API response carries `meta.requestId`; the same value lands in the audit log row for that request

### Audit trail

The `audit_logs` table is the first-class observability surface for the thesis: every consequential action by every actor (user / system / AI) is captured with `actor_id`, `actor_type`, `action`, `entity_type`, `entity_id`, `details` (JSONB), `ip_address`, and `user_agent`. Admins query and export it from `/admin/audit` (filterable by actor, entity, action, date range; CSV export).

### Health

- `GET /api/health` — uptime + version
- PM2 status: `pm2 status`, `pm2 logs aurahire-api`, `pm2 monit`
- Caddy status: `sudo systemctl status caddy`

### Production hardening (Phase 2 roadmap)

- Sentry for error tracking
- PostHog for product analytics
- OpenTelemetry traces with Honeycomb / Tempo backend
- GitHub Actions deploy workflow gated on `needs: validate` (CI green) — a one-line addition once the deploy is fully automated

---

## Project Documentation

The single source of truth for every architectural and product decision lives in `docs/main/`. Read these before changing related code.

| Doc                                                                  | Scope                                                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [prd.md](docs/main/prd.md)                                           | Product requirements, sprint scope, deferred features, acceptance criteria, demo path |
| [architecture.md](docs/main/architecture.md)                         | System architecture, request lifecycles, layered defense, decision log                |
| [tech-stack.md](docs/main/tech-stack.md)                             | Every dependency with rationale and version                                           |
| [project-structure.md](docs/main/project-structure.md)               | Monorepo layout, file naming, where to put new code                                   |
| [database-schema.md](docs/main/database-schema.md)                   | All 23 tables, indexes, RLS policy SQL                                                |
| [ai-design.md](docs/main/ai-design.md)                               | Prompts, structured-output schemas, redaction, evaluation, prompt versioning          |
| [technical-specifications.md](docs/main/technical-specifications.md) | Per-endpoint request / response / validation / side-effect / edge-case specs          |
| [best-practices.md](docs/main/best-practices.md)                     | Engineering standards (NestJS + Next.js + monorepo discipline)                        |
| [design-system.md](docs/main/design-system.md)                       | Tokens (canonical)                                                                    |
| [ui-patterns.md](docs/main/ui-patterns.md)                           | Every component, variants, signature patterns                                         |
| [page-inventory.md](docs/main/page-inventory.md)                     | Every route, ASCII layout, edge states                                                |
| [sprint-plan.md](docs/main/sprint-plan.md)                           | Day-by-day sprint slices with definitions of done                                     |
| [caching-strategy.md](docs/main/caching-strategy.md)                 | Cache surfaces, TTLs, invalidation rules                                              |
| [env-setup.md](docs/main/env-setup.md)                               | First-time local dev setup + production deploy                                        |

### Root-level reference docs

| File                   | Scope                                             |
| ---------------------- | ------------------------------------------------- |
| [AGENTS.md](AGENTS.md) | Agent rules including the Next.js 16 caveat       |
| [CLAUDE.md](CLAUDE.md) | Claude Code project instructions + hard "do nots" |
| [DESIGN.md](DESIGN.md) | Brand design summary (editorial reference)        |

---

## Operational Runbook

### Common dev tasks

```bash
# Inspect the database in your browser
pnpm --filter @aurahire/db drizzle-kit studio

# Regenerate the typed API client (after a backend controller change)
pnpm --filter @aurahire/api generate:openapi
pnpm --filter @aurahire/shared codegen

# Run the AI parsing corpus
pnpm --filter @aurahire/api test:ai-parse

# Reset the dev DB (destructive — only on dev project)
pnpm --filter @aurahire/api reset-db

# Re-seed the default admin + scoring config
pnpm --filter @aurahire/api seed-db

# Tail logs from local services
docker compose -f docker-compose.dev.yml logs -f mailpit
docker compose -f docker-compose.dev.yml logs -f redis
```

### Production tasks (on the droplet, as `deploy`)

```bash
# Tail API logs
pm2 logs aurahire-api

# Restart API (zero-downtime reload)
bash /home/deploy/aurahire/deploy/deploy.sh

# Inspect Caddy access logs
sudo tail -f /var/log/caddy/access.log | jq

# Verify Redis health
docker exec aurahire-redis redis-cli -a "$REDIS_PASSWORD" ping

# Inspect Mailpit (tunnel to localhost first)
ssh -L 8025:localhost:8025 deploy@<DROPLET_IP>
# open http://localhost:8025 in your browser

# Inspect BullMQ queues (via redis-cli)
docker exec aurahire-redis redis-cli -a "$REDIS_PASSWORD" KEYS 'bull:*'
```

### Recovery procedures

| Symptom                                | Investigation                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `pnpm dev` only starts one app         | Check `turbo.json` has `dev` with `persistent: true`; verify both apps have a `dev` script                               |
| Backend can't reach Postgres           | Confirm `DATABASE_URL` uses pooler port `6543`; password URL-encoded                                                     |
| Frontend can't reach backend           | Confirm `NEXT_PUBLIC_API_URL`; confirm backend `ALLOWED_ORIGINS` includes the frontend URL                               |
| Mailpit not catching emails            | `docker compose -f docker-compose.dev.yml ps`; verify `NODE_ENV=development`, `SMTP_HOST=localhost`, `SMTP_PORT=1025`    |
| Redis connection refused               | Container up? `docker exec aurahire-redis redis-cli ping` → `PONG`                                                       |
| RLS blocking a query                   | The service role client bypasses RLS for system ops; check the right Supabase client is being used                       |
| Resume parsing fails                   | OpenAI billing balance? Check `apps/api` logs for the parse attempt; run `pnpm --filter @aurahire/api smoke-test-openai` |
| Production deploy fails env validation | `deploy/deploy.sh` lists exactly which env key was wrong — fix `apps/api/.env` on the droplet                            |
| WebSocket not connecting in production | Verify Caddyfile has the `/socket.io/*` matcher with `read_timeout 0`; verify the frontend URL is in `ALLOWED_ORIGINS`   |
| Cron job didn't fire                   | Server in UTC? Most crons use `Asia/Manila` timezone — confirm `TZ` env on the droplet                                   |

---

## Troubleshooting

### "Module not found: @aurahire/shared"

Run `pnpm install` from the repo root, not from a subdirectory. Workspace links are created at root install time.

### Type errors after editing a Zod schema

Regenerate types:

```bash
pnpm --filter @aurahire/api generate:openapi
pnpm --filter @aurahire/shared codegen
pnpm type-check
```

### "OPENAI_API_KEY is not set" on backend start

Confirm `apps/api/.env` exists and has `OPENAI_API_KEY=sk-proj-...`. The env validator crashes early with the missing key name.

### Drizzle push complains about missing extensions

Some tables use `pgcrypto`. Enable it once via Supabase Dashboard → Database → Extensions → `pgcrypto` → Enable.

### "JWT expired" on every API call

Your local Supabase session expired. Sign out and sign back in via the UI; the cookie refreshes automatically thereafter.

### Mobile keyboard covering the input on iOS Safari

Tested. The wizard scrolls focused input into view via `scrollIntoView({ block: 'center' })` in `useEffect`. If you see it regress, check `apps/web/components/onboarding/`.

---

## Roadmap

The current sprint scope is locked in `docs/main/sprint-plan.md`. Beyond Sprint 1, the following are explicitly deferred:

### Phase 2 — Polish

- Sentry error tracking + PostHog product analytics + OpenTelemetry traces
- GitHub Actions deploy workflow gated on CI green
- Internationalization (English → English + Filipino + Tagalog)
- Service-worker offline mode for the candidate dashboard
- Real-time recruiter ↔ candidate chat (post-offer stage)
- Calendar integration (Google + Outlook) for interviews
- Recruiter scheduling links (BYOL — bring your own link)

### Phase 3 — Beyond thesis scope

- Agencies (one recruiter, many client companies — schema is already ready via `company_members`)
- Job board syndication (LinkedIn, Indeed crosspost)
- Candidate referrals + leaderboards
- Skills assessments (in-app coding / writing tests)
- AI-assisted interview note transcription with diarization
- Saved searches + email job alerts
- Per-tenant branded subdomains
- Public scoring API (rate-limited tier for academic researchers)

---

## Contributing

This repo is a thesis project, so external contributions are not actively solicited. If you fork or borrow patterns:

1. Respect the architecture — the frontend/backend split is load-bearing for the security model
2. Keep the discipline — structured AI outputs, PII redaction, audit logs, RLS on every table
3. Read the relevant doc in `docs/main/` before changing related code
4. Run the full validation chain locally before opening a PR: `pnpm format:check && pnpm type-check && pnpm --filter @aurahire/api test && pnpm --filter @aurahire/web test`
5. CI will gate the merge on `main`

### Commit style

Conventional commits flavor (`feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `perf`, `ci`, `style`) with optional scope:

```
feat(scoring): exclude already-applied jobs from Recommended feed
fix(jobs): excludeApplied was hidden-on by default
docs(readme): rewrite as comprehensive, production-ready project guide
refactor(offers): align Send Offer page with Post Job layout
chore(deps): bump next from 16.2.3 to 16.2.4
```

### Branch model

- `main` — protected, always deployable; CI required before merge
- `dev` — integration branch for non-blocking experimentation
- `feat/*` / `fix/*` / `docs/*` — short-lived feature branches PR'd into `main`

### Pull request expectations

- Linked to a `docs/main/` spec where applicable
- Includes screenshots for any visible UI change
- Updates docs in the same PR if behavior changes
- Lists manual QA steps tried (the human cannot rely on AI to test the UI)

---

## Security Policy

If you discover a security vulnerability:

1. **Do not** open a public GitHub issue
2. Email `cjjutbaofficial@gmail.com` with the subject line `AuraHire Security Disclosure`
3. Include a proof-of-concept where safe to share
4. Expect a response within 72 hours

The author commits to:

- Acknowledging your report within 72 hours
- Investigating within 7 days
- Coordinating a fix and disclosure timeline
- Crediting you in the changelog if you wish

This is a thesis project, not a vendor product — there is no formal bug bounty, but responsible disclosures will be acknowledged in the academic appendix.

---

## Code of Conduct

This is a small, single-author thesis project. The expectation for anyone collaborating, reading code, or filing issues is simple: act with academic and professional integrity. Don't harass, don't plagiarize, don't ship code without understanding it.

---

## Glossary

| Term                    | Definition                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| **Profile Score**       | A candidate's overall resume quality score (0–100), independent of any job                      |
| **Match Score**         | A score for a specific candidate ↔ job pair (0–100)                                             |
| **Match Preview**       | A cached Match Score chip shown on the Jobs feed without recomputation                          |
| **Component breakdown** | The structured per-component view that backs every score (weight + evidence)                    |
| **Evidence excerpt**    | A verbatim 1–3 sentence quote from the resume that supports a score component                   |
| **Bias flag**           | A piece of job-description text the AI flagged as gendered / age-coded / ableist / exclusionary |
| **Override reason**     | Free-text explanation a recruiter provides when shipping despite a bias flag                    |
| **Active company**      | The currently selected tenant for a recruiter; recruiter writes are scoped to it                |
| **RLS**                 | Row-Level Security — Postgres-level access policies enforced per role                           |
| **Structured output**   | OpenAI's mode that constrains a model's response to a JSON schema                               |
| **Vertical slice**      | A change that touches schema → backend → shared types → frontend → docs                         |
| **Audit log**           | Append-only table capturing every consequential action, with actor + entity                     |
| **Score band**          | Strong (≥70) / Partial (40–69) / Limited (<40) — the plain-language label                       |

---

## FAQ

**Why split frontend and backend instead of using Next.js Server Actions?**
The security and observability properties of the system depend on a hard boundary. Server Actions blur the boundary; a NestJS backend makes the guard / role / audit / RLS chain inspectable and testable independently.

**Why Drizzle instead of Prisma?**
Drizzle's query builder is closer to SQL, which matters when you're writing RLS-aware queries and explaining them in a thesis appendix. The schema TypeScript is also a single source of truth for the types consumed by both apps.

**Why is OpenAI the only AI provider?**
Sprint scope. The structured-output capability is uniformly excellent on `gpt-4o-mini` and the cost is predictable. Adding Anthropic or a local model is one service swap in `apps/api/src/ai/openai.service.ts` — every consumer goes through that facade.

**Why no Vercel KV / Upstash?**
A single Redis container on the same droplet keeps the architecture inspectable and the latency to single-digit ms. Managed Redis is a one-line swap if you ever outgrow it.

**Why Mailpit in dev?**
A real inbox-style SMTP catcher with a web UI beats console logs for verifying email content and link previews. Resend in production keeps deliverability simple.

**Why does the Caddyfile have a 60s read timeout?**
Resume parsing and AI scoring legitimately take 3–8s; AI fallbacks can push toward 15s. 60s is generous without masking a real upstream hang.

**Can I deploy the backend to Vercel / Railway / Render?**
Yes. The backend is a stateless NestJS app — it runs anywhere Node 20 runs. The DO Droplet choice is a thesis defense decision (every moving part visible). To deploy on Vercel Functions, you'd need to move Redis off-host (Upstash) and the BullMQ workers to a separate runtime.

**Why a thesis project on GitHub?**
Transparency. The thesis is about explainable AI; the code should be inspectable too.

---

## License

Proprietary — © 2026 CJ Jutba. All rights reserved.

This project is the implementation artifact for the thesis **"Explainable and Fair AI-Powered Recruitment: A Transparent Resume Scoring Platform with Bias Mitigation."** Code, design, schemas, prompts, and documentation are provided here for academic review and demonstration. Reuse without explicit written permission is not authorized.

For academic citation:

> Jutba, C. J. (2026). _AuraHire: Explainable and Fair AI-Powered Recruitment — A Transparent Resume Scoring Platform with Bias Mitigation._ Unpublished thesis source code, repository: https://github.com/cjjutba/aurahire-final.

---

## Acknowledgements

- **Supabase** — Postgres, Auth, and Storage on a generous free tier
- **Vercel** — Next.js hosting with preview URLs that make every PR demoable
- **Digital Ocean** — a transparent, inspectable Droplet that fits the thesis story
- **OpenAI** — `gpt-4o-mini` for structured outputs at thesis-scale cost
- **Resend** — production transactional email
- **Mailpit** — local SMTP catcher that makes dev email a one-click inbox
- **The Next.js, NestJS, Drizzle, shadcn/ui, Radix, TanStack, Tiptap, Recharts, Lucide, BullMQ, and Pino teams** — for the open-source primitives this system is built on
- **Reviewers, classmates, and faculty advisors** — for the early read-throughs that surfaced gaps and sharpened the thesis claim

---

## Author & Contact

**CJ Jutba**
Thesis author, sole developer, system operator
Email: `cjjutbaofficial@gmail.com`
GitHub: [@cjjutba](https://github.com/cjjutba)

Built as a thesis defense of explainable, fair AI in hiring. If you read this far — thank you.

<div align="center">

—

_AuraHire — Hire fairly. Hire transparently. Hire faster._

</div>
