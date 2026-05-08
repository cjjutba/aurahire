# AuraHire — Claude Code Project Instructions

@AGENTS.md
@DESIGN.md

---

## Project at a glance

**AuraHire** is an AI-powered recruitment platform built as a thesis system. It demonstrates **explainable scoring** (every AI decision shows its work) and **active bias mitigation** (job descriptions are checked before publish; resumes are PII-redacted before scoring).

**Thesis angle:** *"Explainable and Fair AI-Powered Recruitment: A Transparent Resume Scoring Platform with Bias Mitigation."*

The system has three roles (Candidate, Recruiter, Admin) and ships as a **Turborepo monorepo** with a **split frontend/backend architecture**:
- **Frontend:** Next.js 16 (App Router) on Vercel
- **Backend:** NestJS REST API on a Digital Ocean Droplet (managed by PM2; Redis + Mailpit run as Docker containers on the same host via `deploy/docker-compose.prod.yml`; Caddy reverse-proxies HTTPS)
- **Database:** Supabase Postgres (with RLS)
- **Auth:** Supabase Auth on frontend, JWT validation guard on backend
- **AI:** OpenAI `gpt-4o-mini` (backend-only)
- **Email:** Mailpit (dev) → Resend (prod)
- **Cache + Queue:** Redis with BullMQ (Docker container on the production Droplet; localhost-bound)
- **Cron:** `@nestjs/schedule`

For full context, read these in order before editing code:

1. `docs/main/prd.md` — product requirements
2. `docs/main/architecture.md` — system architecture
3. `docs/main/tech-stack.md` — every dependency
4. `docs/main/project-structure.md` — folder layout (monorepo)
5. `docs/main/database-schema.md` — schema + RLS
6. `docs/main/ai-design.md` — scoring engines, prompts, fairness
7. `docs/main/technical-specifications.md` — per-feature specs
8. `docs/main/best-practices.md` — engineering standards
9. `docs/main/design-system.md` — tokens (canonical version)
10. `docs/main/ui-patterns.md` — components
11. `docs/main/page-inventory.md` — every page
12. `docs/main/sprint-plan.md` — Day 1 / Day 2 / Day 3 plan
13. `docs/main/env-setup.md` — local dev setup

---

## Repository layout (monorepo)

```
aurahire/
├── apps/
│   ├── web/              # Next.js 16 frontend (Vercel)
│   └── api/              # NestJS backend (Digital Ocean Droplet, PM2)
├── packages/
│   ├── shared/           # Zod schemas, enums, constants used by both apps
│   └── db/               # Drizzle schema (consumed by api; types exported to web)
├── docs/main/            # Project documentation
├── DESIGN.md             # Brand design summary (root-level reference)
├── AGENTS.md             # Agent rules
├── CLAUDE.md             # This file
├── package.json          # Root workspace + scripts
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Hard rules for Claude Code

These rules override default behavior. They exist because the human is the one running the system; Claude's job is to write and edit code — not to operate the system.

### 1. Claude does NOT run any dev servers

**Never run any of:**
- `pnpm dev` / `pnpm run dev` / `turbo dev`
- `npm run dev` / `npm start`
- `next dev` (in any subfolder)
- `nest start` / `nest start --watch`
- `node` / `tsx` / `bun` to launch a server
- Any background long-running process

The human runs all servers from a separate terminal. If you need to verify something runs, **ask the human to run it and report output** — don't start it yourself, even in `run_in_background` mode.

### 1a. Claude does NOT manage Docker containers

**Never run any of:**
- `docker compose up` / `docker compose down` / `docker compose restart`
- `docker run ...` to start a container
- `docker stop` / `docker start` / `docker kill`
- `docker exec ...` to run commands inside running containers
- `docker volume rm` / `docker system prune`

Mailpit and Redis run as Docker containers via `docker-compose.dev.yml` at repo root. **The human starts and stops these.** Docker Desktop is the human's responsibility — Claude assumes containers are already running per `env-setup.md` Step 5. If a Redis or Mailpit-dependent feature is failing, **ask the human to verify** `docker compose -f docker-compose.dev.yml ps` shows healthy containers.

You **may** edit `docker-compose.dev.yml` itself (it's a config file like any other), but never run docker commands.

### 2. Claude does NOT run database mutations

**Never run any of:**
- `drizzle-kit push` / `drizzle-kit migrate`
- `supabase db push` / `supabase migration up`
- `psql` / direct SQL DML (INSERT, UPDATE, DELETE) against any database
- Seed scripts that write to a real database

You may **write** the migration SQL, the schema TypeScript, the seed script. The human runs them.

### 3. Claude does NOT deploy

**Never run any of:**
- `vercel deploy` / `vercel --prod`
- `doctl apps create` / `doctl apps update` / `doctl droplet *` / any Digital Ocean CLI command that mutates infrastructure
- `ssh deploy@<droplet> ...` to run remote deploy steps (PM2 reload, `docker compose up -d`, etc.) on the production Droplet
- `git push` to remotes (the human manages the git remote workflow)

You may write deployment configs (`vercel.json`, `deploy/docker-compose.prod.yml`, `apps/api/Dockerfile`, GitHub Actions workflows, Caddyfile). The human triggers deploys and runs anything against the Droplet.

### 3a. Claude does NOT run destructive or history-rewriting git commands

These commands can erase the human's in-progress work, hide changes, rewrite shared history, or overwrite remotes. **The human runs them.** If a situation seems to need one, **stop and ask the human first** — never use a destructive git command as a shortcut to escape an obstacle.

**Never run any of:**
- `git stash` / `git stash pop` / `git stash drop` / `git stash clear` (hides or discards in-progress work)
- `git reset --hard` / `git reset --merge` / `git reset --keep` (discards uncommitted changes)
- `git checkout -- <path>` / `git checkout .` / `git restore <path>` / `git restore .` (discards uncommitted changes to tracked files)
- `git clean -f` / `git clean -fd` / `git clean -fdx` (deletes untracked files, including ones the human may not have committed yet)
- `git rm -f` / `git rm -rf` (force-removes tracked files)
- `git commit --amend` (rewrites the previous commit — even unpublished, it can lose co-authored or hook-rejected work)
- `git rebase` / `git rebase -i` / `git rebase --onto` / `git cherry-pick` (rewrites history; merge conflicts can swallow work)
- `git revert` (creates new commits that undo prior commits — semantically destructive)
- `git merge --squash` / `git merge --abort` / `git merge -s ours` (collapses or discards merge state)
- `git branch -D` / `git branch -d` / `git branch -m` (force-delete or rename branches)
- `git tag -d` / `git push --delete` / `git push --force` / `git push --force-with-lease` (deletes or overwrites refs locally or on the remote)
- `git update-ref -d` / `git symbolic-ref` / `git reflog expire` / `git gc --prune=now` / `git filter-branch` / `git filter-repo` (low-level history surgery)
- `git worktree remove` / `git worktree prune` (deletes worktrees)
- `git submodule deinit` / `git submodule update --force` (resets submodule state)
- Any git command with `--force` / `-f`, `--hard`, or `--no-verify` (including `git commit --no-verify`, which bypasses hooks the human relies on)

**Claude DOES freely run these read-only / introspective git commands:**
- `git status` (without `-uall` flag on this repo — large status output causes memory issues)
- `git diff` / `git diff --staged` / `git diff <ref>...<ref>`
- `git log` / `git log --oneline` / `git show <ref>`
- `git branch` / `git branch -a` / `git branch -vv` (list only)
- `git remote -v` / `git config --get <key>` (read only)
- `git rev-parse` / `git ls-files` / `git blame`
- `git fetch` (does not modify working tree or local branches when used without `--prune`)

**Claude MAY run these constructive git commands when the human has explicitly asked for a commit or PR:**
- `git add <specific paths>` (never `git add -A` / `git add .` — risk of staging secrets or stray files)
- `git commit -m "..."` (creating a new commit; never with `--amend` or `--no-verify`)
- `git checkout <existing branch>` / `git switch <existing branch>` (branch switch only — refuse if the working tree is dirty; ask the human)
- `git checkout -b <new branch>` / `git switch -c <new branch>` (creating a new branch off the current ref)

If a hook or pre-commit check fails, **investigate and fix the root cause** — never bypass with `--no-verify` or amend over the failure. If a merge conflict appears, resolve it; never abort or discard changes to make it go away.

### 4. Claude does NOT install global system packages

**Never run any of:**
- `brew install ...`
- `apt-get install ...`
- `npm install -g ...`
- Any system-level package manager that affects the user's machine globally

Project-scoped installs (`pnpm add ...` inside `apps/` or `packages/`) are fine — that modifies `package.json` and is reviewable.

### 5. Claude does NOT make external paid calls without confirmation

**Never run code that makes:**
- OpenAI API calls (real billing)
- Resend email sends
- SMS sends
- Any external HTTPS call that triggers billing

If a feature depends on these, write the integration code, then **ask the human to test**.

### 6. Claude DOES the following freely

- Read any file in the repo
- Write or edit any file in `apps/`, `packages/`, `docs/`, `emails/`, configuration files
- Run `pnpm install` / `pnpm add <pkg>` / `pnpm remove <pkg>` (modifies `package.json`/lockfile only)
- Run `pnpm tsc --noEmit` / `tsc --noEmit` for type-checking
- Run `pnpm lint` / `eslint`
- Run `pnpm format` / `prettier`
- Run `turbo run build` for build verification (does not start a server)
- Read `node_modules/next/dist/docs/` before writing Next.js 16 code (mandatory)
- Read NestJS official docs / patterns before writing backend code
- Search the codebase, grep, glob, find files

---

## Workflow rules

### Before writing code

1. Read the relevant doc(s) under `docs/main/` first.
2. For Next.js code: read the relevant guide in `node_modules/next/dist/docs/01-app/` (this is **Next.js 16**, behavior differs from training data).
3. For NestJS code: pattern-match against existing modules in `apps/api/src/modules/`.
4. For schema changes: read `docs/main/database-schema.md`. Schema files live in `packages/db/`.

### Architecture discipline

- **Frontend (`apps/web`)** has NO direct database access. Ever. It calls the backend via the auto-generated REST client (`packages/shared/api-client/`).
- **Backend (`apps/api`)** owns all DB writes, all AI calls, all secret handling, all queue/cron/cache.
- **Shared logic** (Zod schemas, enums, constants) lives in `packages/shared/` — imported by both apps.
- **Database schema** lives in `packages/db/` — only `apps/api` reads it for queries; `apps/web` only imports types.

### Type safety

- TypeScript strict mode in every app and package
- Zero `any`, zero `as` casts unless inference fails (rare)
- Zod schemas in `packages/shared/` are the single source of truth for input shapes — used by NestJS DTOs (via `nestjs-zod`) and Next.js forms (via `react-hook-form` resolver)
- DB types pulled from Drizzle (`typeof <table>.$inferSelect`)

### Auth model

- Frontend: Supabase Auth via `@supabase/ssr` (cookies, login, register, reset, verify)
- Backend: receives Supabase JWT in `Authorization: Bearer <token>` header
- Backend `SupabaseAuthGuard` validates JWT against Supabase JWKs, attaches `user` to request
- Backend `RolesGuard` checks `user.role` against `@Roles(...)` decorator
- RLS in Postgres as third defense layer

### AI discipline

- All AI calls happen in `apps/api` (backend-only); OpenAI key never touches the frontend
- All AI prompts use **OpenAI structured outputs** — Zod-derived JSON schemas, never free-text parsing
- Every score/parse records: `prompt_version`, `model_used`, `latency_ms`, `redacted_fields` (audit trail)
- Resumes pass through PII redaction before any scoring AI call
- Job descriptions pass through bias detection before publish
- See `docs/main/ai-design.md` for full prompt + schema specs

---

## Concurrent dev (run BOTH apps with one command)

`pnpm dev` from the root runs both frontend and backend simultaneously via Turborepo. The human runs this; Claude does not.

Root `package.json` script:
```json
"scripts": { "dev": "turbo dev" }
```

`turbo.json` declares `dev` as `cache: false, persistent: true`. Each app's `package.json` has its own `dev` script:
- `apps/web/package.json`: `"dev": "next dev --turbo --port 3000"`
- `apps/api/package.json`: `"dev": "nest start --watch --debug"` (port 3333)

Frontend talks to backend at `NEXT_PUBLIC_API_URL=http://localhost:3333`.

---

## Communication style

- Output text to the human is concise and actionable
- When working through complex tasks, use TaskCreate to track progress
- When proposing architectural choices, lay out alternatives + recommendations + ask for confirmation
- When something is faked, stubbed, or skipped — say so explicitly
- For UI/visual work: state when something requires running the dev server to verify, since you cannot run it yourself

---

## When to ask vs proceed

**Proceed without asking:**
- Implementing a feature spec'd in `docs/main/`
- Following the locked sprint plan in `docs/main/sprint-plan.md`
- Refactoring within an existing pattern
- Fixing a typo, lint error, type error
- Updating docs to match code (or vice versa)

**Ask first:**
- Architectural changes that span multiple modules
- Adding a new dependency (state the rationale, propose a choice, wait for confirmation)
- Changing the AI prompts (versions matter — bumping a prompt is a thesis-defensible event, not a casual edit)
- Anything that touches `scoring_config` defaults
- Anything that requires running an external service or modifying the human's machine

---

## Sprint context (current)

- **Sprint window:** May 2 / 3 / 4, 2026 (3 active days + Day 4 polish buffer)
- **Sprint scope:** see `docs/main/sprint-plan.md`
- **Build approach:** vertical slices end-to-end, not horizontal layers

---

## Common pitfalls Claude should avoid

1. Treating Server Actions as "the backend" — in this project, **NestJS** is the backend. Frontend Server Actions don't talk to the DB.
2. Adding direct DB queries in `apps/web` — forbidden.
3. Inlining Zod schemas in Next.js forms — they belong in `packages/shared/` and get imported.
4. Adding console.logs that survive into production paths.
5. Adding comments that restate code (the rule: comments only for non-obvious WHY).
6. Generating placeholder content for screens that should already work — read `docs/main/page-inventory.md` first.
7. Forgetting to log to `audit_logs` after consequential actions.
8. Calling AI without PII redaction.
9. Calling AI without a structured output schema.
10. Running ANY dev server, ANY migration, ANY deploy command, or ANY destructive/history-rewriting git command (see Hard Rules above).
11. Reaching for `git stash`, `git reset --hard`, `git checkout -- .`, `git clean -fd`, or `--no-verify` to escape an obstacle. Stop, diagnose the root cause, and ask the human if a destructive step is genuinely required.

---

## Project metadata

- **User email:** `cjjutbaofficial@gmail.com`
- **Today's date context:** May 1, 2026
- **Git default branch:** `main`
- **Package manager:** `pnpm` (workspaces)
- **Node version:** 20.x LTS
