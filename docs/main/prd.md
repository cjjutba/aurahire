# AuraHire - Product Requirements Document

**Version:** 2.1.0 (Sprint Scope, Split Architecture)
**Last Updated:** May 1, 2026
**Status:** Locked
**Supersedes:** PRD v2.0.0 (May 1) → v1.0.0 (November 16, 2025)

> **Architectural note (v2.1.0 update):** The system is now built as a **Turborepo monorepo with split frontend/backend** - Next.js 16 on Vercel (`apps/web`) + NestJS on a Digital Ocean Droplet (`apps/api`, run under PM2 with Redis + Mailpit as Docker containers on the same host and Caddy reverse-proxying TLS). All AI calls, DB access, queue/cron/cache live in the backend. See `architecture.md` and `tech-stack.md`. Sprint window updated to **May 2-4 active + May 5 polish/smoke buffer**.

---

## Executive Summary

AuraHire is an AI-powered recruitment platform built around two principles: **explainable scoring** (every AI decision shows its work) and **active bias mitigation** (job descriptions and scoring inputs are checked before they affect candidates).

The system covers the recruitment lifecycle: candidate registration with resume parsing, profile scoring, job posting with bias-language detection, candidate-job match scoring, application workflow, recruiter shortlisting, interview and offer tracking, and admin oversight including AI weight configuration and bias monitoring.

This document is the **v2 sprint-scope PRD** - a refined revision of the original 24-week enterprise PRD shaped to fit a thesis-defensible 2-day build. It removes integrations and enterprise features that are not part of the sprint, locks the dual-scoring + bias-mitigation thesis angle, and points to companion docs for design, architecture, schema, and AI specifications.

---

## Thesis Angle

> **"Explainable and Fair AI-Powered Recruitment: A Transparent Resume Scoring Platform with Bias Mitigation."**

This single sentence shapes every product decision:

1. **Every AI decision shows its work.** Scores are accompanied by component breakdowns, evidence excerpts from the resume, and plain-language explanations.
2. **Bias is mitigated upstream and monitored downstream.** Resumes are PII-redacted before scoring; job descriptions are scanned for biased language before publishing; admins see aggregate fairness metrics.
3. **Algorithmic decisions are auditable.** Every score, override, weight change, and moderation action writes to an immutable audit log.

## Product Vision

To create a recruitment platform whose AI is transparent enough to be defended in front of an academic examiner, and fair enough to be trusted by candidates who will never see the model.

### Objectives

1. Demonstrate explainable AI scoring across two distinct engines (Profile + Match)
2. Demonstrate active bias mitigation at job posting time
3. Demonstrate aggregate fairness oversight at admin level
4. Deliver a working end-to-end recruitment flow (register → apply → screen → offer)
5. Ship a thesis-defensible artifact, not a faked prototype

---

## Target Users

| Role               | Primary Activities                                                                        | Sprint Scope       |
| ------------------ | ----------------------------------------------------------------------------------------- | ------------------ |
| Candidate          | Register, upload resume, browse jobs, apply, track status, see scores                     | In                 |
| Recruiter          | Register (with company), post jobs, review applications, schedule interviews, send offers | In                 |
| Admin              | Oversee users, jobs, applications; configure AI weights; monitor bias; audit              | In                 |
| Hiring Manager     | (collapsed into Recruiter for sprint)                                                     | Phase 2            |
| Compliance Officer | (covered by Admin's bias monitor)                                                         | Phase 2 separation |

---

## Sprint Scope (IN)

### 1. Authentication

- Email + password registration (no OAuth, no MFA in sprint)
- Login with rate-limit protection
- Forgot password → reset via email link
- Email verification (required before first login)
- Session management via Supabase Auth (HTTP-only cookies)
- RBAC: candidate, recruiter, admin

### 2. Onboarding

- **Candidate:** 6-step wizard, resume-first (upload → AI parse → review prefilled steps → preferences → Profile Score)
- **Recruiter:** 3-step wizard (about you, company, hiring focus)
- Onboarding incomplete → middleware redirects user back to wizard

### 3. Job Management (Recruiter)

- Create job postings with rich-text description, required skills, experience level, education, salary range, deadline
- **Bias check on description** at edit time and at publish time
- Publish, save draft, archive, edit, duplicate
- View applications per job with sort by best match
- Job analytics (views, applications, conversion, avg score)

### 4. Resume Submission & Parsing (Candidate)

- Drag-and-drop resume upload (PDF, DOCX) with size limit
- AI parses to structured JSON: contact, education, experience, skills, certifications
- Stored in Supabase Storage; parsed JSONB stored in DB
- Multiple resume versions; default resume controls scoring

### 5. AI Profile Scoring Engine

- Computed at end of onboarding and re-computed when resume or preferences change
- Components (initial weights, admin-configurable): Completeness 25, Skill Depth 30, Experience Clarity 30, Education Quality 15
- Breakdown with evidence excerpts shown to candidate
- Improvement suggestions surfaced (2-3 actionable tips)

### 6. AI Match Scoring Engine

- Computed at application time and on demand from candidate job-detail view
- Components (initial weights, admin-configurable): Skills Match 40, Experience Match 35, Education Match 15, Cultural/Language Fit 10
- Breakdown with evidence excerpts shown to both candidate and recruiter
- Match band labels: Strong (70-100), Partial (40-69), Limited (0-39)

### 7. Bias Detection (Job Descriptions)

- Recruiter publishes a job → AI scans description for gendered, age-coded, ableist, exclusionary language
- Each flag includes: term, category, suggestion for replacement
- Recruiter can override flags with reason (logged to audit)
- Aggregate flagged-term count visible in admin bias monitor

### 8. Application Workflow

- Candidate applies → match score computed → application created in "Applied" status
- Recruiter moves application through: Applied → Screening → Interview → Offer → Hired/Rejected
- Recruiter notes per application
- Stage transitions logged to audit

### 9. Interview Management

- Schedule interview from application detail (date, time, format: Phone/Video/In-person, meeting link or location)
- Email candidate via Resend
- Interview list view (calendar deferred to Phase 2)
- Record feedback / rating after interview

### 10. Offer Management

- Generate offer from application detail (title, salary, start date, manager, custom message)
- Render preview, send via email
- Candidate accepts/declines via in-portal action (e-signature deferred Phase 2)
- Status: Pending, Accepted, Declined, Expired

### 11. Admin Portal (8 features)

1. **Command Center** - system KPIs, AI processing health, bias flag count
2. **User Management** - full CRUD, suspend, change role, delete with audit
3. **Job Moderation** - review all jobs, archive, see flag history
4. **Application Oversight** - system-wide application audit, drill into any AI score
5. **AI Scoring Configuration** - tune weights for both scoring engines, preview impact
6. **Audit Log** - immutable log, filterable, exportable
7. **System Analytics** - user growth, applications over time, score distribution, top skills
8. **Bias & Fairness Monitor** - aggregate flag stats, override decisions, score distribution audit

### 12. Notifications & Email

- Transactional email via Resend: verify email, password reset, application received (recruiter), application status change (candidate), interview scheduled (candidate), offer sent (candidate)
- In-app via toasts; no real-time websockets in sprint
- Notification preferences (email opt-out per category)

### 13. Audit Logging

- Append-only `audit_logs` table
- Captures: user actions (create/update/delete), AI events (scores computed, flags raised), config changes, override decisions
- Visible to admin only

---

## Out of Sprint Scope (Future Work / Phase 2)

These features are intentionally deferred. Either replaced with a stub UI or omitted.

| Feature                                     | Replacement in Sprint                 | Reason                                       |
| ------------------------------------------- | ------------------------------------- | -------------------------------------------- |
| OAuth (Google, LinkedIn)                    | Email/password only                   | Out of thesis scope; saves 4-6h              |
| MFA                                         | None                                  | Saves 3-4h; not required for thesis          |
| Calendar integration (Google/Outlook)       | Plain meeting-link text field         | Saves 6-8h per provider                      |
| Video conferencing integration (Zoom/Teams) | Plain meeting-link text field         | Saves 4-6h                                   |
| E-signature (DocuSign/HelloSign)            | In-portal Accept/Decline buttons      | Saves 6-8h, vendor-specific                  |
| SMS notifications                           | Email only                            | Cost + provider integration                  |
| Real-time websockets                        | Polling on key surfaces               | Sprint complexity                            |
| pgvector embeddings                         | Direct LLM evaluation for skill match | Saves ~3h; LLM is sufficient at thesis scope |
| Bulk export to PDF/Excel                    | CSV export only                       | Lower priority for thesis demo               |
| Team management for recruiters              | Stub "Coming soon" panel              | Multi-user collab is its own story           |
| Multi-language i18n                         | English only                          | Standard for thesis MVP                      |
| Mobile native apps                          | Responsive web                        | Web is sufficient for demo                   |
| Weekly/monthly automated reports            | On-demand admin export                | Cron + email = Phase 2                       |
| Advanced disparate-impact statistical tests | Surface aggregate distributions only  | Statistical rigor for thesis appendix        |

---

## Non-Functional Requirements

Realistic targets given Supabase free tier and thesis context.

### Performance

- Page load (cold cache): < 3s, 95th percentile
- Page load (warm): < 1.5s
- API/Server Action response: < 800ms typical, < 5s with AI in-line
- AI resume parsing: < 30s per document
- AI scoring (Profile or Match): < 15s per call
- Bias check on job description: < 10s
- Concurrent users supported: 50+ (free-tier headroom; paid tier scales linearly)

### Security

- HTTPS via Vercel
- Passwords hashed by Supabase Auth (bcrypt)
- Session tokens HTTP-only, secure cookies
- RBAC enforced at three layers: middleware → server-action check → RLS
- Input validation: Zod at every boundary
- Rate limiting on auth endpoints (5 attempts / 60s)
- Secrets only in `.env.local` and Vercel encrypted env vars; never client-bundled
- File uploads: signed Supabase Storage URLs, MIME and size validated server-side

### Privacy

- GDPR-aligned: candidates can download all their data, request deletion (cascading)
- PII redacted before any scoring AI call
- Audit log retains action records (anonymized after user deletion per retention policy)

### Scalability (sprint headroom, not enterprise scale)

- Stateless app servers (Vercel)
- Postgres connection pooling via Supabase pgbouncer
- AI calls async-friendly via Server Actions; no in-memory queues required at sprint scale

### Accessibility

- WCAG 2.1 AA target
- Keyboard navigation for all interactive elements
- Focus rings (`{colors.primary}` 2px) on every focusable element
- Form labels and ARIA attributes for screen readers
- Color contrast verified against AA on all token pairs

### Reliability

- Daily Postgres backups (Supabase managed)
- Graceful degradation: if AI service errors, application still saves with `status = 'Pending Score'`; user sees friendly retry
- Page-level error boundaries with retry CTA

---

## Acceptance Criteria

### Per Feature

A feature is "done" when:

1. Route is reachable, with correct auth/RBAC enforcement
2. Form validation passes Zod on both client and server
3. All async flows have loading and error states
4. All AI moments display the AI Shimmer pattern with caption
5. All scores display with breakdown + evidence (no naked numbers)
6. All bias flags write to audit log
7. All destructive actions require modal confirmation
8. Empty, loading, and error states are designed (no blank widgets)
9. Mobile responsive (single-column at < 640px)
10. Manually QA'd end-to-end at least once

### Demo Acceptance (Thesis Defense)

End-to-end demo path the system must support without faking:

1. Register a new candidate → verify email → log in → onboarding → upload real resume → AI parses → review prefilled steps → set preferences → see Profile Score with breakdown
2. Browse jobs → see match score chip on each → open a job → see Match Score Ring + Breakdown → apply
3. Switch to recruiter account → see new application in pipeline → click into application → see Match Score with full evidence callouts → schedule an interview → send an offer
4. Switch to admin account → Command Center → drill into the application from step 3 → audit the AI score → tune scoring weights → preview impact → save → see new audit log entry
5. As recruiter, draft a new job containing a flagged term ("rockstar") → see bias flag → override with reason → confirm flag now visible in admin Bias Monitor
6. Every step has a visible AI badge or shimmer when AI runs

This demo is the artifact. If any step fails or fakes, the thesis claim fails.

---

## Success Metrics (Thesis-Adjusted)

The original PRD's enterprise KPIs (time-to-hire, retention, NPS) are not measurable in a thesis demo timeframe. Sprint-appropriate metrics:

### System Demonstrations

- All 8 admin features functional and demoable
- Both scoring engines produce structured, explainable output 100% of the time
- Bias detection identifies all expected test-set terms (curated test set in thesis appendix)
- Audit log captures 100% of consequential actions

### Quality

- TypeScript strict mode, zero `any` in shipped code
- Zod schemas at every input boundary
- All AI prompts use OpenAI structured-output JSON schema (no free-text scores)
- All foreign keys have ON DELETE rules

### Thesis-Defensibility

- Every AI surface is explainable with evidence
- Every algorithmic decision has an audit trail
- PII redaction documented and observable in admin score audit view
- Weight configuration changes visible in audit log + reflected in subsequent scores

---

## Risk & Mitigation

### Risk: AI Scoring Reliability

**Impact:** Wrong or inconsistent scores undermine thesis claim.
**Mitigation:**

- OpenAI structured outputs (JSON schema enforcement) - never parse free text
- Prompt versioning in DB; every score records `prompt_version`
- Sample-set validation before sprint end (10 known-good resumes vs known-good jobs)
- Admin can view raw structured score output for any application

### Risk: AI Cost / Rate Limits

**Impact:** Sprint demo fails under load.
**Mitigation:**

- gpt-4o-mini (low cost: ~$0.15/M tokens input)
- Cache parsed resume JSON (parse once, score many times)
- Rate-limit user-triggered scoring (1 recompute per 60s)
- Pre-fund OpenAI account with $20 credits ($20 funds ~50K scoring calls)

### Risk: Resume Parsing Fails on Edge Formats

**Impact:** Candidate hits a wall at onboarding step 1.
**Mitigation:**

- Always allow manual fill-out as fallback
- Show clear "We couldn't parse - fill out manually" message
- Log parse failures for thesis appendix discussion

### Risk: Free-Tier Limits

**Impact:** Demo blocked by Supabase quotas.
**Mitigation:**

- Supabase free tier: 500MB DB, 1GB storage, 50K MAU - sufficient for demo
- Resend free tier: 100 emails/day, 3000/month - sufficient
- Vercel free tier: hobby plan, sufficient
- Upgrade path documented if presenter expects sustained traffic

### Risk: Bias Detection False Positives/Negatives

**Impact:** Flags too many or too few terms.
**Mitigation:**

- Curated seed list of flagged terms in DB (extensible by admin)
- LLM as secondary check, not sole arbiter
- Override mechanism with reason logging - recruiter override, not silent dismissal

---

## Document Map

This PRD is the contract; companion docs are the implementation guide.

| Doc                           | Scope                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `design-system.md`            | Tokens, brand voice, do's/don'ts                                                       |
| `ui-patterns.md`              | Components, variants, signature patterns                                               |
| `page-inventory.md`           | Every route, ASCII layout, edge states                                                 |
| `tech-stack.md`               | Dependencies, versions, rationale                                                      |
| `architecture.md`             | System architecture, data flow, security model                                         |
| `database-schema.md`          | All tables, indexes, RLS policies, Drizzle schema (lives in `packages/db/`)            |
| `ai-design.md`                | Scoring engines, prompts, redaction, fairness, explainability                          |
| `technical-specifications.md` | REST API endpoints + per-feature specs                                                 |
| `project-structure.md`        | Monorepo layout (apps/web, apps/api, packages/shared, packages/db)                     |
| `best-practices.md`           | Engineering standards (NestJS + Next.js + monorepo discipline)                         |
| `sprint-plan.md`              | Day 1 / Day 2 / Day 3 / Day 4 hour-by-hour                                             |
| `env-setup.md`                | Local dev + Supabase + Resend + OpenAI + Mailpit + Redis + Digital Ocean Droplet setup |

### Root-level reference docs

| Doc                     | Scope                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `CLAUDE.md` (repo root) | Claude Code workflow rules + hard "do nots" (no dev servers, no migrations, no deploys) |
| `AGENTS.md` (repo root) | Agent rules including Next.js 16 caveat + NestJS module patterns                        |
| `DESIGN.md` (repo root) | Brand design summary in editorial format                                                |

---

**Document Owner:** CJ Jutba
**Sprint Window:** May 2 - May 4, 2026 (3 active days) + May 5 polish/smoke
**Status:** Sprint scope locked. Implementation begins after env setup.
