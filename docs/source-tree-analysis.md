# Source Tree Analysis

> Brownfield scan by `[DP] Document Project` · 2026-06-10 · Index: [index.md](./index.md)

```
aurahire/
├── apps/
│   ├── web/                      # Part: web — Next.js 16 frontend (Vercel)
│   │   ├── app/                  # App Router; route groups + co-located _*-client.tsx islands
│   │   │   ├── (public)/         #   marketing + public job board
│   │   │   ├── (auth)/           #   login/register/verify/reset
│   │   │   ├── (candidate)/      #   candidate portal (PortalShell)
│   │   │   ├── (recruiter)/      #   recruiter portal (+ ActiveCompanyProvider)
│   │   │   ├── (admin)/          #   admin console
│   │   │   ├── (legal)/          #   privacy/terms
│   │   │   ├── onboarding/       #   candidate + recruiter onboarding flows
│   │   │   ├── invite/           #   membership invite acceptance
│   │   │   ├── layout.tsx        #   ENTRY: provider stack + fonts
│   │   │   └── globals.css       #   Tailwind v4 @theme tokens + shadcn bridge
│   │   ├── components/           # reusable UI (ui/ layout/ portal/ score/ ai/ jobs/ bias/ ...)
│   │   ├── hooks/                # TanStack Query hooks over clientApiFetch
│   │   ├── contexts/             # active-company-context (recruiter multi-tenancy)
│   │   ├── lib/                  # auth/ query/ realtime/ + utils, labels, toast
│   │   ├── middleware.ts         # Supabase SSR auth gate (coarse)
│   │   └── next.config.ts        # monorepo tracing + transpilePackages
│   └── api/                      # Part: api — NestJS-on-Fastify backend
│       ├── src/
│       │   ├── main.ts           # ENTRY: Fastify, helmet, CORS, /api/v1, Swagger, WS adapter
│       │   ├── app.module.ts     # global guards (Throttler→Auth→Roles→ActiveCompany)
│       │   ├── modules/          # 18 feature modules (module/controller/service/repository/dto)
│       │   ├── ai/               # OpenAI service + redaction + versioned prompts/
│       │   ├── audit/            # append-only audit logging (non-throwing)
│       │   ├── cache/            # tag-aware CacheService (ah:v1, own ioredis)
│       │   ├── common/           # guards, decorators, JWT verifier, exception filter
│       │   ├── config/           # (env via @nestjs/config; no dir code)
│       │   ├── cron/             # @nestjs/schedule jobs + dev CronAdminController
│       │   ├── db/               # Drizzle client (postgres.js, prepare:false)
│       │   ├── email/            # Resend/Nodemailer + react-email templates
│       │   ├── queue/            # BullMQ producers (match/profile/preview)
│       │   ├── realtime/         # socket.io gateway + EventsService + RedisIoAdapter
│       │   ├── storage/          # Supabase Storage + docx→pdf (LibreOffice — serverless risk)
│       │   └── health/           # GET /api/health
│       ├── scripts/              # seed/reset/backfill/openapi (human-run, mutate DB)
│       └── Dockerfile            # droplet build (bundles LibreOffice) — obsolete on Vercel
├── packages/
│   ├── shared/                   # Part: shared — Zod schemas, enums, orval client, realtime
│   │   ├── src/{schemas,enums,constants,types,realtime,onboarding,api-client}/
│   │   ├── orval.config.ts       # generates api-client from openapi.json
│   │   └── openapi.json          # generated from NestJS backend
│   └── db/                       # Part: db — Drizzle schema library
│       ├── src/{schema.ts,enums.ts,relations.ts,types.ts,rls/}
│       └── drizzle/              # 17 checked-in SQL migrations + meta/_journal.json
├── deploy/                       # OBSOLETE (DO droplet): provision/deploy/pm2/caddy/nginx/compose
├── docs/                         # this documentation set + main/ (specs) + plans/
├── _bmad-output/                 # BMad artifacts (project-context.md, planning, ...)
├── docker-compose.dev.yml        # local Mailpit (:1025/:8025) + Redis (:6379)
├── turbo.json · pnpm-workspace.yaml · tsconfig.base.json
└── package.json                  # root scripts (dev/build/lint/type-check/format)
```

## Critical folders
- **Entry points:** `apps/web/app/layout.tsx` (frontend), `apps/api/src/main.ts` (backend).
- **Backend feature unit:** `apps/api/src/modules/<feature>/` — controller (thin) + service (logic) + repository (Drizzle) + dto/.
- **Frontend page unit:** `app/.../page.tsx` (Server Component shell) + co-located `_*-client.tsx` (interactivity).
- **Contract source of truth:** `packages/shared/src/schemas/` (Zod) → `packages/shared/openapi.json` → `packages/shared/src/api-client/` (orval).
- **Schema source of truth:** `packages/db/src/schema.ts` + `packages/db/drizzle/*.sql`.
- **Migration-affected:** `deploy/` (retire), `apps/api/Dockerfile` + `storage/docx-to-pdf.service.ts` (LibreOffice), `apps/api/src/realtime/` + `cron/` (stateless serverless), all Supabase-auth touch points.
