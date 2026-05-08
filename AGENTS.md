<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (Next.js 16) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `apps/web/node_modules/next/dist/docs/` before writing any code in `apps/web/`. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# AuraHire Agent Rules

## Architecture context

This is a **Turborepo monorepo** with split frontend/backend:

- `apps/web` — Next.js 16 frontend (UI only; no DB; no AI keys)
- `apps/api` — NestJS REST backend (owns DB, AI, queue, cron, secrets)
- `packages/shared` — Zod schemas, enums, types (used by both apps)
- `packages/db` — Drizzle schema (consumed by `apps/api`; types only by `apps/web`)

When making changes, place code in the correct package per `docs/main/project-structure.md`.

## Backend rules (`apps/api/`)

- NestJS modules pattern: each feature is a folder with `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, `*.repository.ts` if needed.
- All controllers use `@UseGuards(SupabaseAuthGuard, RolesGuard)` for protected endpoints.
- All DTOs validate via `nestjs-zod` from schemas in `packages/shared/`.
- All consequential mutations write to `audit_logs` via the audit service.
- All AI calls go through `lib/ai/*` services with structured outputs + PII redaction.

## Frontend rules (`apps/web/`)

- No imports from `apps/api/` ever.
- API calls via the auto-generated TypeScript client in `packages/shared/api-client/` wrapped by TanStack Query.
- No direct calls to OpenAI, Supabase Storage, or DB. Frontend → backend → external.
- Server Components for default rendering; `"use client"` only when interactivity is needed.

## Auth flow

1. Frontend: user logs in via Supabase Auth (`@supabase/ssr`)
2. Frontend: stores session cookie automatically
3. Frontend: includes JWT (`Authorization: Bearer <token>`) on every API call to backend
4. Backend: `SupabaseAuthGuard` validates JWT → `RolesGuard` checks role → controller runs

## Concurrent dev

`pnpm dev` at the root runs both `apps/web` (port 3000) and `apps/api` (port 3333) via `turbo dev`. The human is the only one who runs servers — agents must not.

## Hard "do nots" for agents

See `CLAUDE.md` § "Hard rules for Claude Code" for the full list. Highlights:

- **Do not start any dev server** (`pnpm dev`, `next dev`, `nest start`, etc.).
- **Do not run Docker commands** (`docker compose up`, `docker run`, `docker exec`, etc.). Mailpit + Redis containers are managed by the human via `docker-compose.dev.yml`. You may edit the compose file but never run docker.
- **Do not run database mutations** (`drizzle-kit push`, migrations, seeds).
- **Do not deploy** (Vercel, Digital Ocean Droplet via SSH/PM2, `doctl`, etc.).
- **Do not run destructive or history-rewriting git commands** (`git stash`, `git reset --hard`, `git checkout -- .`, `git restore .`, `git clean -fd`, `git commit --amend`, `git rebase`, `git revert`, `git branch -D`, `git push --force`/`--force-with-lease`, `git push --delete`, `--no-verify`, etc.). Read-only git (`status`, `diff`, `log`, `show`, `fetch`) is fine; new commits and new branches are fine when the human asks. Never use a destructive command as a shortcut around an obstacle — diagnose the root cause and ask the human first.
- **Do not install global system packages** (`brew`, `apt`, `npm -g`).
- **Do not make billed external calls** (OpenAI, Resend) for testing — let the human test.

## Where to look first

When in doubt:
1. `CLAUDE.md` — workflow rules
2. `docs/main/sprint-plan.md` — what slice is current
3. `docs/main/<relevant-doc>.md` — the spec for the feature
4. Existing code in the relevant module — pattern-match it
5. `node_modules/next/dist/docs/` for Next.js 16 reference
