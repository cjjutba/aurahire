# AuraHire Technical Specifications

**Version:** 2.0.0 (REST API)
**Last Updated:** May 1, 2026
**Status:** Locked for Sprint
**Audience:** developers implementing features
**Depends on:** `prd.md`, `database-schema.md`, `ai-design.md`, `architecture.md`, `page-inventory.md`

This document is the per-feature implementation contract. For each feature, it specifies REST endpoints (request/response shapes), inputs, outputs, validation, edge cases, error handling, and UI states.

---

## API Conventions

### Base URL

- **Local dev:** `http://localhost:3333/api/v1`
- **Production:** `https://api.<your-domain>/api/v1` (Digital Ocean Droplet, fronted by Caddy with Let's Encrypt TLS)

Frontend reads `NEXT_PUBLIC_API_URL` env var; the auto-generated client in `packages/shared/api-client/` prepends `/api/v1` automatically.

### Authentication

All protected endpoints require `Authorization: Bearer <supabase-jwt>` header. The auto-generated client attaches this from the Supabase session automatically. Public endpoints (auth bootstrap, public job browsing) are decorated with `@Public()` on the backend.

### Standard Response Envelope

**Success (2xx):**
```json
{
  "data": { /* resource shape */ },
  "meta": { "requestId": "uuid", "timestamp": "2026-05-01T..." }
}
```

For paginated lists:
```json
{
  "data": [ /* items */ ],
  "meta": { "page": 1, "limit": 25, "total": 142, "totalPages": 6 }
}
```

**Error (4xx/5xx):**
```json
{
  "statusCode": 400,
  "code": "VALIDATION_FAILED",
  "message": "Validation failed",
  "errors": [{ "path": "email", "message": "Invalid email format" }],
  "timestamp": "2026-05-01T...",
  "path": "/api/v1/auth/register-candidate",
  "requestId": "uuid"
}
```

### Pagination

Standard query params: `?page=1&limit=25&sort=appliedAt:desc`. Default limit 25, max 100.

### HTTP Status Codes

| Code | Use |
|---|---|
| 200 | OK (GET, PATCH, action endpoints) |
| 201 | Created (POST creating resource) |
| 204 | No Content (DELETE) |
| 400 | Validation error |
| 401 | Unauthenticated (no/invalid JWT) |
| 403 | Forbidden (wrong role / no permission) |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate application) |
| 422 | Unprocessable (e.g., bias flags require override) |
| 429 | Rate limited |
| 500 | Server error |
| 503 | Service unavailable (AI down) |

---

## Spec Format

Every feature follows this template:

```
### Feature Name

**Endpoint:** `METHOD /path`
**Auth:** which roles
**Module:** apps/api/src/modules/<feature>/

**Request:** body shape (Zod schema reference from packages/shared)
**Response:** success shape
**Validation:** schema name
**Authorization:** ownership / role checks
**Side effects:** DB writes, AI calls, emails, audit, cache invalidation
**UI states:** loading / empty / error
**Edge cases:** explicitly enumerated
```

---

## Authentication

### Register Candidate

**Endpoint:** `POST /api/v1/auth/register-candidate` (called from frontend Server Action via Supabase SDK directly + this for backend profile init)

**Auth:** Public

**Module:** `apps/api/src/modules/auth/`

**Flow:**
1. Frontend calls `supabase.auth.signUp({ email, password, options: { data: { full_name, phone } } })` directly
2. Supabase creates `auth.users` row + sends verification email (we override template via Resend in production)
3. Frontend then calls `POST /api/v1/auth/register-candidate` with the new JWT to initialize the profile

**Request:**
```json
{
  "fullName": "Maria Reyes",
  "phone": "+639171234567"
}
```

**Validation:** `registerCandidateSchema` in `packages/shared/src/schemas/auth.ts`. (Email + password validated by Supabase upstream.)

**Authorization:** Authenticated user; `auth.uid()` from JWT becomes the new profile's id.

**Side effects:**
1. INSERT `profiles` (id from JWT, role='candidate', status='active')
2. INSERT `candidate_profiles` (id, profile_completed=false)
3. Audit log `action='user.registered.candidate'`

**Response (201):**
```json
{
  "data": { "id": "uuid", "role": "candidate", "profileCompleted": false }
}
```

**Edge cases:**
| Case | Handling |
|---|---|
| JWT not found | 401 |
| Profile already exists | 409 — return existing profile |
| Phone format invalid | 400 with error |

---

### Register Recruiter

**Endpoint:** `POST /api/v1/auth/register-recruiter`

Same flow as candidate, plus creates company record.

**Request:**
```json
{ "fullName": "Alex Cruz", "phone": "+639171234567", "companyName": "Acme Corp" }
```

**Side effects:**
1. INSERT `companies` (created_by from JWT)
2. INSERT `profiles` (role='recruiter')
3. INSERT `recruiter_profiles` (company_id, profile_completed=false)
4. Audit log

---

### Get Current Profile

**Endpoint:** `GET /api/v1/profiles/me`

**Auth:** Authenticated (any role)

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "email": "maria@test.com",
    "fullName": "Maria Reyes",
    "role": "candidate",
    "status": "active",
    "profileCompleted": false,
    "avatarUrl": null,
    "candidateProfile": { /* if role=candidate */ },
    "recruiterProfile": { /* if role=recruiter */ }
  }
}
```

Used by frontend to determine post-login routing.

---

### Logout

**Endpoint:** Frontend handles via `supabase.auth.signOut()` directly.

Backend logs the event when the next protected request fails (no separate endpoint). Audit log entry `action='user.logout'` may be omitted in sprint scope (silent logout is acceptable).

---

### Forgot / Reset Password / Verify Email

These flows happen entirely between frontend and Supabase Auth — backend not involved beyond the eventual `GET /profiles/me` after login. No custom endpoints needed.

---

## Onboarding

### Resume Upload

**Endpoint:** `POST /api/v1/resumes/upload` (multipart/form-data)

**Auth:** Candidate role required

**Request:** `multipart/form-data` with `file` field

**Validation:**
- MIME: `application/pdf` or `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Size: 10MB max
- Server-side: re-validate MIME + magic byte sniff

**Side effects:**
1. Upload to Supabase Storage path `resumes/{candidateId}/{uuid}.pdf` (service role)
2. INSERT `resumes` row (parse_status='pending', is_default=true if first resume)
3. Synchronously call `ParseResumeService.parse()` — extract text + AI structured output
4. UPDATE `resumes` SET parsed_data, parse_status='parsed' (or 'failed' on error)
5. Audit logs: `resume.uploaded`, `resume.parsed` (or `resume.parse_failed`)

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "filename": "maria-resume.pdf",
    "parseStatus": "parsed",
    "parsedData": { /* full ParsedResume JSON */ },
    "parseConfidence": "high"
  }
}
```

**UI states:**
- Idle: dropzone
- Uploading: progress bar
- Parsing: AI Shimmer "AI is parsing your resume..."
- Success: extracted-fields confirmation
- Failure: friendly fallback message; user can fill out manually

**Edge cases:**
| Case | Handling |
|---|---|
| File too large | 400 |
| Wrong MIME | 400 |
| Network failure | 500; client retry |
| Parse timeout (>30s) | parse_status='failed'; client allows manual fill |
| OCR-garbled PDF | parseConfidence='low'; UI shows soft warning |

---

### Save Candidate Profile Section

**Endpoints:**
- `PATCH /api/v1/candidate-profiles/personal`
- `PATCH /api/v1/candidate-profiles/education`
- `PATCH /api/v1/candidate-profiles/experience`
- `PATCH /api/v1/candidate-profiles/skills`
- `PATCH /api/v1/candidate-profiles/preferences`

**Auth:** Candidate role; updating own profile

**Validation:** Per-section Zod schemas in `packages/shared/`.

**Side effects:**
1. UPDATE `candidate_profiles` for the relevant fields
2. (Skills/experience may be embedded JSONB or separate tables — see `database-schema.md`)
3. Audit log if material change

**Response:** Updated section payload.

---

### Compute Profile Score

**Endpoint:** `POST /api/v1/scoring/profile/compute`

**Auth:** Candidate role; computes own score

**Request body:** none (uses authenticated candidate id) or `{ resumeId?: string }` to score a specific resume version.

**Side effects:**
1. Load redacted resume + preferences
2. Apply PII redaction
3. Call OpenAI with profile-score prompt
4. INSERT `profile_scores` + `evidence_excerpts` rows
5. UPDATE `candidate_profiles.profile_completed=true`
6. Audit log `score.profile.computed`

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "overallScore": 78,
    "band": "strong",
    "components": [
      { "name": "completeness", "score": 22, "max": 25, "weight": 25, "explanation": "...", "evidence": [...] },
      { "name": "skill_depth", "score": 26, "max": 30, "weight": 30, "explanation": "...", "evidence": [...] },
      { "name": "experience_clarity", "score": 22, "max": 30, "weight": 30, "explanation": "...", "evidence": [...] },
      { "name": "education_quality", "score": 8, "max": 15, "weight": 15, "explanation": "...", "evidence": [...] }
    ],
    "improvementSuggestions": [
      { "title": "Add cloud certifications", "description": "...", "estimatedImpact": 6 }
    ]
  }
}
```

**Rate limit:** 1 request / 60s per user.

**Edge cases:**
| Case | Handling |
|---|---|
| AI service down | 503; UI shows "Score temporarily unavailable" + retry |
| AI invalid output | should never happen with structured outputs; logged + returns 500 |

---

### Save Recruiter Profile Section

**Endpoints:**
- `PATCH /api/v1/recruiter-profiles/about`
- `PATCH /api/v1/recruiter-profiles/company`
- `PATCH /api/v1/recruiter-profiles/focus`

Standard form-per-step Server Action endpoints; no AI involvement.

---

## Job Management

### Create Job (Draft)

**Endpoint:** `POST /api/v1/jobs`

**Auth:** Recruiter role

**Request:**
```json
{
  "title": "Senior Engineer",
  "department": "Engineering",
  "employmentType": "full-time",
  "workMode": "remote",
  "location": { "city": "Manila", "country": "PH" },
  "salaryMin": 1500000,
  "salaryMax": 2500000,
  "salaryCurrency": "PHP",
  "description": "<p>HTML from Tiptap</p>",
  "descriptionPlain": "Plain text mirror",
  "requiredSkills": ["TypeScript", "Node.js", "PostgreSQL"],
  "experienceLevel": "senior",
  "educationRequirement": "bachelor",
  "applicationDeadline": "2026-06-30"
}
```

**Validation:** `createJobSchema`.

**Authorization:** Recruiter; `recruiter_profiles.profile_completed=true`.

**Side effects:**
1. INSERT `jobs` (status='draft', recruiter_id, company_id from recruiter's profile)
2. Audit log `job.created`
3. Cache invalidation: public job listing cache

**Response (201):** Full job DTO.

---

### Bias Check (during job editing)

**Endpoint:** `POST /api/v1/bias/check`

**Auth:** Recruiter role

**Request:**
```json
{ "text": "We need a rockstar engineer ready for fast-paced startup vibes" }
```

**Side effects:**
- AI call only; no DB writes (flags persist on publish, not on every check)
- Rate-limited to prevent over-calling during typing

**Response:**
```json
{
  "data": {
    "flags": [
      {
        "term": "rockstar",
        "category": "gendered",
        "severity": "medium",
        "explanation": "Often associated with male candidates",
        "suggestion": "top performer / highly skilled engineer",
        "positionStart": 11,
        "positionEnd": 19
      }
    ]
  }
}
```

**Rate limit:** 10 / 60s per user.

---

### Publish Job

**Endpoint:** `POST /api/v1/jobs/:id/publish`

**Auth:** Recruiter role; owns job; job.status='draft'

**Request (optional overrides):**
```json
{
  "overrides": [
    { "term": "rockstar", "reason": "Internal team band reference; no exclusion intent" }
  ]
}
```

**Side effects:**
1. Re-run bias check on description
2. If unresolved flags + no overrides → return **422** with flags array
3. Else:
   - INSERT `bias_flags` rows (status='resolved' if recruiter cleaned, 'overridden' if explicitly overridden with reason)
   - UPDATE `jobs` SET status='published', published_at=now()
   - Audit log `job.published`
4. Cache invalidation

**Response (200):** Updated job DTO.

**Edge cases:**
| Case | Status |
|---|---|
| Has flags, no overrides | 422 with `{ data: { needsOverride: true, flags: [...] } }` |
| All flags overridden | 200 |
| Recruiter doesn't own job | 403 |
| Job already published | 409 |

---

### Update / Archive / Duplicate Job

- `PATCH /api/v1/jobs/:id` — same validation as create; re-runs bias check on save
- `POST /api/v1/jobs/:id/archive` — sets status='archived'
- `POST /api/v1/jobs/:id/duplicate` — creates new draft from existing

All write audit logs, invalidate cache.

---

### Browse Jobs (Public)

**Endpoint:** `GET /api/v1/jobs`

**Auth:** Public (no JWT required)

**Query params:**
- `q`: search term (matches title + description_plain via tsvector)
- `mode`: remote / hybrid / on-site
- `industry`, `experience`: filters
- `location`: country/city
- `sort`: best-match (logged-in candidates only) / recent / salary-high
- `page`, `limit`

**Response:** paginated list of public job DTOs (excludes recruiter_id, internal flags).

**Caching:** 60s TTL on common query combos.

---

### Browse Jobs (Candidate)

**Endpoint:** `GET /api/v1/jobs/for-candidate`

**Auth:** Candidate role

Same as public listing but each job includes a `matchScorePreview` (lazily computed + cached for 24h per candidate-job pair).

**Response:** paginated jobs with embedded `matchScorePreview: { overallScore, band }`.

---

### Job Detail

**Endpoints:**
- `GET /api/v1/jobs/:id` — public
- `GET /api/v1/jobs/:id/for-candidate` — candidate-specific (includes match score)
- `GET /api/v1/jobs/:id/for-recruiter` — recruiter ownership view (includes draft analytics, applications count)

---

## Application Workflow

### Apply to Job

**Endpoint:** `POST /api/v1/applications`

**Auth:** Candidate role; `profile_completed=true`

**Request:**
```json
{
  "jobId": "uuid",
  "resumeId": "uuid",
  "coverLetter": "optional text"
}
```

**Validation:** `applyToJobSchema`.

**Authorization:**
- Job is `status='published'`
- Job's `application_deadline` is null or future
- Candidate hasn't already applied (DB UNIQUE constraint on `(candidate_id, job_id)`)

**Side effects:**
1. INSERT `applications` (status='applied')
2. Compute Match Score synchronously:
   - Load redacted resume + job
   - Apply PII redaction
   - Call OpenAI with match-score prompt
   - INSERT `match_scores` + `evidence_excerpts`
3. Send `application-received` email to recruiter
4. Audit logs: `application.created`, `score.match.computed`
5. Cache invalidation: candidate's applications list, recruiter's job applications list

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "jobId": "uuid",
    "candidateId": "uuid",
    "status": "applied",
    "matchScore": {
      "overallScore": 78,
      "band": "strong",
      "components": [...],
      "summary": "...",
      "redFlags": [...],
      "greenFlags": [...]
    },
    "appliedAt": "2026-05-01T..."
  }
}
```

**Edge cases:**
| Case | Status |
|---|---|
| Already applied | 409 |
| Job closed | 409 |
| Resume not parsed | 422 |
| AI scoring fails | 201 with `matchScore.status='failed'`; UI handles |

---

### Update Application Status (Recruiter)

**Endpoint:** `PATCH /api/v1/applications/:id/status`

**Auth:** Recruiter role; owns the job

**Request:**
```json
{ "newStatus": "interview", "note": "Strong skills match; let's chat" }
```

**Validation:** Valid transitions per state machine (see `prd.md` lifecycle).

**Side effects:**
1. UPDATE `applications.status` + `status_updated_at`
2. Optionally append to `recruiter_notes`
3. Send `application-status-changed` email to candidate
4. Audit log

---

### Withdraw Application (Candidate)

**Endpoint:** `POST /api/v1/applications/:id/withdraw`

**Auth:** Candidate; owns application; status not in (hired, rejected)

---

### List Candidate's Applications

**Endpoint:** `GET /api/v1/applications/mine`

**Auth:** Candidate

**Query:** filter by status, pagination.

---

### List Applications for a Job

**Endpoint:** `GET /api/v1/jobs/:id/applications`

**Auth:** Recruiter; owns job

Sortable by `bestMatch` (default), `appliedAt`, `recent`.

---

### Application Detail

**Endpoint:** `GET /api/v1/applications/:id`

**Auth:** Candidate (owner) OR Recruiter (owns job) OR Admin

Returns full application + match score + evidence + interview/offer if exist.

---

## Resume Management

### List My Resumes

**Endpoint:** `GET /api/v1/resumes/mine`

### Set Default Resume

**Endpoint:** `POST /api/v1/resumes/:id/set-default`

Atomically unsets prior default. Triggers async Profile Score recompute (queued via BullMQ).

### Download (signed URL)

**Endpoint:** `GET /api/v1/resumes/:id/download`

Returns 1-hour signed URL. Authorization: candidate owns OR recruiter views in application context OR admin.

---

## Interview Management

### Schedule Interview

**Endpoint:** `POST /api/v1/applications/:id/interviews`

**Auth:** Recruiter; owns the job

**Request:**
```json
{
  "scheduledAt": "2026-05-10T14:00:00Z",
  "durationMinutes": 60,
  "format": "video",
  "locationOrLink": "https://meet.example.com/abc",
  "notifyCandidate": true
}
```

**Side effects:**
1. INSERT `interviews`
2. UPDATE application status='interview' if currently 'screening'
3. Send `interview-scheduled` email
4. Audit log

---

### Record Feedback

**Endpoint:** `PATCH /api/v1/interviews/:id/feedback`

**Request:**
```json
{ "feedback": "Strong technical skills; communication good", "rating": 4, "status": "completed" }
```

---

### List Interviews

- `GET /api/v1/interviews/mine` (candidate or recruiter — different query)
- Filter: upcoming / past / cancelled

---

## Offer Management

### Send Offer

**Endpoint:** `POST /api/v1/applications/:id/offers`

**Auth:** Recruiter; owns job; application status in ('interview', 'offer')

**Request:**
```json
{
  "title": "Senior Engineer",
  "salary": 2000000,
  "salaryCurrency": "PHP",
  "startDate": "2026-06-01",
  "managerName": "Alex Cruz",
  "benefitsSummary": "Health, dental, 401k, RSUs",
  "customMessage": "We're excited to have you on board!"
}
```

**Side effects:**
1. INSERT `offers` (status='pending', expires_at=now()+7d)
2. UPDATE application.status='offer'
3. Send `offer-sent` email with rendered offer letter (React Email)
4. Audit log

---

### Accept / Decline Offer

**Endpoints:**
- `POST /api/v1/offers/:id/accept`
- `POST /api/v1/offers/:id/decline`

**Auth:** Candidate; owns application; offer.status='pending'; not expired

**Side effects:**
1. UPDATE offers.status + responded_at
2. UPDATE application.status: 'hired' (accept) or 'rejected' (decline)
3. Notify recruiter via email
4. Audit log

---

## Admin Endpoints

All under `/api/v1/admin/...`. All require admin role.

### Command Center Stats

**Endpoint:** `GET /api/v1/admin/stats/overview`

Cached 5min. Returns aggregated KPIs: total users, active jobs, applications, avg match score, etc.

---

### User Management

- `GET /api/v1/admin/users` — list with filters, pagination
- `GET /api/v1/admin/users/:id` — full user detail
- `POST /api/v1/admin/users/:id/suspend` — body: `{ reason }`
- `POST /api/v1/admin/users/:id/reactivate`
- `PATCH /api/v1/admin/users/:id/role` — body: `{ newRole }`
- `DELETE /api/v1/admin/users/:id` — body: `{ confirmation: email }`; cascades + storage cleanup
- `POST /api/v1/admin/users/:id/force-password-reset`

All write audit logs.

---

### Job Moderation

- `GET /api/v1/admin/jobs` — all jobs with filters
- `POST /api/v1/admin/jobs/:id/archive`
- `POST /api/v1/admin/jobs/:id/flag` — admin-flagged for review

---

### Application Oversight

- `GET /api/v1/admin/applications` — system-wide list with filters (score range, status, date)
- `GET /api/v1/admin/applications/:id` — full breakdown including raw AI output

---

### AI Scoring Configuration

**Endpoint:** `GET /api/v1/admin/scoring-config`

Returns active config row.

**Endpoint:** `PATCH /api/v1/admin/scoring-config`

**Request:**
```json
{
  "matchWeights": { "skills": 50, "experience": 30, "education": 10, "culturalFit": 10 },
  "profileWeights": { "completeness": 25, "skillDepth": 30, "experienceClarity": 30, "educationQuality": 15 },
  "bandThresholds": { "strongMin": 70, "partialMin": 40 },
  "biasCategoriesEnabled": ["gendered", "age-coded", "ableist", "exclusionary"],
  "customFlaggedTerms": ["rockstar", "ninja"]
}
```

**Validation:** Sum of weights = 100; thresholds 0-100; strongMin > partialMin.

**Side effects:**
1. UPDATE active config row OR insert new active row + deactivate prior
2. Audit log `scoring_config.updated` with full diff
3. **Optional:** queue batch re-score job

---

### Preview Impact

**Endpoint:** `POST /api/v1/admin/scoring-config/preview-impact`

**Request:** same shape as PATCH

**Behavior:** Re-scores last 100 applications in-memory with proposed weights; returns delta (avg score change, band shifts). No DB writes.

**Response:**
```json
{
  "data": {
    "avgScoreChange": +3.2,
    "bandShifts": { "partialToStrong": 12, "limitedToPartial": 5, "noChange": 83 },
    "sample": [ /* first 10 examples */ ]
  }
}
```

---

### Trigger Batch Re-score

**Endpoint:** `POST /api/v1/admin/scoring/rescore-batch`

**Request:** `{ "scope": "last100" | "all" }`

**Side effects:** Enqueue BullMQ `rescore-batch` job. Returns `{ jobId }` for status polling.

---

### Audit Log

**Endpoint:** `GET /api/v1/admin/audit`

Filters: actor, entity_type, action, date range, pagination.

**Endpoint:** `GET /api/v1/admin/audit/export?format=csv`

Streams CSV for download.

---

### System Analytics

**Endpoint:** `GET /api/v1/admin/analytics?range=30d`

Returns chart data: user growth, job postings, applications by status, score distribution histogram, top skills, etc. Cached 5min.

---

### Bias Monitor

**Endpoint:** `GET /api/v1/admin/bias-monitor?range=30d`

Returns: flag counts, breakdown by category, top flagged terms, override rate, score distribution by job, recent override decisions. Cached 5min.

---

## Health & Misc

- `GET /api/health` — health check probed by Caddy + PM2 on the Digital Ocean Droplet; returns `{ status: "ok", uptime, version }` (Public, not under /api/v1)
- `GET /api/v1/version` — `{ version, commitSha }`

---

## Cross-Cutting Concerns

### Audit Log Service

Backend-internal service called by every controller method that mutates state:

```ts
await this.auditService.log({
  actorId: user.id,
  actorType: 'user',
  action: 'application.created',
  entityType: 'application',
  entityId: application.id,
  details: { jobId: dto.jobId, scoreId: matchScore.id },
});
```

Inserts into `audit_logs` (RLS bypassed via service role). Non-blocking — failures logged but don't fail the parent transaction.

### Rate Limiting

Per-route via `@Throttle({ default: { limit, ttl } })`:

```ts
@Post('auth/login')
@Throttle({ auth: { limit: 5, ttl: 60_000 } })
@Public()
login(...) { ... }
```

Backed by Redis store; works across instances and survives restarts.

### Cache Invalidation

When data mutates, services explicitly invalidate dependent cache keys:

```ts
async createJob(dto: CreateJobDto, user: AuthUser) {
  const job = await this.repository.insert(...);
  await this.cacheManager.del('jobs:public:listing:*');  // pattern delete
  return job;
}
```

---

## Validation Schemas Reference

All in `packages/shared/src/schemas/`:

| File | Schemas |
|---|---|
| `auth.ts` | login, register-candidate, register-recruiter, password-reset |
| `onboarding.ts` | candidate steps, recruiter steps |
| `jobs.ts` | createJob, updateJob, publishJob |
| `applications.ts` | applyToJob, updateStatus, withdraw |
| `resumes.ts` | uploadResume, setDefault |
| `interviews.ts` | scheduleInterview, recordFeedback |
| `offers.ts` | sendOffer, acceptOffer, declineOffer |
| `ai-config.ts` | updateScoringConfig, previewImpact |
| `score.ts` | profile-score, match-score, evidence (output shapes) |
| `bias.ts` | bias-flag (output shapes) |
| `shared.ts` | email, phone, password, uuid, pagination |

---

## Error Handling Matrix

| Error Type | Layer | Status | Surfacing |
|---|---|---|---|
| Validation (Zod) | nestjs-zod pipe | 400 | Inline form error |
| Unauthenticated | SupabaseAuthGuard | 401 | Frontend redirects to /login |
| Forbidden | RolesGuard / OwnershipGuard | 403 | Frontend 403 page or alert |
| Not found | Controller | 404 | not-found.tsx |
| Business rule (e.g., duplicate apply) | Service | 409 | Inline alert / toast |
| Bias flags require override | Service | 422 | Modal with override flow |
| AI service down | Service | 503 | "Score temporarily unavailable; retry" |
| Rate limited | Throttler | 429 | Inline + countdown |
| Unknown | Exception filter | 500 | Generic friendly message; logged |

---

## OpenAPI / Swagger

Auto-generated from controller decorators:

```ts
@Controller('jobs')
@ApiTags('jobs')
@ApiBearerAuth()
export class JobsController {
  @Post()
  @ApiOperation({ summary: 'Create a new job (draft)' })
  @ApiResponse({ status: 201, type: JobResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @Roles('recruiter')
  create(@Body() dto: CreateJobDto, @CurrentUser() user: AuthUser): Promise<JobResponseDto> { ... }
}
```

Swagger UI available at `<api>/api/docs`. OpenAPI spec written to `packages/shared/openapi.json` on build for orval codegen.

---

## Frontend API Client Usage

Auto-generated TanStack Query hooks (via orval):

```tsx
// In a Client Component
import { useApplyToJob } from "@aurahire/shared";

function ApplyButton({ jobId, resumeId }: Props) {
  const applyToJob = useApplyToJob();
  return (
    <Button
      disabled={applyToJob.isPending}
      onClick={() => applyToJob.mutate({ jobId, resumeId })}
    >
      {applyToJob.isPending ? "Submitting..." : "Apply"}
    </Button>
  );
}
```

```tsx
// Server Component data fetching
import { fetchApplications } from "@aurahire/shared";

export default async function Page() {
  const { data } = await fetchApplications({ headers: { Authorization: `Bearer ${token}` } });
  return <ApplicationsList items={data} />;
}
```

---

## Iteration Guide

When adding a feature:
1. Add Zod schema to `packages/shared/src/schemas/`
2. Add Drizzle table in `packages/db/src/schema.ts` if new entity (and RLS policy in `packages/db/src/rls/`)
3. Create NestJS module in `apps/api/src/modules/<feature>/` (controller + service + repository + DTOs)
4. Add audit log calls in service
5. Add Swagger decorators on controller
6. Run OpenAPI codegen → updated client appears in `packages/shared/api-client/`
7. Build frontend page in `apps/web/app/...`
8. Build feature components in `apps/web/components/<feature>/`
9. Wire form to schema + mutation hook
10. Update this doc's spec section
