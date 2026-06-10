# Data Models — `packages/db`

> Part: **db** (Drizzle + postgres.js) · Brownfield deep-scan by `[DP] Document Project` · 2026-06-10 · Index: [index.md](./index.md)
> The hand-written spec is [docs/main/database-schema.md](./main/database-schema.md); this is the as-built scan.

## Database & ORM

- **Engine:** Postgres (currently Supabase; **migrating to Neon**), accessed from `apps/api` via **Drizzle ORM** over the **postgres.js** driver. RLS is a third defense layer behind the backend guards.
- **Schema source of truth:** `packages/db/src/schema.ts` (all tables), `enums.ts` (canonical enum tuples), `relations.ts` (Drizzle relations), `index.ts` (`AURAHIRE_DB_VERSION = "0.2.0"`).
- **Enum style (important):** enums are **NOT** Postgres `pgEnum` types — they are TypeScript `const` tuples in `enums.ts`, applied via Drizzle `text({ enum: ... })`. Validity is enforced at write time on the TS side; a few columns also carry a Postgres **CHECK** (e.g. `auth_tokens.kind`, `interviews.status`, `match_score_previews.source`). This is why some "enum bump" migrations are no-ops (`0013`, `0014`) while `0016` needed real DDL.
- **Type exports:** every table exports `$inferSelect`/`$inferInsert` (e.g. `Job`/`NewJob`).

## Tables catalog (21 tables)

### Identity / Auth
| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | Master user row; mirrors `auth.users.id` (no FK — Supabase trigger). | `id uuid PK`, `role` (USER_ROLES), `full_name`, `email unique`, `status` (default `active`), `last_active_company_id` (FK added in 0003), `last_login_at`. |
| `candidate_profiles` | 1:1 extension for candidates. | `id PK → profiles.id (cascade)`, `headline`, `summary`, `location_*`, `desired_roles text[]`, `desired_seniority`, `desired_salary_min/max numeric(12,2)`, `available_start_date`, `default_resume_id` (FK added separately), `profile_completed`. |
| `recruiter_profiles` | 1:1 extension for recruiters. | `id PK → profiles.id (cascade)`, `job_title`, `department`, `roles_hiring_for text[]`, `hiring_volume_per_quarter`, `profile_completed`. (Legacy `company_id` dropped in 0003.) |
| `auth_tokens` | Backend-owned single-use email-verify + password-reset tokens. | `id PK`, `user_id`, `email`, `kind` (`email_verification`\|`password_reset`, CHECK), `token_hash unique` (SHA-256 only), `metadata jsonb`, `expires_at`, `consumed_at`. Deny-all RLS (service role only). |

### Companies / Multi-tenancy
| Table | Purpose | Key columns |
|---|---|---|
| `companies` | Tenant record. | `id PK`, `name`, `industry`, `size`, `website`, `logo_url`, `created_by → profiles.id`. |
| `company_members` | M:N user⇄company (replaced 1:1 `recruiter_profiles.company_id`). | `company_id → companies (cascade)`, `user_id → profiles (cascade, NULLABLE for pending invites)`, `email` (snapshot), `role` (owner/admin/recruiter), `status` (invited/active/suspended/left), `invitation_token unique`, `invited_by`. Uniques: (company,user), (company,email). |

### Jobs
| `jobs` | Job postings. | `id PK`, `recruiter_id → profiles`, `company_id → companies (RESTRICT)`, `title`, `employment_type`, `work_mode`, `salary_min/max`, `description` (HTML), `description_plain` (for AI/bias), `required_skills text[]`, `experience_level`, `education_requirement`, `application_deadline`, `status` (default `draft`), `view_count`, `published_at`, `archived_reason` (0010). |

### Resumes
| `resumes` | Resume files + parsed output. | `id PK`, `candidate_id → profiles`, `filename`, `mime_type`, `storage_path`, `canonical_pdf_path` (DOCX→PDF, 0005), `raw_text`, `parsed_data jsonb`, `parse_status` (default `pending`), `is_default`. |

### Applications
| `applications` | Candidate→job application. | `id PK`, `job_id → jobs`, `candidate_id → profiles`, `resume_id → resumes (RESTRICT)`, `cover_letter`, `status` (default `applied`), `score_status` (computing/completed/failed, 0008), `recruiter_notes`, `applied_at`, `shortlisted_at` (0002). **Unique (candidate_id, job_id).** |

### Interviews
| `interviews` | Scheduled interviews + feedback + venue snapshot. | `id PK`, `application_id → applications`, `scheduled_by`, `scheduled_at`, `duration_minutes` (60), `format` (default `in-person`, 0009), `status` (default `scheduled`, Postgres CHECK), `feedback`, `rating` (CHECK 1–5), `recommendation`, `candidate_summary`, `shared_with_candidate_at`, reschedule pointers, venue fields, cron-dedup timestamps. |
| `interview_venues` | Reusable per-company venue templates (0009). | `id PK`, `company_id → companies`, `created_by`, `label`, venue fields, `is_default`. Unique (company,label). |

### Offers
| `offers` | Offer per application (1:1). | `id PK`, `application_id → applications **unique**`, `sent_by`, `title`, `salary`, `start_date`, `status` (default `pending`), `sent_at`, `responded_at`, `expires_at`, `expiry_reminder_sent_at` (0007). |

### Scoring / AI
| Table | Purpose | Key columns |
|---|---|---|
| `profile_scores` | Explainable Profile Score per resume. | `candidate_id`, `resume_id`, `overall_score` (CHECK 0–100), `band`, `components jsonb`, `improvement_suggestions jsonb`, `redacted_fields text[]`, `prompt_version`, `model_used`, `raw_output jsonb`, `latency_ms`, `status`, `stale_at` (0010). |
| `match_scores` | Explainable match score per application (1:1). | `application_id **unique**`, `candidate_id`, `job_id`, `resume_id`, `overall_score` (CHECK 0–100), `band`, `components jsonb`, `redacted_fields text[]`, `weights_used jsonb` (config snapshot), provenance fields. |
| `match_score_previews` | Pre-apply "See my match"; promoted at apply time (0006). | `candidate_id`/`job_id`/`resume_id`, provenance + `weights_used`, `source` (`system`\|`candidate`\|`candidate_view`, CHECK). **Unique (candidate, job, resume)** — previews go stale when resume changes. |
| `evidence_excerpts` | Quoted resume evidence per score component. | `score_type` (profile/match), `score_id uuid` (**polymorphic, not a real FK**), `component_name`, `excerpt_text` (full), `excerpt_redacted` (recruiter-safe, 0015), `relevance`, `contribution_points`. |
| `bias_flags` | AI-detected biased JD terms. | `job_id → jobs`, `term`, `category`, `severity`, `suggestion`, `position_start/_end`, `status` (default `flagged`), `override_reason`, `overridden_by`, `prompt_version`, `model_used`. |
| `scoring_config` | Singleton admin-tunable scoring + fairness config. | `is_active`, `match_weights jsonb`, `profile_weights jsonb`, `band_thresholds jsonb`, `auto_reject_threshold` (default **75**, 0015), `bias_categories_enabled text[]`, `custom_flagged_terms text[]`, `pii_redaction_enabled` (default true), `pii_fields_redacted text[]`, `updated_by`. |

### Notifications
| `notifications` | In-app feed (90-day retention). | `user_id → profiles`, `event_type`, `scope` (personal/system), `title`, `body`, `link`, `entity_type`/`entity_id`, `actor_id`, `read_at`, `dismissed_at` (= archived), `digest_pending`, `email_sent_at`. |
| `notification_preferences` | Per-event Instant/Digest/Off (sparse). | `user_id`, `event_type`, `mode`. **Unique (user_id, event_type)** for upsert. |

### Audit / Feedback
| `audit_logs` | Append-only record of consequential actions. | `actor_id → profiles (set null)`, `actor_type` (user/system/ai), `company_id` (0003), `action`, `entity_type`, `entity_id`, `details jsonb`, `ip_address inet`. No INSERT/UPDATE/DELETE RLS — backend service-role only; **append-only**. |
| `feedback` | In-app feedback → admin triage (0012). | `submitter_id → profiles (set null)`, snapshotted `submitter_email/_name/_role`, `company_id`, `type`, `severity` (**CHECK: non-null iff type='bug'**), `subject`, `message`, `status` (default `new`), `admin_note`, `resolved_at`, `resolved_by`. |

## Enums (TS const tuples in `enums.ts`)
USER_ROLES (candidate/recruiter/admin) · USER_STATUS (active/suspended/deleted) · APPLICATION_STATUS (applied/interview/offer/offer_accepted/offer_declined/hired/rejected/withdrawn — legacy "screening" removed May 2026) · APPLICATION_SCORE_STATUS (computing/completed/failed) · OFFER_STATUS (pending/accepted/declined/expired/withdrawn) · INTERVIEW_FORMAT (phone/video/in-person) · INTERVIEW_STATUS (scheduled/in_progress/completed/cancelled/no-show/rescheduled — `in_progress` added May 2026) · INTERVIEW_RECOMMENDATION (proceed/hold/reject) · JOB_STATUS (draft/published/archived/closed) · EMPLOYMENT_TYPE · WORK_MODE · EXPERIENCE_LEVEL · EDUCATION_REQUIREMENT · COMPANY_SIZE · SCORE_BAND (strong/partial/limited) · SCORE_STATUS · RESUME_PARSE_STATUS · BIAS_CATEGORY (gendered/age-coded/ableist/exclusionary/other) · BIAS_FLAG_STATUS · BIAS_SEVERITY · AUDIT_ACTOR_TYPE · PARSE_CONFIDENCE · EVIDENCE_RELEVANCE · SCORE_TYPE · SCORE_COMPONENT_PROFILE (completeness/skill_depth/experience_clarity/education_quality) · SCORE_COMPONENT_MATCH (skills/experience/education/cultural_fit) · COMPANY_MEMBER_ROLE · COMPANY_MEMBER_STATUS · FEEDBACK_TYPE/SEVERITY/STATUS · NOTIFICATION_EVENT_TYPE (~30) · NOTIFICATION_MODE · NOTIFICATION_SCOPE.

## Relations (`relations.ts`)
`profiles` is the hub (one→one candidate/recruiter subprofile, last_active_company; one→many memberships, resumes, applicationsAsCandidate, jobsAsRecruiter, companiesCreated, auditLogsAsActor). `companies`→created_by + many members + many jobs. `company_members`→company + user (nullable) + invited_by. `jobs`→recruiter + company + many applications + many bias_flags. `applications`→job + candidate + resume + match_score + offer + many interviews. Scoring tables → candidate/job/resume. **Not wired** (intentional): `evidence_excerpts` (polymorphic), `auth_tokens`, `notifications`, `notification_preferences`, `feedback`.

## Row-Level Security (`packages/db/src/rls/all-policies.sql`)
- Applied **manually** (not via dashboard). `0000_initial.sql` did not enable RLS; it was added incrementally (`all-policies.sql` + `0004_rls_multi_tenancy.sql` + per-table enables in 0001/0006/0007/0012).
- **All policies are `auth.uid()`-based (Supabase Auth):** self-ownership (`auth.uid() = id`/`candidate_id`/…), admin bypass (`EXISTS … role='admin'`), relationship traversal (recruiters reach applicants via `applications → jobs WHERE recruiter_id = auth.uid()`; per-tenant via `company_members … status='active'`), public reads (companies, published jobs, active scoring_config), constrained writes via `WITH CHECK`, append-only `audit_logs`, polymorphic gate for `evidence_excerpts`.
- **Backend uses service role → bypasses RLS.** RLS is defense-in-depth behind the guards.
- **⚠️ Auth-migration flag:** every policy depends on Supabase `auth.uid()` and on `profiles.id`/`auth_tokens.user_id` mirroring `auth.users.id` (no real FK — Supabase triggers). Moving auth off Supabase requires rewriting `all-policies.sql` + `0004` (there is no abstraction over `auth.uid()`).

## Migrations (`packages/db/drizzle/`, journal `meta/_journal.json`)
1. `0000_initial.sql` — 15 core tables (no RLS yet).
2. `0001_auth_tokens.sql` — `auth_tokens` + deny-all RLS.
3. `0002_shortlist.sql` — `applications.shortlisted_at` + partial index.
4. `0003_multi_tenancy.sql` — `company_members`, `last_active_company_id`, `audit_logs.company_id`; backfills owners; **drops `recruiter_profiles.company_id`**.
5. `0004_rls_multi_tenancy.sql` — RLS + per-tenant policies on 8 tables.
6. `0005_canonical_pdf_path.sql` — `resumes.canonical_pdf_path`.
7. `0006_match_score_previews.sql` — `match_score_previews` + candidate RLS.
8. `0007_notifications.sql` — `notifications` + `notification_preferences` + cron-dedup columns.
9. `0008_application_score_status.sql` — `applications.score_status` (async scoring).
10. `0009_interview_flow_v2.sql` — interview redesign (status CHECK, recommendation, venue cols, `interview_venues`).
11. `0010_proactive_system.sql` — `source=candidate_view`, `profile_scores.stale_at`, notification partials, `jobs.archived_reason`.
12. `0011_unify_profile_weight_keys.sql` — rewrite legacy `profile_weights` keys to AI-contract keys.
13. `0012_feedback.sql` — `feedback` table + admin RLS.
14. `0013_offer_declined_status.sql` — no-op (TS-enum addition).
15. `0014_offer_accepted_status.sql` — no-op (TS-enum addition).
16. `0015_panel_revision_may_2026.sql` — `evidence_excerpts.excerpt_redacted`, `scoring_config.auto_reject_threshold`; "screening" removal at app layer.
17. `0016_interview_in_progress_status.sql` — `in_progress` status; **drops+re-adds `interviews_status_check`**.

> **Neon migration note:** migrations are checked-in SQL applied manually (historically via Supabase MCP). On Neon, decide the application path — `drizzle-kit migrate`, `psql`, or Neon's SQL editor — and keep `prepare: false` on the postgres.js client for Neon's pooled endpoint. RLS policies must be reworked alongside the auth change.
