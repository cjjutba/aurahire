# AuraHire Project Structure

**Version:** 2.0.0 (Monorepo)
**Last Updated:** May 1, 2026
**Status:** Locked for Sprint
**Depends on:** `tech-stack.md`, `architecture.md`

This document defines the canonical folder layout for the AuraHire monorepo, file naming conventions, and where to place new code.

---

## Top-Level Layout

```
aurahire/
├── apps/                         # Deployable applications
│   ├── web/                      # Next.js 16 frontend (Vercel)
│   └── api/                      # NestJS backend (Digital Ocean Droplet, PM2)
├── packages/                     # Shared libraries
│   ├── shared/                   # Zod schemas, enums, constants, API client
│   └── db/                       # Drizzle schema + types
├── docs/                         # Documentation
│   └── main/                     # Project docs (PRD, architecture, etc.)
├── emails/                       # Reserved (templates live in apps/api/src/email/templates/)
├── node_modules/                 # pnpm-managed
├── .env.example                  # Template - copied per-app to apps/web/.env.local + apps/api/.env
├── .gitignore
├── AGENTS.md                     # Agent rules (Next.js 16 warning + monorepo rules)
├── CLAUDE.md                     # Claude Code project instructions
├── DESIGN.md                     # Brand design summary (root reference)
├── README.md                     # Project README
├── docker-compose.dev.yml        # Local dev services: Mailpit (SMTP catcher) + Redis (cache/queue/throttle)
├── package.json                  # Root workspace + scripts
├── pnpm-workspace.yaml           # pnpm workspace declaration
├── pnpm-lock.yaml                # pnpm lockfile
├── turbo.json                    # Turborepo task graph
└── tsconfig.base.json            # Base TS config extended by each app/package
```

---

## Root Configuration Files

### `package.json` (root)

```json
{
  "name": "aurahire",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "type-check": "turbo type-check",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,md,json}\""
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "prettier": "^3.0.0",
    "prettier-plugin-tailwindcss": "^0.6.0",
    "typescript": "^5.4.0"
  }
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true,
      "dependsOn": ["^build"]
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "lint": {},
    "type-check": {
      "dependsOn": ["^build"]
    }
  }
}
```

### `tsconfig.base.json`

Common compiler options extended by each app/package's `tsconfig.json`.

---

## `apps/web/` - Next.js Frontend

```
apps/web/
├── app/                          # Next.js App Router
│   ├── (public)/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # /
│   │   ├── about/page.tsx
│   │   ├── jobs/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── contact/page.tsx
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── register/
│   │   │   ├── page.tsx
│   │   │   ├── candidate/page.tsx
│   │   │   └── recruiter/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   └── verify-email/
│   │       ├── page.tsx
│   │       └── sent/page.tsx
│   ├── (onboarding)/
│   │   ├── layout.tsx
│   │   ├── candidate/
│   │   │   ├── page.tsx
│   │   │   ├── personal/page.tsx
│   │   │   ├── education/page.tsx
│   │   │   ├── experience/page.tsx
│   │   │   ├── skills/page.tsx
│   │   │   ├── preferences/page.tsx
│   │   │   └── result/page.tsx
│   │   └── recruiter/
│   │       ├── page.tsx
│   │       ├── company/page.tsx
│   │       └── focus/page.tsx
│   ├── (candidate)/
│   │   ├── layout.tsx
│   │   └── candidate/
│   │       ├── page.tsx          # /candidate dashboard
│   │       ├── jobs/...
│   │       ├── applications/...
│   │       ├── interviews/page.tsx
│   │       ├── profile/page.tsx
│   │       ├── resume/page.tsx
│   │       └── settings/page.tsx
│   ├── (recruiter)/
│   │   ├── layout.tsx
│   │   └── recruiter/
│   │       ├── page.tsx
│   │       ├── jobs/...
│   │       ├── applications/[id]/page.tsx
│   │       ├── candidates/[id]/page.tsx
│   │       ├── shortlist/page.tsx
│   │       ├── interviews/page.tsx
│   │       ├── offers/new/page.tsx
│   │       ├── analytics/page.tsx
│   │       └── settings/page.tsx
│   ├── (admin)/
│   │   ├── layout.tsx
│   │   └── admin/
│   │       ├── page.tsx
│   │       ├── users/page.tsx
│   │       ├── jobs/page.tsx
│   │       ├── applications/page.tsx
│   │       ├── ai-config/page.tsx
│   │       ├── audit/page.tsx
│   │       ├── analytics/page.tsx
│   │       └── bias-monitor/page.tsx
│   ├── globals.css               # Tailwind + @theme tokens
│   ├── layout.tsx                # Root layout (font, metadata)
│   ├── not-found.tsx
│   ├── error.tsx
│   └── icon.tsx                  # Favicon
├── components/
│   ├── ui/                       # shadcn primitives
│   ├── layout/                   # Marketing nav, portal sidebar/topbar/footer, breadcrumb
│   ├── auth/                     # Login form, register forms, etc.
│   ├── onboarding/               # Wizard shell + step components
│   ├── jobs/                     # Job card, form, detail, bias check panel
│   ├── applications/             # Application card, detail, pipeline
│   ├── score/                    # Score Ring, Breakdown Bar, Evidence Callout, Match Band Chip
│   ├── bias/                     # Bias flag chip + popover + list
│   ├── ai/                       # AI Shimmer, AI Suggested badge
│   ├── interviews/               # Interview card, schedule form
│   ├── offers/                   # Offer form, preview, status card
│   ├── admin/                    # KPI tile, tables, charts, AI config form
│   ├── shared/                   # Empty state, error state, stat card, status chip, search pill, data table, confirm dialog
│   └── icons/                    # AuraHire wordmark + custom SVG
├── lib/
│   ├── auth/                     # Supabase client (browser + server) + session helpers
│   ├── api/                      # API client wrapper around generated client
│   ├── utils/                    # cn, format, slugify, nanoid
│   └── hooks/                    # Custom React hooks
├── public/
│   ├── favicon.ico
│   ├── og-image.png
│   └── illustrations/
├── middleware.ts                 # Auth + RBAC redirect at edge
├── next.config.ts
├── tsconfig.json
├── package.json                  # Frontend deps
├── postcss.config.mjs
└── eslint.config.mjs
```

**Frontend rules:**

- No imports from `apps/api/`
- No imports from `packages/db/` (unless purely type imports - rare; prefer Zod schemas in `packages/shared/`)
- All API calls go through `lib/api/` which wraps `packages/shared/api-client/`
- Forms import Zod schemas from `packages/shared/`

---

## `apps/api/` - NestJS Backend

```
apps/api/
├── src/
│   ├── main.ts                   # Bootstrap (Fastify adapter, Swagger setup, global pipes)
│   ├── app.module.ts             # Root module
│   ├── modules/                  # Feature modules
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── dto/
│   │   │   │   └── verify-session.dto.ts
│   │   │   └── strategies/
│   │   │       └── supabase.strategy.ts
│   │   ├── users/
│   │   ├── profiles/
│   │   ├── companies/
│   │   ├── jobs/
│   │   │   ├── jobs.module.ts
│   │   │   ├── jobs.controller.ts
│   │   │   ├── jobs.service.ts
│   │   │   ├── jobs.repository.ts
│   │   │   └── dto/
│   │   ├── applications/
│   │   ├── resumes/
│   │   ├── scoring/
│   │   │   ├── scoring.module.ts
│   │   │   ├── scoring.controller.ts
│   │   │   ├── scoring.service.ts
│   │   │   ├── profile-score.service.ts
│   │   │   ├── match-score.service.ts
│   │   │   └── dto/
│   │   ├── bias/
│   │   ├── interviews/
│   │   ├── offers/
│   │   ├── notifications/
│   │   └── admin/
│   │       ├── users-admin.controller.ts
│   │       ├── jobs-admin.controller.ts
│   │       ├── applications-admin.controller.ts
│   │       ├── scoring-config.controller.ts
│   │       ├── audit.controller.ts
│   │       ├── analytics.controller.ts
│   │       └── bias-monitor.controller.ts
│   ├── common/
│   │   ├── guards/
│   │   │   ├── supabase-auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── ownership.guard.ts
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts
│   │   │   ├── current-user.decorator.ts
│   │   │   └── public.decorator.ts
│   │   ├── interceptors/
│   │   │   ├── audit.interceptor.ts
│   │   │   └── transform.interceptor.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── pipes/
│   │   │   └── zod-validation.pipe.ts
│   │   └── types/
│   │       └── auth-user.type.ts
│   ├── ai/
│   │   ├── ai.module.ts
│   │   ├── openai.service.ts
│   │   ├── parse-resume.service.ts
│   │   ├── score-profile.service.ts
│   │   ├── score-match.service.ts
│   │   ├── detect-bias.service.ts
│   │   ├── redact-pii.service.ts
│   │   ├── prompts/              # Versioned prompt strings
│   │   │   ├── parse-resume.ts
│   │   │   ├── score-profile.ts
│   │   │   ├── score-match.ts
│   │   │   ├── detect-bias.ts
│   │   │   └── redact-text.ts
│   │   └── schemas/              # OpenAI structured-output JSON schemas (mirrored from packages/shared)
│   ├── queue/
│   │   ├── queue.module.ts
│   │   ├── queues.config.ts
│   │   └── processors/
│   │       ├── rescore-batch.processor.ts
│   │       └── digest-recruiter.processor.ts
│   ├── cron/
│   │   ├── cron.module.ts
│   │   ├── expire-offers.cron.ts
│   │   ├── archive-jobs.cron.ts
│   │   └── cleanup-unverified.cron.ts
│   ├── email/
│   │   ├── email.module.ts
│   │   ├── email.service.ts          # Transport switching dev/prod
│   │   └── templates/
│   │       ├── verify-email.tsx
│   │       ├── password-reset.tsx
│   │       ├── application-received.tsx
│   │       ├── application-status-changed.tsx
│   │       ├── interview-scheduled.tsx
│   │       └── offer-sent.tsx
│   ├── storage/
│   │   ├── storage.module.ts
│   │   ├── storage.service.ts
│   │   └── signed-urls.service.ts
│   ├── audit/
│   │   ├── audit.module.ts
│   │   ├── audit.service.ts
│   │   └── audit.types.ts
│   ├── config/
│   │   ├── config.module.ts
│   │   └── env.schema.ts             # Zod schema validating env vars
│   ├── db/
│   │   ├── db.module.ts
│   │   ├── db.provider.ts            # Drizzle client provider (DI)
│   │   └── tx-decorator.ts           # Transaction helpers
│   └── health/
│       ├── health.controller.ts      # GET /api/health (Caddy + PM2 probes on the Droplet)
│       └── health.module.ts
├── test/
│   └── (deferred to Phase 2 - no tests in sprint)
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
├── package.json
└── eslint.config.mjs
```

**Backend rules:**

- One feature = one module folder
- Module structure: `<feature>.module.ts` + `<feature>.controller.ts` + `<feature>.service.ts` + `<feature>.repository.ts` + `dto/`
- All controllers gated by `@UseGuards(SupabaseAuthGuard, RolesGuard)` unless `@Public()`
- All DTOs validated by Zod schemas from `packages/shared/`
- All consequential mutations write to `audit_logs` via `AuditService`
- All AI calls through `AiModule` services (PII redaction enforced)

---

## `packages/shared/` - Shared Schemas + Client

```
packages/shared/
├── src/
│   ├── schemas/
│   │   ├── auth.ts
│   │   ├── onboarding.ts
│   │   ├── jobs.ts
│   │   ├── applications.ts
│   │   ├── resumes.ts
│   │   ├── interviews.ts
│   │   ├── offers.ts
│   │   ├── ai-config.ts
│   │   ├── score.ts
│   │   ├── bias.ts
│   │   └── shared.ts             # email, phone, password, uuid, pagination atoms
│   ├── enums/
│   │   ├── user-role.ts
│   │   ├── application-status.ts
│   │   ├── job-status.ts
│   │   ├── score-band.ts
│   │   ├── bias-category.ts
│   │   └── index.ts              # re-exports
│   ├── constants/
│   │   ├── score-thresholds.ts
│   │   ├── ai-limits.ts
│   │   └── pagination.ts
│   ├── api-client/               # Auto-generated via orval
│   │   ├── (generated files - DO NOT EDIT)
│   │   ├── hooks.ts              # TanStack Query hooks
│   │   ├── client.ts             # Base fetch client
│   │   └── types.ts              # OpenAPI-derived types
│   ├── types/
│   │   ├── auth-user.ts
│   │   └── api-error.ts
│   └── index.ts                  # Top-level re-exports
├── orval.config.ts               # Codegen config (reads from apps/api/openapi.json)
├── tsconfig.json
└── package.json
```

**Build:** `pnpm --filter @aurahire/shared build` runs `orval` to regenerate the API client when the OpenAPI spec changes.

**Naming:** package is `@aurahire/shared`. Imported as `import { jobSchema } from "@aurahire/shared/schemas/jobs"` or via top-level `import { jobSchema } from "@aurahire/shared"`.

---

## `packages/db/` - Drizzle Schema

```
packages/db/
├── src/
│   ├── schema.ts                 # All 15 table definitions
│   ├── relations.ts              # Drizzle relations
│   ├── enums.ts                  # PG enum types
│   ├── indexes.ts                # Index helpers
│   ├── rls/                      # RLS policy SQL (applied separately by human)
│   │   ├── profiles.sql
│   │   ├── jobs.sql
│   │   ├── applications.sql
│   │   ├── ... (one file per table)
│   │   └── all-policies.sql      # Concatenated for one-shot apply
│   ├── seed.ts                   # Seed script (run by human, not Claude)
│   └── index.ts                  # Re-exports schema + types
├── drizzle.config.ts
├── tsconfig.json
└── package.json
```

**Naming:** package is `@aurahire/db`. Backend imports both schema (for queries) and types. Frontend imports types only when needed (rare - Zod schemas in `packages/shared/` are usually sufficient).

```ts
// In apps/api/.../jobs.repository.ts
import { jobsTable } from "@aurahire/db";

// In apps/web (rare):
import type { Job } from "@aurahire/db/types";
```

---

## File Naming Conventions

| Type               | Convention                                 | Example                                          |
| ------------------ | ------------------------------------------ | ------------------------------------------------ |
| Components (React) | kebab-case file, PascalCase export         | `score-ring.tsx` exports `ScoreRing`             |
| Pages (Next.js)    | `page.tsx`                                 | App Router convention                            |
| Layouts (Next.js)  | `layout.tsx`                               | App Router convention                            |
| NestJS modules     | `<feature>.module.ts`                      | `jobs.module.ts`                                 |
| NestJS controllers | `<feature>.controller.ts`                  | `jobs.controller.ts`                             |
| NestJS services    | `<feature>.service.ts`                     | `jobs.service.ts`                                |
| NestJS DTOs        | `<action>-<feature>.dto.ts`                | `create-job.dto.ts`                              |
| Zod schemas        | kebab-case, named exports                  | `jobs.ts` exports `jobSchema`, `createJobSchema` |
| Drizzle tables     | snake_case in schema; `<name>Table` export | `applications` table → `applicationsTable`       |
| Constants          | UPPER_SNAKE                                | `STRONG_MATCH_THRESHOLD`                         |
| React hooks        | `use-`-prefix kebab                        | `use-current-user.ts` exports `useCurrentUser`   |
| Utility functions  | camelCase                                  | `formatScore`                                    |

---

## Where to Place New Code

| If you're adding...                | Put it in...                                                           |
| ---------------------------------- | ---------------------------------------------------------------------- |
| A new page route                   | `apps/web/app/(group)/path/page.tsx`                                   |
| A new shadcn component             | `apps/web/components/ui/*` (via shadcn CLI)                            |
| A feature-specific React component | `apps/web/components/<feature>/*`                                      |
| A new Zod schema                   | `packages/shared/src/schemas/<feature>.ts`                             |
| A new enum                         | `packages/shared/src/enums/<name>.ts`                                  |
| A new Drizzle table                | `packages/db/src/schema.ts`                                            |
| A new RLS policy                   | `packages/db/src/rls/<table>.sql`                                      |
| A new NestJS module                | `apps/api/src/modules/<feature>/` (full module structure)              |
| A new endpoint on existing module  | Add controller method + DTO + service method in existing module folder |
| A new AI prompt                    | `apps/api/src/ai/prompts/<purpose>.ts` (with version)                  |
| A new background job processor     | `apps/api/src/queue/processors/<job-name>.processor.ts`                |
| A new cron task                    | `apps/api/src/cron/<task-name>.cron.ts`                                |
| A new email template               | `apps/api/src/email/templates/<purpose>.tsx`                           |
| Common types / constants           | `packages/shared/src/types/` or `constants/`                           |
| Custom React hook                  | `apps/web/lib/hooks/use-<thing>.ts`                                    |
| API client wrapper                 | `apps/web/lib/api/<feature>.ts` (wraps generated hooks)                |

---

## Code Colocation Rules

- **Forms colocate with their backend endpoint via shared schema.** Form imports `createJobSchema` from `@aurahire/shared`; controller imports the same; both validate the same shape.
- **One concern per file.** Don't bundle unrelated components.
- **Components don't reach across feature boundaries.** Candidate components shouldn't import recruiter components. Use `components/shared/*` for crossover.
- **Server Components by default in Next.js.** Add `"use client"` only when interactivity, hooks, or browser APIs needed.
- **NestJS modules don't import from each other's services directly** - use exported providers + module imports.

---

## TypeScript Path Aliases

### `apps/web/tsconfig.json`

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

- Imports: `@/components/...`, `@/lib/...`, `@/app/...`
- Cross-package: `import { ... } from "@aurahire/shared"`

### `apps/api/tsconfig.json`

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- Imports: `@/modules/...`, `@/common/...`, `@/ai/...`
- Cross-package: `import { ... } from "@aurahire/shared"`, `import { ... } from "@aurahire/db"`

---

## Files Already Present (from `create-next-app`)

These will be moved into `apps/web/` during Day 1 monorepo init:

- `next.config.ts` → `apps/web/next.config.ts`
- `tsconfig.json` → `apps/web/tsconfig.json` (with adjustments)
- `eslint.config.mjs` → `apps/web/eslint.config.mjs`
- `postcss.config.mjs` → `apps/web/postcss.config.mjs`
- `app/` → `apps/web/app/`
- `public/` → `apps/web/public/`
- `package.json` → split into root + `apps/web/package.json`

The root `package.json` becomes a workspace coordinator; `apps/web/package.json` keeps the frontend deps.

---

## Concurrent Dev (`pnpm dev` from root)

```bash
# At repo root
pnpm dev
```

This runs `turbo dev`, which:

1. Reads `turbo.json` task config
2. Runs `dev` script in each workspace package in parallel
3. Streams logs from both `apps/web` and `apps/api` interleaved

Output:

```
apps/web:dev: ▲ Next.js 16.2.4
apps/web:dev:   - Local:        http://localhost:3000
apps/api:dev: [Nest] 12345  - 05/02/2026, 8:00:00 AM
apps/api:dev: [NestApplication] Nest application successfully started
apps/api:dev:   - Local:        http://localhost:3333
apps/api:dev:   - Swagger:      http://localhost:3333/api/docs
```

The human runs this. Claude does not start dev servers.

---

## Known Gaps (Sprint Scope)

- **No `apps/api-worker/`** - workers run in-process with the API. Phase 2 split if needed.
- **No `tests/` packages** - no Vitest / Playwright in sprint.
- **No `packages/eslint-config/` shared lint config** - each app has its own; can normalize Phase 2.
- **No Storybook** - component documentation lives in `ui-patterns.md`.
- **No barrel `index.ts` re-exports** beyond what's needed for cross-package imports.

---

## Iteration Guide

When in doubt:

1. **Routes** group by audience (`(public)`, `(auth)`, role-based portals).
2. **Components** group by feature first, shared primitives second.
3. **Backend logic:** module per feature; controller-service-repository.
4. **AI logic:** stays in `apps/api/src/ai/`. Never cross to `apps/web`.
5. **Validation:** schemas in `packages/shared/`. Never inline.
6. **One file = one concern.** Long file? Split.
