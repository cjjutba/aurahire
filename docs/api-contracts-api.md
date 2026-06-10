# API Contracts — `apps/api`

> Part: **api** · Brownfield deep-scan by `[DP] Document Project` · 2026-06-10 · Index: [index.md](./index.md)
> See also: [Architecture — API](./architecture-api.md). Source of truth for request/response shapes is the OpenAPI spec (`packages/shared/openapi.json`) → orval client.

**Global prefix:** all routes under **`/api/v1`** (NestJS global prefix `api` + URI versioning, default `1`). Exception: `GET /api/health` (version-neutral). Paths below are relative to `/api/v1`.

**Auth header contract:** protected routes require `Authorization: Bearer <Supabase-JWT>` (validated via Supabase JWKS in `SupabaseAuthGuard`). `@Public` routes need no token.

**Multi-tenancy / company scoping:** recruiter requests are tenant-scoped by `ActiveCompanyGuard`. Active company resolves from the **`X-Active-Company-Id`** header (UUID) or `profiles.last_active_company_id`. Admins and candidates bypass company scoping. `@RequireCompanyRole(owner|admin|member)` further restricts. `@SkipActiveCompany()` opts a route out (pre-membership flows).

> `*EnvelopeDto`/`*ResponseDto` wrap data as `{ data: ... }`.

### AuthController — base `auth` (all `@Public`, throttle `auth: 5/60s`)
| METHOD path | request | response | purpose |
|---|---|---|---|
| POST `/auth/signup-candidate` | `SignupCandidateDto` | `AuthMessageDto` | Register a candidate (Supabase Auth + profile). |
| POST `/auth/signup-recruiter` | `SignupRecruiterDto` | `AuthMessageDto` | Register a recruiter. |
| POST `/auth/verify-email` | `VerifyEmailDto` | `AuthMessageDto` | Confirm email via token. |
| POST `/auth/resend-verification` | `ResendVerificationDto` | `AuthMessageDto` | Resend verification email. |
| POST `/auth/forgot-password` | `ForgotPasswordDto` | `AuthMessageDto` | Trigger password-reset email. |
| POST `/auth/reset-password` | `ResetPasswordDto` | `AuthMessageDto` | Set new password from reset token. |

### ProfilesController — base `profiles` (`@SkipActiveCompany`, any role)
| METHOD path | request | response | purpose |
|---|---|---|---|
| GET `/profiles/me` | — | `ProfileResponseEnvelopeDto` | Profile + role-specific subprofile. |
| GET `/profiles/me/memberships` | — | `MembershipsListEnvelopeDto` | Caller's company memberships (switcher). |
| PATCH `/profiles/me` | `UpdateMyProfileDto` | `ProfileResponseEnvelopeDto` | Switch `lastActiveCompanyId`. |

### RecruiterProfilesController — base `recruiter-profiles` (`@Roles("recruiter")`)
GET `/recruiter-profiles/me`; PATCH `/recruiter-profiles/about` (`AboutDto`); PATCH `/recruiter-profiles/company` (`CompanyDto`); PATCH `/recruiter-profiles/focus` (`FocusDto`).

### CandidateProfilesController — base `candidate-profiles` (`@Roles("candidate")`)
GET `/candidate-profiles/me`; PATCH `/candidate-profiles/personal` (`PersonalDto`); PATCH `/candidate-profiles/preferences` (`PreferencesDto`); POST `/candidate-profiles/complete`; PATCH `/candidate-profiles/me/complete-onboarding`; POST `/candidate-profiles/me/onboarding/skipped-analyzing` (`OnboardingSkippedDto`).

### CompaniesController — base `companies` (recruiter; create also admin)
| METHOD path | company-role | request | purpose |
|---|---|---|---|
| POST `/companies` | `@SkipActiveCompany` | `CreateCompanyDto` | Create a company (pre-membership). |
| GET `/companies/me` | — | — | Active company. |
| PATCH `/companies/me` | owner/admin | `UpdateCompanyDto` | Update active company. |
| DELETE `/companies/me` | owner | — | Delete active company. |
| GET `/companies/me/members` | — | — | List members. |
| POST `/companies/me/members` | owner/admin | `InviteMemberDto` | Invite a member. |
| PATCH `/companies/me/members/:id` | owner | `UpdateMemberDto` | Change a member's role. |
| POST `/companies/me/members/:id/transfer-ownership` | owner | — | Transfer ownership. |
| POST `/companies/me/members/:id/resend-invitation` | owner/admin | — | Resend a pending invite. |
| DELETE `/companies/me/members/:id` | owner/admin | — | Remove a member. |
| POST `/companies/me/leave` | — | — | Leave the active company. |

### InvitationsController — base `invitations`
GET `/invitations/preview?token` (`@Public`); POST `/invitations/accept` (auth, `@SkipActiveCompany`, `InvitationTokenDto`); POST `/invitations/decline` (auth, `@SkipActiveCompany`).

### JobsController — base `jobs`
| METHOD path | role/@Public | request | purpose |
|---|---|---|---|
| POST `/jobs` | recruiter | `CreateJobDto` | Create draft job. |
| PATCH `/jobs/:id` | recruiter | `UpdateJobDto` | Edit job. |
| POST `/jobs/:id/publish` | recruiter | — | Publish (bias-gated). |
| POST `/jobs/:id/archive` | recruiter | — | Archive job. |
| GET `/jobs/mine` | recruiter | `ListJobsQueryDto` | Jobs for active company. |
| GET `/jobs/for-candidate` | candidate | query | Candidate-facing listing. |
| GET `/jobs/:id/for-recruiter` | recruiter | — | Recruiter detail view. |
| GET `/jobs/:id/for-candidate` | candidate | — | Candidate detail view. |
| GET `/jobs` | @Public | `ListJobsQueryDto` | Public job listing. |
| GET `/jobs/:id` | @Public | — | Public job detail. |

### ResumesController — base `resumes` (`@Roles("candidate")` unless noted)
POST `/resumes/upload` (throttle `resumeUpload:5/hr`, multipart); GET `/resumes/mine`; GET `/resumes/:id` (candidate,admin); POST `/resumes/:id/set-default`; POST `/resumes/:id/reparse`; DELETE `/resumes/:id`; GET `/resumes/:id/download` (candidate,admin).

### ScoringController — base `scoring` (`@Roles("candidate")`)
| METHOD path | throttle | purpose |
|---|---|---|
| POST `/scoring/profile/compute` | `profileCompute:1/60s` + per-user/day cap | Run fresh Profile Score (AI). |
| GET `/scoring/profile/me` | — | Latest Profile Score. |
| POST `/scoring/match-preview/:jobId` | `matchPreview:5/60s` + `DAILY_AI_LIMIT` | Compute/return match preview for a job. |
| GET `/scoring/match-preview/:jobId` | — | Read cached match preview. |
| GET `/scoring/match-previews` | — | List candidate's match previews. |

### ApplicationsController — base `applications`
| METHOD path | role(s) | request | purpose |
|---|---|---|---|
| POST `/applications` | candidate | `ApplyDto` | Apply to a job (enqueues match-score). |
| GET `/applications/mine` | candidate | — | Candidate's applications. |
| GET `/applications/recruiter-stats` | recruiter | `RecruiterStatsQueryDto` | Pipeline stats. |
| GET `/applications/recruiter-analytics` | recruiter | query | Recruiter analytics. |
| GET `/applications/recent` | recruiter | `RecentApplicationsQueryDto` | Recent applications. |
| GET `/applications/shortlist` | recruiter | `ShortlistQueryDto` | Shortlisted applications. |
| GET `/applications/recruiter-list` | recruiter | `RecruiterApplicationsListQueryDto` | All applications for recruiter. |
| GET `/applications/by-job/:jobId` | recruiter | — | Applications for a job. |
| GET `/applications/:id` | candidate,recruiter,admin | — | Application detail. |
| PATCH `/applications/:id/status` | recruiter | `UpdateStatusDto` | Move stage (state machine). |
| PATCH `/applications/:id/notes` | recruiter | `UpdateNotesDto` | Update recruiter notes. |
| POST `/applications/:id/shortlist` | recruiter | — | Shortlist. |
| DELETE `/applications/:id/shortlist` | recruiter | — | Un-shortlist. |
| POST `/applications/:id/withdraw` | candidate,admin | `WithdrawApplicationDto` | Withdraw application. |
| GET `/applications/:id/resume-download` | candidate,recruiter,admin | — | Download resume (redacted for recruiter). |

### BiasController — base `bias`
POST `/bias/check` (recruiter,admin, `CheckBiasDto` → 422 with `flags` if biased); POST `/bias/jobs/:jobId/scan` (recruiter, persists `bias_flags`); GET `/bias/jobs/:jobId/flags` (recruiter,admin); POST `/bias/jobs/:jobId/flags/:flagId/override` (recruiter, `OverrideFlagDto`).

### InterviewsController — (absolute paths)
| METHOD path | role(s) | purpose |
|---|---|---|
| POST `/applications/:applicationId/interviews/check-conflicts` | recruiter | Detect scheduling conflicts. |
| POST `/applications/:applicationId/interviews` | recruiter | Schedule interview. |
| GET `/interviews/mine` | candidate | Candidate's interviews. |
| GET `/me/interviews/:id` | candidate | Candidate interview detail. |
| GET `/interviews/:id/ics` | candidate,recruiter,admin | Download calendar invite. |
| GET `/interviews/by-recruiter/me` | recruiter | Recruiter's interviews. |
| GET `/interviews/:id` | recruiter,admin | Interview detail. |
| GET `/applications/:applicationId/interviews` | candidate,recruiter,admin | Interviews for an application. |
| PATCH `/interviews/:id/feedback` | recruiter | Update feedback. |
| POST `/interviews/:id/share-feedback` | recruiter | Share feedback with candidate. |
| POST `/interviews/:id/reschedule` | recruiter | Reschedule. |
| PATCH `/interviews/:id/no-show` | recruiter | Mark no-show. |
| PATCH `/interviews/:id/status` | recruiter | Change interview status. |

### InterviewVenuesController — (absolute paths, `@Roles("recruiter","admin")`)
GET/POST `/companies/:companyId/interview-venues`; PATCH/DELETE `/interview-venues/:id`; POST `/interview-venues/:id/set-default`.

### OffersController — (absolute paths)
POST `/applications/:applicationId/offers` (recruiter, `CreateOfferDto`); GET `/offers/mine` (candidate); GET `/applications/:applicationId/offers` (candidate,recruiter,admin); POST `/offers/:id/accept` (candidate); POST `/offers/:id/decline` (candidate, `DeclineOfferDto`); POST `/offers/:id/withdraw` (recruiter).

### NotificationsController — base `notifications` (all three roles)
GET `/notifications` (`ListNotificationsDto`); GET `/notifications/unread-count`; POST `/notifications/:id/read`; POST `/notifications/read-all`; PATCH `/notifications/:id/archive`; POST `/notifications/archive-all`; DELETE `/notifications/:id`.

### NotificationPreferencesController — base `notification-preferences` (all three roles)
GET `/notification-preferences`; PUT `/notification-preferences` (`UpsertPreferenceDto`); POST `/notification-preferences/restore-defaults` (`RestoreDefaultsDto`).

### FeedbackController — base `feedback`
POST `/feedback` (candidate,recruiter,admin, `CreateFeedbackDto`).

### Admin module (`@Roles("admin")`)
- **AdminFeedbackController** `admin/feedback`: GET list (`ListFeedbackQueryDto`), GET `/status-counts`, GET `/:id`, PATCH `/:id` (`UpdateFeedbackDto`).
- **AdminAnalyticsController** `admin/analytics`: GET (`AnalyticsQueryDto`).
- **AdminApplicationsController** `admin/applications`: GET list (`ListApplicationsQueryDto`), GET `/:id`.
- **AdminAuditController** `admin/audit`: GET list (`ListAuditQueryDto`), GET `/export.csv` (before `:id`), GET `/:id`.
- **AdminBiasMonitorController** `admin/bias-monitor`: GET (`BiasMonitorQueryDto`).
- **AdminCompaniesController** `admin/companies`: GET list, GET `/options`, DELETE `/:id`.
- **AdminConfigController** `admin/scoring-config`: GET, PATCH (`UpdateScoringConfigDto`), POST `/preview-impact` (`PreviewImpactDto`).
- **AdminJobsController** `admin/jobs`: GET list, GET `/:id`, POST `/:id/archive`.
- **AdminQueueController** `admin/queue`: POST `/rescore-batch` (`EnqueueRescoreDto`), GET `/jobs/:queueJobId/status`.
- **AdminStatsController** `admin/stats`: GET `/overview`.
- **AdminUsersController** `admin/users`: GET list (`ListUsersQueryDto`), GET `/:id`, POST `/:id/suspend` (`SuspendUserDto`), POST `/:id/reactivate`, PATCH `/:id/role` (`ChangeRoleDto`), DELETE `/:id`, POST `/:id/force-password-reset`.
- **CronAdminController** `admin/cron` (**dev-only**, 403 in prod): POST `/run/:cronName`.

### HealthController
GET `/api/health` (`@Public`, version-neutral) → `{ status, uptime, version, timestamp }`.
