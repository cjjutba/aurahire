# AuraHire System Architecture

**Version:** 2.0.0 (Split Architecture)
**Last Updated:** May 1, 2026
**Status:** Locked for Sprint
**Depends on:** `tech-stack.md`, `project-structure.md`, `best-practices.md`

This document is the high-level technical blueprint of AuraHire's split frontend/backend architecture: how components fit together, how requests flow, how data moves, and how security is layered.

---

## High-Level Architecture

```
                    ┌────────────────────────────────────┐
                    │        User (Browser)              │
                    │ React Server / Client Components   │
                    └────────────┬───────────────────────┘
                                 │ HTTPS
                                 │
        ┌────────────────────────▼─────────────────────────┐
        │   Frontend — Next.js 16 (Vercel)                 │
        │   apps/web                                       │
        │   - Pages, layouts, Server Components            │
        │   - Auth UI (Supabase SDK on client)             │
        │   - Forms (RHF + Zod)                            │
        │   - TanStack Query → auto-generated API client   │
        │   - NO direct DB access. NO direct AI calls.     │
        └────────────────────────┬─────────────────────────┘
                                 │ HTTPS / JWT
                                 │ Authorization: Bearer <jwt>
                                 │
        ┌────────────────────────▼─────────────────────────┐
        │   Backend — NestJS (Digital Ocean Droplet, PM2)  │
        │   apps/api                                       │
        │   - REST API + Swagger UI at /api/docs           │
        │   - SupabaseAuthGuard (validates JWT)            │
        │   - RolesGuard (RBAC)                            │
        │   - Modules: auth, users, profiles, jobs,        │
        │     applications, resumes, scoring, bias,        │
        │     interviews, offers, admin, audit             │
        │   - Drizzle ORM (DB access)                      │
        │   - BullMQ (background jobs)                     │
        │   - @nestjs/schedule (cron)                      │
        │   - @nestjs/cache-manager (Redis cache)          │
        │   - @nestjs/throttler (rate limit)               │
        │   - Pino logger                                  │
        │   - OpenAI SDK (server-only)                     │
        └──┬─────────┬──────────┬──────────┬──────────┬────┘
           │         │          │          │          │
   ┌───────▼──┐ ┌────▼────┐ ┌──▼─────┐ ┌──▼──────┐ ┌─▼──────┐
   │ Supabase │ │  Redis  │ │ OpenAI │ │ Email   │ │Supabase│
   │ Postgres │ │(Docker  │ │  API   │ │ Mailpit │ │ Storage│
   │  + RLS   │ │ on DO   │ │        │ │  (dev)  │ │        │
   │          │ │ Droplet)│ │        │ │ Resend  │ │        │
   │          │ │ Cache + │ │        │ │ (prod)  │ │        │
   │          │ │ Queue + │ │        │ │         │ │        │
   │          │ │ Throttle│ │        │ │         │ │        │
   └──────────┘ └─────────┘ └────────┘ └─────────┘ └────────┘
```

**Key principle:** the frontend is a UI layer. All business logic, data access, AI calls, file storage, queue processing, scheduled tasks, and email sends happen in the backend. The frontend only renders, validates input, and calls the backend's REST API.

---

## Layered Architecture (per app)

### Frontend (`apps/web`)

| Layer      | Folder                                         | Role                                                                    |
| ---------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| Routes     | `app/`                                         | App Router routes, layouts, server components, page-level data fetching |
| Components | `components/`                                  | Reusable UI (shadcn primitives + feature components)                    |
| API Client | `packages/shared/api-client/` (auto-generated) | Typed REST client with TanStack Query hooks                             |
| Forms      | `components/<feature>/*-form.tsx`              | RHF + Zod schemas from `packages/shared/`                               |
| Auth       | `lib/auth/`                                    | Supabase client (browser + server) for login/register/session           |
| Utilities  | `lib/utils/`                                   | Helpers (`cn`, formatters)                                              |

### Backend (`apps/api`)

| Layer        | Folder                                          | Role                                          |
| ------------ | ----------------------------------------------- | --------------------------------------------- |
| Modules      | `src/modules/<feature>/`                        | NestJS modules (one per feature)              |
| Controllers  | `src/modules/<feature>/<feature>.controller.ts` | REST endpoints, Swagger decorators, DTOs      |
| Services     | `src/modules/<feature>/<feature>.service.ts`    | Business logic                                |
| Repositories | `src/modules/<feature>/<feature>.repository.ts` | DB access via Drizzle                         |
| Guards       | `src/common/guards/`                            | `SupabaseAuthGuard`, `RolesGuard`             |
| Interceptors | `src/common/interceptors/`                      | Logging, audit, response shaping              |
| AI           | `src/ai/`                                       | Prompts, schemas, parser/scorer/bias services |
| Queue        | `src/queue/`                                    | BullMQ workers + processors                   |
| Cron         | `src/cron/`                                     | Scheduled tasks                               |
| Email        | `src/email/`                                    | Nodemailer (dev) + Resend (prod) transport    |
| Storage      | `src/storage/`                                  | Supabase Storage helpers                      |
| Audit        | `src/audit/`                                    | Audit log service                             |
| Config       | `src/config/`                                   | Env-typed config module                       |

### Shared (`packages/shared`)

| Folder        | Role                                                                                   |
| ------------- | -------------------------------------------------------------------------------------- |
| `schemas/`    | Zod schemas (auth, jobs, applications, etc.) — used by both apps                       |
| `enums/`      | Discriminated string union enums (UserRole, ApplicationStatus, etc.)                   |
| `constants/`  | Numeric thresholds, score-band cutoffs, sizes                                          |
| `api-client/` | Auto-generated TS client + TanStack Query hooks (built from `apps/api`'s OpenAPI spec) |
| `types/`      | Common TS types (AuthUser, Pagination)                                                 |

### Database (`packages/db`)

- Drizzle schema (table definitions)
- Type exports (`typeof <table>.$inferSelect`)
- RLS policies (SQL, applied separately by human via Supabase)

---

## Request Lifecycle

### A. Page Render (Server Component, no data)

Simplest case: static marketing page.

```
1. Browser → GET /
2. Vercel Edge runs middleware (no auth needed for /)
3. Server Component renders → HTML streamed to browser
4. Hydration of client islands (forms, animations)
```

### B. Page Render (Server Component, with data from backend)

```
1. Browser → GET /candidate/applications
2. Vercel Edge runs middleware
   - Reads supabase-auth-token cookie
   - If no session → redirect /login
   - If session.role !== "candidate" → redirect /403
3. Next.js routes to apps/web/app/(candidate)/candidate/applications/page.tsx
4. Server Component executes:
   a. Reads Supabase session via @supabase/ssr
   b. Calls backend: fetch(`${API_URL}/api/v1/applications`, { headers: { Authorization: `Bearer ${jwt}` } })
   c. Backend responds with applications JSON
5. React renders Server Component → HTML streamed
6. Browser hydrates Client Components (filters, sort)
```

### C. Mutation from frontend

```
1. User clicks "Apply" button on /candidate/jobs/[id]/apply
2. Client Component calls TanStack Query mutation (auto-generated from OpenAPI):
   await applyToJob.mutate({ jobId, resumeId, coverLetter })
3. TanStack Query → fetch POST /api/v1/applications with Authorization header
4. Backend (NestJS):
   a. SupabaseAuthGuard validates JWT (signature + expiry + JWKs)
   b. RolesGuard checks user.role === "candidate"
   c. Controller method runs:
      - Zod parses request body (DTO via nestjs-zod)
      - Authorization (job published, no duplicate application)
      - Service: insert into applications, compute match_score (AI call), insert evidence_excerpts
      - Audit log entry
      - Send email to recruiter via Mailpit/Resend
      - Return DTO
   d. Pino logs request + response
5. TanStack Query receives response → invalidates queries → router.push(/candidate/applications/[id])
```

### D. File Upload (Resume)

```
1. User selects PDF in onboarding step 1
2. Client component POST multipart/form-data to /api/v1/resumes/upload
3. Backend (NestJS):
   a. SupabaseAuthGuard validates JWT
   b. Multer middleware parses file
   c. Validate MIME + size + magic bytes
   d. Upload to Supabase Storage via service-role client
   e. Insert resumes row (parse_status='pending')
   f. Synchronously call AI parser
   g. Update parse_status='parsed' + parsed_data
   h. Return resume DTO with parsed structure
4. Client receives parsed data → wizard advances to step 2 with prefilled fields
```

### E. Background Job (Batch Re-score)

```
Admin triggers from /admin/ai-config:
1. Client → POST /api/v1/admin/scoring-config (new weights)
2. Backend updates scoring_config table
3. Backend enqueues batch-rescore job: bullQueue.add('rescore-batch', { configId })
4. BullMQ worker picks up job (separate process inside same NestJS app)
5. Worker iterates last N applications, re-computes match_score with new weights
6. Each completed application updates UI via polling (we don't use realtime in sprint)
7. Audit log entry per re-score
```

### F. Cron (Auto-archive past-deadline jobs)

```
@nestjs/schedule @Cron('0 2 * * *') runs daily at 02:00 UTC:
1. Service queries jobs WHERE application_deadline < now() AND status = 'published'
2. UPDATE jobs SET status = 'archived'
3. Audit log entries
4. Logged via Pino
```

---

## Auth Architecture

### Registration

```
1. Frontend: user fills register-candidate form → submitForm()
2. Frontend Server Action calls Supabase: supabase.auth.signUp(...)
3. Supabase: creates row in auth.users + sends verification email (or we override via Resend)
4. Frontend Server Action calls backend: POST /api/v1/profiles/init (with new user JWT)
5. Backend creates profiles + candidate_profiles rows
6. Frontend redirects to /verify-email/sent
```

### Login

```
1. Frontend: user fills login form → submitForm()
2. Frontend calls Supabase: supabase.auth.signInWithPassword(...)
3. Supabase issues JWT, stored as HTTP-only cookie via @supabase/ssr
4. Frontend reads profile from backend: GET /api/v1/profiles/me
5. Backend SupabaseAuthGuard validates JWT, returns profile + role + profile_completed
6. Frontend redirects:
   - profile_completed=false → /onboarding/[role]
   - else → /[role] dashboard
```

### Session verification on every backend call

```ts
// SupabaseAuthGuard (NestJS)
async canActivate(context: ExecutionContext): Promise<boolean> {
  const req = context.switchToHttp().getRequest();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new UnauthorizedException();

  // Fetch JWKs from Supabase (cached 24h)
  const jwks = await this.fetchJwks();
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `${process.env.SUPABASE_URL}/auth/v1`,
  });

  // Attach decoded user to request
  req.user = {
    id: payload.sub,
    email: payload.email,
    role: payload.user_metadata?.role,  // or fetched from profiles table
  };
  return true;
}
```

### RBAC

```ts
@Controller("jobs")
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class JobsController {
  @Post()
  @Roles("recruiter")
  create(@Body() dto: CreateJobDto, @CurrentUser() user: AuthUser) {
    return this.jobsService.create(dto, user);
  }
}
```

### Three-layer defense

1. **Frontend middleware** — redirect unauthenticated users at the URL level
2. **Backend guards** — `SupabaseAuthGuard` + `RolesGuard` reject invalid/wrong-role calls
3. **Postgres RLS** — every table policy enforces `auth.uid()` and role checks

Even if a bug bypasses 1 and 2, the database refuses unauthorized reads/writes.

---

## API Style

### REST + OpenAPI / Swagger

- All endpoints under `/api/v1/...`
- DTO validation via `nestjs-zod` (Zod schemas from `packages/shared/`)
- Auto-generated Swagger UI at `https://<api-host>/api/docs`
- OpenAPI spec written to `packages/shared/openapi.json` on build → consumed by `orval` to generate TS client

### Request shape

```http
POST /api/v1/applications
Authorization: Bearer <supabase-jwt>
Content-Type: application/json

{
  "jobId": "uuid",
  "resumeId": "uuid",
  "coverLetter": "string"
}
```

### Response shape (success)

```json
{
  "id": "uuid",
  "jobId": "uuid",
  "candidateId": "uuid",
  "status": "applied",
  "matchScore": { "overallScore": 78, "band": "strong", "components": [...] },
  "appliedAt": "2026-05-01T12:34:56Z"
}
```

### Response shape (error)

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [{ "path": "jobId", "message": "Invalid uuid" }],
  "timestamp": "2026-05-01T12:34:56Z",
  "path": "/api/v1/applications"
}
```

NestJS exception filter normalizes all errors to this shape.

---

## Background Jobs Architecture

### Tech: BullMQ + Redis

NestJS module: `@nestjs/bullmq`. Redis runs as a Docker container on the same Digital Ocean Droplet as the API process (localhost-bound, zero network latency).

### Worker pattern

```ts
@Processor("rescore-batch")
export class RescoreBatchProcessor extends WorkerHost {
  constructor(private scoringService: ScoringService) {
    super();
  }
  async process(job: Job<{ configId: string }>): Promise<void> {
    const applications = await this.applicationsService.findRecent(100);
    for (const app of applications) {
      await this.scoringService.recomputeMatch(app.id);
      await job.updateProgress((idx / applications.length) * 100);
    }
  }
}
```

Worker runs **inside the same NestJS process** as the API. For sprint scale, this is sufficient. For production scaling (Phase 2), workers can be split into a dedicated process (`apps/api-worker/`) sharing `apps/api`'s code.

### Jobs in sprint scope

| Job                | Trigger                                       | Purpose                                   |
| ------------------ | --------------------------------------------- | ----------------------------------------- |
| `rescore-batch`    | Admin clicks "Apply weights to last 100 apps" | Re-scores applications with new weights   |
| `digest-recruiter` | Cron-triggered                                | Weekly summary email to active recruiters |

---

## Cron Architecture

### Tech: `@nestjs/schedule`

Decorator-based:

```ts
@Injectable()
export class CleanupCron {
  @Cron("0 2 * * *") // daily 02:00 UTC
  async expireOffers() {
    await this.offersService.expirePastDate();
  }

  @Cron("0 3 * * *")
  async archivePastDeadlineJobs() {
    await this.jobsService.archivePastDeadline();
  }

  @Cron("0 4 * * 0") // weekly Sunday 04:00 UTC
  async cleanupUnverifiedAccounts() {
    await this.usersService.deleteUnverifiedOlderThan(7);
  }
}
```

Cron jobs run inside the main NestJS process. For sprint scale, sufficient.

### Crons in sprint scope

1. **`expireOffers`** (hourly) — set `offers.status='expired'` past `expires_at`
2. **`archivePastDeadlineJobs`** (daily) — auto-archive jobs past `application_deadline`
3. **`cleanupUnverifiedAccounts`** (weekly) — delete unverified accounts > 7 days old

---

## Caching Architecture

### Tech: `@nestjs/cache-manager` with Redis store

### Cache pattern

```ts
@Injectable()
export class AnalyticsService {
  @Cacheable({ ttl: 300 }) // 5 minutes
  async getSystemAnalytics() {
    return this.repo.aggregateAll();
  }
}
```

### Cached surfaces

| Surface                        | TTL  | Reason                                    |
| ------------------------------ | ---- | ----------------------------------------- |
| Public job listings (homepage) | 60s  | Reduce DB load on hot reads               |
| Admin analytics aggregations   | 300s | Heavy SQL, infrequent change              |
| Bias monitor metrics           | 300s | Same                                      |
| Job detail public page         | 60s  | Cache-able by job_id                      |
| Scoring config (active row)    | 600s | Changes rarely; invalidated on admin save |

Cache invalidation: explicit `cacheManager.del(key)` in services that mutate data.

### Frontend caching

- Next.js Data Cache for static marketing
- TanStack Query client cache for portal data (5-minute stale time default)

---

## Email Architecture

### Transport switching

```ts
// apps/api/src/email/email.service.ts
@Injectable()
export class EmailService {
  private transport: Transporter;

  constructor(@Inject("CONFIG") private config: AppConfig) {
    if (config.NODE_ENV === "production") {
      // Resend via API
      this.transport = createResendTransport({ apiKey: config.RESEND_API_KEY });
    } else {
      // Nodemailer SMTP → Mailpit
      this.transport = nodemailer.createTransport({
        host: config.SMTP_HOST, // localhost
        port: config.SMTP_PORT, // 1025
        secure: false,
        auth: undefined, // Mailpit accepts no-auth
      });
    }
  }

  async send(template: ReactElement, opts: { to: string; subject: string }) {
    const html = await render(template);
    await this.transport.sendMail({
      from: this.config.FROM_EMAIL,
      to: opts.to,
      subject: opts.subject,
      html,
    });
  }
}
```

### Templates

React Email components in `apps/api/src/email/templates/`. Same templates render to HTML in both transports.

---

## File Storage Architecture

### Tech: Supabase Storage with private bucket + signed URLs

```
Frontend uploads → Backend route handler:
  - Validate MIME, size
  - Generate UUID-based path: resumes/{candidateId}/{uuid}.pdf
  - Stream to Supabase Storage via service-role client
  - Insert resumes row with storage_path
  - Return resume DTO + signed URL

Frontend downloads → Backend issues signed URL:
  - GET /api/v1/resumes/:id/download
  - Backend verifies access (user owns resume OR recruiter views applicant's resume OR admin)
  - Generate signed URL (1-hour expiry)
  - Return URL → client redirects
```

### Buckets

- `resumes` — private; signed-URL-only access
- `avatars` — public-read for thumbnails
- `company-logos` — public-read

---

## Deployment Topology

```
GitHub repo (main branch)
    │
    ├──► Vercel ──────────────► aurahire.vercel.app (frontend, auto-deploy)
    │       env: NEXT_PUBLIC_API_URL=https://api.<your-domain>
    │             NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
    │
    ├──► Digital Ocean Droplet ─► api.<your-domain> (backend, manual SSH deploy)
    │       │
    │       │  Caddy (0.0.0.0:80/443, auto Let's Encrypt)
    │       │      └─► reverse-proxy to 127.0.0.1:3333
    │       │
    │       ├─ NestJS API (Node 20, PM2-managed, port 3333)
    │       │     env (in deploy/.env): DATABASE_URL (Supabase),
    │       │           SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY,
    │       │           RESEND_API_KEY, REDIS_URL=redis://:<pw>@127.0.0.1:6379,
    │       │           SMTP_HOST=127.0.0.1 SMTP_PORT=1025 (Mailpit fallback)
    │       │
    │       └─ Docker (deploy/docker-compose.prod.yml)
    │             ├─ redis:7-alpine on 127.0.0.1:6379 (BullMQ + cache + throttle)
    │             └─ axllent/mailpit on 127.0.0.1:1025 + 127.0.0.1:8025
    │                  (web UI tunnelled via SSH for inspection only)
    │
    └──► Supabase Cloud ─────────► Postgres + Auth + Storage (managed)
```

Both Redis and Mailpit bind to **`127.0.0.1` only** — never reachable from the public internet. Caddy is the only listener on `0.0.0.0`.

For local dev:

```
Mac (pnpm dev at root)
    ├──► apps/web on localhost:3000
    └──► apps/api on localhost:3333
            │
            ├──► Supabase Cloud (DB + Auth + Storage)
            ├──► localhost:1025 (Mailpit SMTP) → localhost:8025 (web UI)
            ├──► OpenAI API
            └──► Local Redis (Docker via docker-compose.dev.yml)
```

---

## Observability (Sprint Stance)

- **Logs:** Pino structured JSON → Vercel logs (frontend) + PM2 log files on the Droplet (`pm2 logs aurahire-api`, files under `/home/deploy/.pm2/logs/`)
- **Metrics:** none in sprint
- **Traces:** none in sprint
- **Alerting:** none

The `audit_logs` table itself is a form of observability — every consequential action recorded and queryable via the admin portal.

For Phase 2: Sentry for errors, PostHog for product analytics, OpenTelemetry for traces.

---

## Security Architecture

### Defense in depth

| Layer                           | Control                                                                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Network                      | HTTPS via Vercel (auto TLS) on frontend; Caddy + Let's Encrypt (auto-renew) on the DO Droplet for the API. Redis + Mailpit are localhost-only, never publicly reachable |
| 2. Frontend middleware          | Auth-required redirects, role-based URL gating                                                                                                                          |
| 3. CORS                         | Backend allows only `${NEXT_PUBLIC_APP_URL}` origin                                                                                                                     |
| 4. Backend Helmet               | Security headers (X-Content-Type, CSP, HSTS)                                                                                                                            |
| 5. Backend Guards               | `SupabaseAuthGuard` + `RolesGuard` on every protected controller                                                                                                        |
| 6. Backend DTO validation       | Zod via nestjs-zod at every endpoint                                                                                                                                    |
| 7. Backend authorization checks | Per-resource ownership checks in services                                                                                                                               |
| 8. Database RLS                 | Postgres policies enforce row-level access                                                                                                                              |
| 9. Audit log                    | Forensic trail of every consequential action                                                                                                                            |

### Secret management

- All secrets in `.env.local` (gitignored) for dev
- Vercel encrypted env vars for the frontend; backend secrets live in `deploy/.env` on the Droplet (`chmod 600`, owned by the deploy user, never committed)
- `NEXT_PUBLIC_*` vars are bundled into client JS — only safe values (Supabase anon key, app URL, API URL) live there
- OpenAI key, Resend key, Supabase service role key, DB password: backend-only, never `NEXT_PUBLIC_*`

### Rate limiting

- `@nestjs/throttler` with Redis store
- Per-route configuration via decorator: `@Throttle({ default: { limit: 5, ttl: 60000 } })`

---

## Data Flow Maps

### A. Candidate Onboarding & Profile Scoring

```
Step 1 — Resume Upload + Parse:
  Frontend → POST /api/v1/resumes/upload (multipart)
  Backend: validate → Supabase Storage → Insert row → AI parse → Update parsed_data
  Returns: { resumeId, parsedData }
  Frontend: prefill steps 2-6

Steps 2-6 — Review & Edit:
  Frontend → PATCH /api/v1/candidate-profiles/:section per step

Step 7 — Compute Profile Score:
  Frontend → POST /api/v1/scoring/profile/:candidateId
  Backend: load resume + prefs → PII redact → OpenAI score → Insert profile_scores + evidence_excerpts → Audit
  Returns: full Profile Score DTO with breakdown
  Frontend: render Score Ring + Breakdown
```

### B. Application & Match Scoring

```
Frontend (candidate) → POST /api/v1/applications { jobId, resumeId, coverLetter }
Backend:
  - Authorize (job published, no duplicate)
  - Insert applications row
  - PII redact resume → OpenAI match-score → Insert match_scores + evidence_excerpts
  - Send application-received email to recruiter via Mailpit/Resend
  - Audit log
  - Return full Application DTO with embedded matchScore
Frontend: redirect to /candidate/applications/[id]
```

### C. Job Posting with Bias Check

```
Frontend (recruiter) writes description → on blur:
  POST /api/v1/bias/check { text }
  Backend: OpenAI bias-check → return flags
  Frontend: render chip-bias-flag overlays inline

On Publish click:
  POST /api/v1/jobs/:id/publish (with optional overrides)
  Backend:
    - Re-run bias check (defense)
    - If unresolved flags + no overrides → return 422 with flags array
    - Else: Insert bias_flags rows (resolved/overridden), UPDATE jobs SET status='published'
    - Audit log
```

### D. Admin Score Audit

```
Frontend (admin) → GET /api/v1/admin/applications/:id
Backend:
  - SupabaseAuthGuard + RolesGuard("admin")
  - Load application + match_score + evidence_excerpts + redacted resume snapshot
  - Return full DTO including raw_output JSON from OpenAI
Frontend: render Score Breakdown + Evidence + raw output drawer
```

---

## Architectural Decisions Log

| Decision                                               | Rationale                                                                                                                                                                                                                                 |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Split frontend (Next.js) + backend (NestJS)            | User experience: prior pure-Next.js attempt struggled with smoothness/perf; split allows long-running worker process for jobs/cron + cleaner separation of concerns                                                                       |
| NestJS over Express/Fastify                            | Decorator-based modular architecture matches features; first-party plugins for queue/cron/cache/throttle/swagger; thesis-defensible                                                                                                       |
| Fastify adapter under NestJS                           | 2× perf vs Express baseline at no DX cost                                                                                                                                                                                                 |
| REST + Swagger over tRPC/GraphQL                       | Industry-standard, auto-documented, language-agnostic; thesis can hand examiner a Swagger URL                                                                                                                                             |
| Turborepo + pnpm workspaces                            | Shared `packages/shared` for Zod schemas; cached builds; industry default                                                                                                                                                                 |
| Digital Ocean Droplet for backend hosting              | Explicit, demo-defensible infrastructure for a thesis: every moving part (Node + PM2 + Docker Redis + Caddy) is visible and editable. Redis runs on the same host (localhost = zero network latency). No PaaS magic to explain to a panel |
| Vercel for frontend hosting                            | Native Next.js; preview URLs                                                                                                                                                                                                              |
| BullMQ for jobs                                        | Mature; first-party NestJS support                                                                                                                                                                                                        |
| `@nestjs/schedule` for cron                            | Decorator-based; trivial to add scheduled tasks                                                                                                                                                                                           |
| `@nestjs/cache-manager` + Redis                        | Decorator-based caching; works for HTTP and service layers                                                                                                                                                                                |
| `@nestjs/throttler` + Redis                            | Persistent rate limiting; per-route control                                                                                                                                                                                               |
| Mailpit (dev) + Resend (prod)                          | Standard pattern; no real emails sent in dev; React Email templates work in both                                                                                                                                                          |
| Frontend Supabase Auth + Backend JWT validation        | Reuses Supabase email flows; backend stays stateless                                                                                                                                                                                      |
| Backend-only AI calls                                  | Security (key not in browser); rate limiting; audit logging                                                                                                                                                                               |
| `gpt-4o-mini` model                                    | Cost + speed sufficient for thesis scope                                                                                                                                                                                                  |
| Direct LLM scoring (no embeddings)                     | LLM handles synonym matching natively; saves pgvector complexity                                                                                                                                                                          |
| Single-process worker (vs separate `apps/api-worker/`) | Sprint scale doesn't need split process; can refactor in Phase 2                                                                                                                                                                          |

---

## What This Architecture Does NOT Do

- No real-time websockets (in-app notifications poll on focus)
- No GraphQL / public API for third parties (Phase 2)
- No event sourcing (audit log is append-only but isn't ES architecture)
- No CQRS
- No service mesh / multi-service split beyond api + web
- No multi-region failover
- No A/B testing infrastructure

These are deliberate omissions. Adding them now dilutes focus from the thesis demo.

---

## Iteration Guide

When making architectural changes:

1. Update this doc first
2. Discuss in PR description
3. Add an entry to the decisions log above
4. Implement
5. Verify defense-in-depth still holds
