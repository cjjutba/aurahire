---
project_name: 'aurahire'
user_name: 'Cjjutba'
date: '2026-06-10'
sections_completed:
  [
    'technology_stack',
    'architecture_boundaries',
    'language_rules',
    'frontend_rules',
    'backend_rules',
    'type_chain',
    'ai_fairness',
    'data_auth_security',
    'testing',
    'code_quality',
    'workflow',
    'migration_state',
    'anti_patterns',
  ]
existing_patterns_found: 14
status: 'complete'
rule_count: 60
optimized_for_llm: true
---

# Project Context for AI Agents

_Critical rules and patterns AI agents MUST follow when implementing code in AuraHire. Optimized for unobvious details agents otherwise miss. Obvious framework knowledge is intentionally omitted._

> **Read the source docs for depth:** `docs/main/best-practices.md` (engineering contract), `docs/main/architecture.md`, `docs/main/ai-design.md`, `CLAUDE.md` / `AGENTS.md` (hard rules), `DESIGN.md` (tokens). This file is the fast-lookup layer, not a replacement.

---

## Technology Stack & Versions

**Monorepo:** pnpm `9.12.3` workspaces · Turborepo `2.3.3` · TypeScript `5.7.2` (strict, `noUncheckedIndexedAccess`, `noImplicitOverride`, `isolatedModules`, ES2022) · Prettier `3.4.2` + `prettier-plugin-tailwindcss` · Node `>=20`.

**Frontend (`apps/web`):** Next.js `16.2.4` (App Router) · React `19.2.4` · Tailwind CSS `4.0.0` (`@tailwindcss/postcss`, no `tailwind.config` — CSS-first) · shadcn `4.6.0` + `radix-ui 1.4.3` + `@base-ui/react 1.4.1` · `lucide-react 1.14` · TanStack Query `5.100.7` · react-hook-form `7.75` + `@hookform/resolvers` · Zod `3.24.1` · Tiptap `3.22` (JD editor) · Recharts `3.8` · `pdfjs-dist 5.7` · socket.io-client `4.8` · sonner · next-themes.

**Backend (`apps/api`):** NestJS `10.4.15` on **Fastify** (`@nestjs/platform-fastify`, fastify pinned `4.29.1` via root override — **not Express**; use Fastify reply/request types) · Drizzle ORM `0.36.4` + `postgres.js 3.4.5` · `nestjs-zod 5.3.0` · `@nestjs/bullmq 11` / `bullmq 5.76.5` / `ioredis 5.10.1` · `@nestjs/cache-manager` + `cache-manager 7` + `@keyv/redis` · `@nestjs/throttler 6.5` + `nestjs-throttler-storage-redis` · `@nestjs/schedule 6.1.3` · `@nestjs/websockets` + `@nestjs/platform-socket.io` + `socket.io 4.8` + `@socket.io/redis-adapter` · OpenAI `6.35` · Resend `6.12` + `@react-email/*` + nodemailer · `jose 6.2` (JWT) · `@supabase/supabase-js 2` · pino logging · `@nestjs/swagger 8`.

**Shared packages:** `packages/shared` (Zod schemas, enums, constants, realtime contracts, **orval `8.9`-generated API client**, `zod-to-json-schema` for OpenAI) · `packages/db` (Drizzle schema, enums, relations, RLS SQL, `drizzle-kit 0.27`, **17 migrations** in `drizzle/`).

**Test:** Jest `30` (api, `*.spec.ts` under `src/`) · Vitest `4.1.5` (web + shared) · Playwright `1.59` (web e2e).

---

## Critical Implementation Rules

### Architecture Boundaries (the #1 rule)

- **`apps/web` NEVER touches DB, AI, secrets, queues, or external services.** It is a UI layer. All data flows: frontend → NestJS REST → external. No imports from `apps/api/` ever; from `packages/db/` only rare type imports.
- **`apps/api` owns everything stateful:** all DB writes, all AI calls, all secret handling, queue/cron/cache.
- **Shared contracts live in `packages/shared`.** A Zod schema there is the single source of truth — never inline a schema in a form or DTO.
- **Features are NestJS modules:** `apps/api/src/modules/<feature>/` with `*.module.ts`, `*.controller.ts` (thin, HTTP shape only), `*.service.ts` (logic), `*.repository.ts` (Drizzle queries), `dto/`. Cross-cutting concerns live outside `modules/`: `ai/ audit/ cache/ common/ config/ cron/ db/ email/ health/ queue/ realtime/ storage/`.

### TypeScript / Language Rules

- **Zero `any`. Zero `as`** unless inference genuinely can't follow — then narrow with a type guard. `unknown` + guard over `any`.
- **Pull types from Drizzle**, don't redefine: `typeof jobsTable.$inferSelect`. Form types come from `z.infer<typeof schema>`.
- **Discriminated unions over TS `enum`s** for status fields.
- **No barrel `index.ts` re-exports** in app code (keeps tree-shaking honest). Import directly. (`packages/*` public entry files are the deliberate exception.)
- **Imports ordered:** external → `@/`/workspace → relative.

### Frontend Rules (Next.js 16 + React 19)

- **Next.js 16 behavior differs from training data.** Before writing `apps/web` code, read the relevant guide in `apps/web/node_modules/next/dist/docs/01-app/`. Heed deprecations.
- **Server Components by default.** Add `"use client"` only for hooks, browser APIs, events, or hook-using libs. Use the children-passing composition pattern; don't drag data fetch into the client.
- **Mutations via orval-generated TanStack Query hooks** imported from `@aurahire/shared` — never hand-written fetch to the backend.
- **Forms = RHF + `zodResolver` + shared schema** with inline `defaultValues`; disable submit on `isSubmitting`; inline `<FormMessage/>`; form-level errors via `setError("root")`.
- **Tailwind v4 is CSS-first** (config in `globals.css` / `@theme`, not `tailwind.config.js`). Use design tokens from `DESIGN.md`; never inline hex.
- **All numbers render in JetBrains Mono** (score values, %, salary, counts, durations). Never render a score in Inter.
- Every async UI needs loading + error + empty states. Mobile-responsive at 375px.

### Backend Rules (NestJS-on-Fastify)

- **Protected controllers carry `@UseGuards(SupabaseAuthGuard, RolesGuard)` + `@ApiBearerAuth()`**; opt out only via `@Public()` for auth bootstrap. Per-resource ownership via `OwnershipGuard`/service checks.
- **Controllers thin, services own logic, repositories own Drizzle.** No inline queries in services. Use `returning()` instead of re-querying.
- **DTOs validate via `nestjs-zod`** from `packages/shared` schemas. Every endpoint gets Swagger decorators (OpenAPI feeds orval codegen — stale decorators = broken client).
- **Every consequential mutation:** (1) write to `audit_logs` via `AuditService`, (2) invalidate affected cache keys, (3) never throw raw Postgres errors (map via exception filter).
- It's Fastify under the hood — don't assume Express middleware/`res` semantics.

### Type Chain (do not break it)

`Zod (packages/shared)` → `NestJS DTO (nestjs-zod)` → `OpenAPI (@nestjs/swagger)` → `orval client (packages/shared/api-client)` → `TanStack Query` → `RHF + JSX`. Changing a contract means updating the Zod schema and **regenerating the client** (`pnpm --filter @aurahire/shared codegen`). Don't patch one layer in isolation.

### AI & Fairness Discipline (thesis-critical — non-negotiable)

- **All AI in `apps/api/src/ai/`.** OpenAI key never reaches the frontend bundle.
- **Always structured outputs** (`response_format` json_schema from a Zod-derived schema). No free-text parsing.
- **PII redaction before any scoring call. No exceptions.**
- **Every AI call records** `prompt_version`, `model_used`, `latency_ms`, `redacted_fields` to the audit trail.
- **Job descriptions pass bias detection before publish.**
- **Visible AI:** every call has a UI affordance (shimmer + caption, "AI Suggested" badge, evidence callout). Silent AI is a thesis violation.
- **Never show a score without click-through to its breakdown** (Score Ring + Breakdown Bar + Evidence travel together). Match labels are "Strong/Partial/Limited Match" — never value-judgment words.
- **Prompt edits bump `prompt_version`** — a thesis-defensible event, not a casual change. Ask before editing prompts or `scoring_config` defaults.

### Data, Auth & Security

- **DB access only via Drizzle in backend repositories.** Schema in `packages/db/src/schema.ts`; migrations in `packages/db/drizzle/`.
- **RLS is never disabled.** Policies in `packages/db/src/rls/*.sql` are the last defense layer (5-layer: web middleware → CORS/Helmet → AuthGuard → Roles/Ownership → RLS).
- **Secrets backend-only.** `NEXT_PUBLIC_*` is baked into the client bundle — anon/publishable keys only, never service-role/API secrets. Never read `process.env` in Client Components.
- Validate at boundaries (user input, external APIs, uploads) — Zod everywhere; MIME+size check uploads server-side; sanitize rich text on display.

### Testing

- Sprint stance: type-check + Zod runtime + manual QA are the safety net; not every change needs a unit test.
- When you do test: api → Jest `*.spec.ts` colocated under `src/`; web/shared → Vitest; flows → Playwright in `apps/web/e2e/`.

### Code Quality & Style

- **kebab-case filenames** throughout (`create-job.dto.ts`, `score-match.service.ts`).
- **Comments explain WHY only**, never WHAT. Prefer renaming over commenting. Non-obvious constraint / workaround / invariant only.
- **No `console.log` in production paths** (`console.error` for genuinely unexpected errors is tolerated). No premature abstraction; a custom hook/helper needs 2+ real call sites.

### Development Workflow

- **`main` = production, `dev` = development** (currently aligned at the same commit). Feature work branches off `dev`; the user runs one git worktree per epic/story (Superset).
- **Conventional Commits** (`feat(scope):`, `fix(scope):`, `chore:`). Commit messages end with the project's `Co-Authored-By` trailer.
- **The human runs all servers, DB migrations, Docker, deploys, and external (OpenAI/Resend) calls** — agents never do (see `CLAUDE.md` Hard Rules). Agents may type-check, lint, build, and edit configs.

### Migration State — DO → Serverless, Supabase → Neon (active, June 2026)

The system is mid-migration off Digital Ocean. **Mark assumptions accordingly — don't hard-code stale infra.**

| Concern | From (dying/lost) | To (target) | Agent note |
|---|---|---|---|
| Postgres | Supabase Postgres | **Neon** (`aurahire`, PG18, AWS Singapore, free tier) | Drizzle + postgres.js → mostly a connection-string swap; re-run the 17 migrations on Neon |
| Auth | Supabase Auth (account lost) | **TBD in `[CA]`** | `SupabaseAuthGuard`, `@supabase/ssr`, JWKS-via-`jose`, and RLS `auth.uid()` policies all depend on this — biggest risk |
| API compute | NestJS on DO Droplet (PM2) | Serverless (Vercel Fluid Compute candidate) | Stateless — anything relying on in-process state breaks |
| Redis | self-hosted Docker | **Upstash** (serverless) | Backs BullMQ + cache-manager + throttler + socket.io adapter — all four must work on Upstash |
| Realtime | socket.io persistent WS | TBD | Persistent WebSockets don't fit stateless serverless — `[CA]` decision |
| Cron | `@nestjs/schedule` in-process | Vercel Cron / external scheduler → endpoints | In-process schedulers won't fire on serverless |
| Domain | `aurahire.site` | **`aurahire.cjjutba.com`** | Update CORS, `NEXT_PUBLIC_API_URL`, auth redirect URLs, email from-domain, OpenAPI server URL |

Stable/portable as-is: Next.js-on-Vercel, Drizzle schema, Resend email, OpenAI, the monorepo + type chain.

### Critical Don't-Miss / Anti-Patterns

- ❌ Calling the DB or OpenAI from `apps/web`. ❌ Inlining a Zod schema in a form. ❌ Using Server Actions for backend logic (they're reserved for frontend auth flows only — and that surface changes with the auth re-platform).
- ❌ Skipping PII redaction / structured output / audit log on an AI call. ❌ Rendering a score without its breakdown. ❌ Disabling RLS to debug.
- ❌ Assuming Express semantics on the Fastify backend. ❌ Assuming pre-16 Next.js caching/router behavior — read the bundled docs.
- ❌ Hard-coding Supabase/DO/`aurahire.site` assumptions during the migration. ❌ Leaving untracked `// TODO`s without a tracked task.

---

## Usage Guidelines

**For AI agents:**

- Read this file before implementing any code in AuraHire.
- Follow every rule exactly; when in doubt, choose the more restrictive option.
- During the migration, treat the **Migration State** table as authoritative — never hard-code dead infra (Supabase Auth, DO Droplet, self-hosted Redis, `aurahire.site`).
- The deep specs in `docs/main/` override this file on detail; this file wins on "what agents forget."

**For humans (Cjjutba):**

- Keep this lean — it's the fast-lookup layer, not a doc dump.
- Update the **Migration State** table as each `[CA]` decision lands (auth choice, realtime, compute host), then prune rows once a migration completes.
- Refresh the version table when dependencies bump.

Last Updated: 2026-06-10

