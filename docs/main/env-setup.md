# AuraHire Environment Setup

**Version:** 2.0.0 (Monorepo + Split Backend)
**Last Updated:** May 1, 2026
**Status:** Locked for Sprint
**Audience:** developer (the human) bringing up local dev environment for the first time

This guide takes you from a fresh repo clone to a working `pnpm dev` (running both frontend and backend simultaneously) with all services connected. Estimated time: **45-60 minutes** for first-time setup, mostly waiting on account verifications.

---

## Prerequisites

Before starting:

- macOS, Linux, or WSL2 on Windows
- **Node.js 20.x or higher** (LTS recommended) — verify: `node --version`
- **pnpm 9+** — install: `npm install -g pnpm@9`
- **Docker Desktop** (running) — used for **Mailpit** (local email catcher) and **Redis** (cache + queue + throttle). Both orchestrated via `docker-compose.dev.yml` at repo root.
- Git
- A modern browser
- An email address you have access to

---

## Required Service Accounts (all free tier)

Sign up for **four accounts** before starting — verification can take time.

### 1. Supabase (Database + Auth + Storage)

- Sign up at https://supabase.com
- Free tier: 500MB DB, 1GB storage, 50K MAU

### 2. Resend (Production Email)

- Sign up at https://resend.com
- Free tier: 100/day, 3000/month

### 3. OpenAI (AI Inference)

- Sign up at https://platform.openai.com
- **Add $10–20 in billing credits** (free trial credits expire fast)

### 4. Railway (Backend Hosting)

- Sign up at https://railway.app
- Free $5 trial; pay-as-you-go after
- We deploy `apps/api` here + Redis addon

(Vercel signup deferred until Day 4 deployment.)

---

## Step 1: Clone, Install, and Verify Monorepo

```bash
cd ~/Projects
git clone https://github.com/<your-account>/aurahire.git
cd aurahire

# Install all workspace dependencies
pnpm install

# Verify workspace is healthy
pnpm list --depth -1
# You should see: aurahire (root), apps/web, apps/api, packages/shared, packages/db
```

### Expected layout after install
```
aurahire/
├── apps/
│   ├── web/           ← Next.js frontend
│   └── api/           ← NestJS backend
├── packages/
│   ├── shared/        ← Zod schemas, enums, API client (generated)
│   └── db/            ← Drizzle schema
├── node_modules/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

If the monorepo isn't yet scaffolded (this guide is read **before** Day 1's monorepo init slice), the structure above will be created during Slice 1.1.

---

## Step 2: Set Up Supabase

### 2a. Create the project

1. Log in at https://supabase.com/dashboard → **New Project**
2. Fill in:
   - **Name:** `aurahire-dev`
   - **Database Password:** generate strong; save to password manager
   - **Region:** closest to you
   - **Pricing Plan:** Free
3. Provisioning takes ~1-2 min

### 2b. Collect Supabase credentials

Project Settings → **API** → copy:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` *(⚠ secret)*

Project Settings → **Database** → **Connection string** (URI mode, pooler port 6543):
- `Connection string` → `DATABASE_URL` (replace `[YOUR-PASSWORD]` with the password from 2a)

Example: `postgresql://postgres.xxxxx:YourPassword@aws-0-region.pooler.supabase.com:6543/postgres`

### 2c. Configure Auth settings

Authentication → **Providers**:
- **Email:** enabled (default)
- **Confirm email:** enabled

Authentication → **URL Configuration**:
- **Site URL:** `http://localhost:3000` (frontend)
- **Redirect URLs:** add `http://localhost:3000/**` and `http://localhost:3000/verify-email` and `http://localhost:3000/reset-password`

(For production: add Vercel URL during Day 4.)

### 2d. Create Storage buckets

Storage → **New bucket**:
- `resumes` — Public: OFF (private)
- `avatars` — Public: ON
- `company-logos` — Public: ON

---

## Step 3: Set Up Resend (Production Email)

1. Log in at https://resend.com/api-keys → **Create API Key**
2. Name: `aurahire-dev`
3. Permission: **Full access**
4. Copy the key → save as `RESEND_API_KEY`
5. Sender: use shared `onboarding@resend.dev` (no domain verification for sprint)
6. Save `RESEND_FROM_EMAIL=onboarding@resend.dev`

---

## Step 4: Set Up OpenAI

1. Log in at https://platform.openai.com → **Billing → Add to credit balance** ($10-20)
2. **API keys → Create new secret key**
3. Name: `aurahire-dev`
4. Copy the key (starts `sk-proj-...`) → save as `OPENAI_API_KEY`

(Optional) **Projects → Create project** for spending limits.

---

## Step 5: Start Local Services (Mailpit + Redis via Docker Compose)

Local dev services — Mailpit (SMTP catcher) and Redis (cache + queue + throttle store) — run as Docker containers orchestrated by `docker-compose.dev.yml` at the repo root.

**Prerequisite:** Docker Desktop must be running.

### 5a. Start both services

```bash
# From repo root
docker compose -f docker-compose.dev.yml up -d
```

This starts:
- **Mailpit** — SMTP server on `localhost:1025`, web UI on http://localhost:8025
- **Redis 7-alpine** — `localhost:6379`, with persistent volume + LRU eviction at 256MB

Both containers `restart: unless-stopped`, so they survive Docker Desktop restarts. Health checks ensure they're ready before `pnpm dev` connects.

### 5b. Verify

```bash
# List running containers
docker compose -f docker-compose.dev.yml ps

# Should show both 'aurahire-mailpit' and 'aurahire-redis' as healthy
```

- Open http://localhost:8025 — Mailpit inbox UI loads (empty initially)
- Verify Redis: `docker exec aurahire-redis redis-cli ping` → returns `PONG`

### 5c. Common commands

```bash
# Stop both (preserves data via volumes)
docker compose -f docker-compose.dev.yml down

# Stop + delete volumes (fresh start)
docker compose -f docker-compose.dev.yml down -v

# Tail logs
docker compose -f docker-compose.dev.yml logs -f

# Restart a single service
docker compose -f docker-compose.dev.yml restart redis
```

### 5d. Why Docker for these (not local installs)

- **Reproducible** — exact same Mailpit + Redis versions across all dev environments
- **Cleanup-friendly** — `docker compose down -v` resets state; no leftover system services
- **No system pollution** — nothing installed via `brew`/`apt` for these services
- **Production parity** — Railway runs containerized Redis too; behavior matches

For production, Mailpit is replaced by Resend, and Redis is provisioned as a Railway addon — but the `apps/api` code targets the same `REDIS_URL` and SMTP environment variables in both environments.

---

## Step 7: Create Environment Files

You need **two** `.env` files (one per app) plus a root `.env` for shared values.

### `apps/web/.env.local`

```bash
# apps/web/.env.local — frontend secrets
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:3333

# App config
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### `apps/api/.env`

```bash
# apps/api/.env — backend secrets

# Database (Supabase)
DATABASE_URL=postgresql://postgres.xxxxx:yourpassword@aws-0-region.pooler.supabase.com:6543/postgres

# Supabase (for auth JWT validation + storage)
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...

# Redis (BullMQ + cache + throttle)
REDIS_URL=redis://localhost:6379

# OpenAI
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini

# Email transport
NODE_ENV=development            # ⇒ uses Mailpit SMTP
SMTP_HOST=localhost
SMTP_PORT=1025
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx           # used in production
FROM_EMAIL=onboarding@resend.dev

# CORS
ALLOWED_ORIGINS=http://localhost:3000

# Server
PORT=3333
```

### `.env.example` (root, committed)

A redacted template of both files combined, committed to git. The human copies values in.

---

## Step 8: Initialize Database Schema (Day 1, Slice 1.2)

After `packages/db/src/schema.ts` is written:

```bash
# From repo root
pnpm --filter @aurahire/db drizzle-kit push
```

This pushes the schema to your Supabase Postgres dev project. Verify in Supabase Dashboard → Tables.

### Apply RLS Policies

```bash
# Open packages/db/src/rls/all-policies.sql in your editor
# Copy contents
# In Supabase Dashboard → SQL Editor → New query → paste → Run
```

Verify RLS:
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

Every table should show `rowsecurity = true`.

### Seed Initial Data

```bash
# From repo root (after seed.ts is written)
pnpm --filter @aurahire/db tsx src/seed.ts
```

The seed creates: `scoring_config` row, then registers an admin user via Supabase Auth + manually sets role='admin'.

---

## Step 9: Start Both Dev Servers

```bash
# From repo root
pnpm dev
```

Output (interleaved logs from both apps):

```
apps/web:dev: ▲ Next.js 16.2.4
apps/web:dev:   - Local:        http://localhost:3000
apps/api:dev: [Nest] 12345  - LOG [NestApplication] Nest application successfully started
apps/api:dev:   - Local:        http://localhost:3333
apps/api:dev:   - Swagger UI:   http://localhost:3333/api/docs
```

Open in browser:
- **Frontend:** http://localhost:3000
- **Backend API docs:** http://localhost:3333/api/docs
- **Mailpit inbox:** http://localhost:8025

---

## Step 10: Smoke Test

Manual end-to-end check after Day 1:

| Test | Expected |
|---|---|
| Visit http://localhost:3000 | Marketing landing renders |
| **Get Started** → register a candidate | Form submits |
| Check Mailpit (http://localhost:8025) | Verification email present |
| Click verify link from Mailpit | Redirected to onboarding |
| Open backend Swagger: http://localhost:3333/api/docs | Endpoints listed |
| Visit `/candidate` while logged out | Middleware redirects to `/login` |

If anything fails, see Troubleshooting.

---

## Step 11: (Day 4) Production Deployment

### Frontend → Vercel

1. Sign up / log in at https://vercel.com
2. **Add New** → **Project** → Import your GitHub repo
3. Configure:
   - **Root Directory:** `apps/web`
   - **Framework Preset:** Next.js
   - **Build Command:** (default)
   - **Output Directory:** (default)
   - **Install Command:** `pnpm install` (Vercel auto-detects monorepo + pnpm)
4. Environment variables: paste contents of `apps/web/.env.local` (replace `NEXT_PUBLIC_API_URL` with Railway URL once known)
5. Deploy

### Backend → Railway

1. Sign up / log in at https://railway.app
2. **New Project** → **Deploy from GitHub repo**
3. Configure:
   - **Root Directory:** `apps/api`
   - **Build Command:** `pnpm install --frozen-lockfile && pnpm --filter @aurahire/api build`
   - **Start Command:** `pnpm --filter @aurahire/api start:prod`
4. Add Redis addon: **+ New** → **Database** → **Add Redis**. Railway auto-injects `REDIS_URL`.
5. Environment variables: paste `apps/api/.env` (replace localhost values with production Supabase + Redis URLs; `NODE_ENV=production` to switch email transport to Resend)
6. Configure custom domain later if needed
7. Note the public URL (e.g. `aurahire-api.up.railway.app`)

### Wire Frontend to Backend

In Vercel project settings:
- Update `NEXT_PUBLIC_API_URL` to your Railway URL: `https://aurahire-api.up.railway.app`
- Trigger redeploy

In Supabase Auth:
- Add Vercel URL to allowed redirect URLs

---

## Daily Dev Workflow

```bash
# 1. Ensure Docker Desktop is running, then start local services (only needed once per session)
docker compose -f docker-compose.dev.yml up -d

# 2. Start both apps (frontend + backend)
pnpm dev

# In a second terminal: Drizzle Studio for DB inspection
pnpm --filter @aurahire/db drizzle-kit studio

# Type-check both apps
pnpm type-check

# Lint
pnpm lint

# Format
pnpm format
```

Stop dev:
- `Ctrl+C` in the `pnpm dev` terminal
- Optional: `docker compose -f docker-compose.dev.yml down` to stop Mailpit + Redis (or leave them running across sessions — they persist data via volumes)

---

## Troubleshooting

### `pnpm dev` only starts one app
- Check `turbo.json` has `dev` task with `persistent: true`
- Check both `apps/web/package.json` and `apps/api/package.json` have a `dev` script

### Backend can't connect to Postgres
- Verify `DATABASE_URL` uses pooler port `6543` (transaction mode)
- Verify `[YOUR-PASSWORD]` was replaced

### Frontend can't reach backend
- Verify `NEXT_PUBLIC_API_URL=http://localhost:3333` in `apps/web/.env.local`
- Verify backend is running (look for `[Nest]` log lines in `pnpm dev` output)
- Verify CORS: backend `ALLOWED_ORIGINS` includes `http://localhost:3000`

### Mailpit not catching emails
- Verify Docker Desktop is running
- Verify container is up: `docker compose -f docker-compose.dev.yml ps`
- Verify backend `.env` has `SMTP_HOST=localhost SMTP_PORT=1025`
- Verify `NODE_ENV=development` so backend uses Nodemailer SMTP transport
- Try restarting: `docker compose -f docker-compose.dev.yml restart mailpit`

### Redis connection refused
- Verify Docker Desktop is running
- Verify Redis container: `docker compose -f docker-compose.dev.yml ps`
- Test connection: `docker exec aurahire-redis redis-cli ping` should return `PONG`
- Verify backend `.env` has `REDIS_URL=redis://localhost:6379`
- Try restarting: `docker compose -f docker-compose.dev.yml restart redis`

### Docker Compose: port already in use
- Another process is bound to 1025/8025/6379 — find and stop it: `lsof -i :6379`
- Or change the host port in `docker-compose.dev.yml` (e.g. `"6380:6379"`) and update `REDIS_URL` accordingly

### Backend `Row-level security policy violated`
- Service role client should be used for system operations (audit log, admin queries) — verify the right Supabase client is used
- Verify RLS policies match the operation being performed

### Resume parsing fails
- Verify OpenAI API key has billing balance
- Check backend logs: `apps/api:dev:` lines should show parse attempts

### `pnpm install` fails
- Verify Node 20+ and pnpm 9+
- Try `rm -rf node_modules pnpm-lock.yaml && pnpm install`

### Storage upload fails
- Verify `resumes` bucket exists in Supabase
- Verify backend uses service-role client for uploads (not anon)

---

## Phase 2 / Production Hardening (Out of Sprint)

For later:
- Custom domain on Vercel + Railway
- Verified Resend sender domain (e.g. `mail.aurahire.com`)
- Sentry for error tracking
- Upstash QStash if scaling beyond Railway worker capacity
- DNS records (SPF/DKIM/DMARC) for email deliverability
- GitHub Actions CI

---

## Sanity-Save Routine

End of every dev session:
1. `Ctrl+C` to stop `pnpm dev`
2. `git add . && git commit -m "WIP: <slice description>"`
3. Push to remote
4. Verify Supabase project not auto-paused (free tier auto-pauses after 1 week idle)
5. Optional: stop Docker services to free resources: `docker compose -f docker-compose.dev.yml down` (volumes persist; restart anytime with `up -d`)

---

## Known Gaps

- No `dotenv-vault` integration; manual `.env` files
- Mailpit doesn't persist across container restarts (acceptable for dev)
- Supabase free tier has 1 project; sharing dev between contributors requires more discipline (Phase 2: separate dev/staging/prod projects)
