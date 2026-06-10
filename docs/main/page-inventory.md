# AuraHire Page Inventory

**Version:** 1.0.0
**Last Updated:** May 1, 2026
**Status:** Locked for Sprint
**Depends on:** `design-system.md`, `ui-patterns.md`

This document is the master list of every page in the AuraHire system, grouped by surface. Each entry includes route, purpose, layout sketch, components used, primary actions, and edge states. Component names in brackets reference `ui-patterns.md`.

**Total pages: ~45 across six surfaces:**

| Surface            | Pages                     | Auth           | Notes                          |
| ------------------ | ------------------------- | -------------- | ------------------------------ |
| Marketing (public) | 5                         | none           | Coinbase-style editorial       |
| Auth               | 7                         | none           | Email/password only, no OAuth  |
| Onboarding         | 2 wizards (8 steps total) | required       | Resume-first for candidates    |
| Candidate Portal   | 10                        | candidate role | Apply, track, score visibility |
| Recruiter Portal   | 13                        | recruiter role | Post, screen, decide           |
| Admin Portal       | 8                         | admin role     | System-wide oversight          |

---

## Marketing Surfaces (Public)

Coinbase editorial pacing - full-bleed dark hero, 96px sections, single accent.

### `/` - Landing

**Purpose:** Primary entry point. Tell the AuraHire story; convert to sign-up.

**Layout:**

```
┌──────────────────────────────────────────────────────────────────┐
│ [nav-marketing-on-dark]  AuraHire   Product · Solutions · ...   │
├──────────────────────────────────────────────────────────────────┤
│ [hero-band-dark]                                                 │
│                                                                  │
│   AI-POWERED RECRUITMENT                                         │
│                                                                  │
│   Hire fairly.                              ┌────────────────┐  │
│   Hire transparently.                       │[score-ring-md] │  │
│   Hire faster.                              │ [breakdown bar]│  │
│                                             │ Strong Match   │  │
│   AuraHire pairs explainable AI scoring     │   78 / 100     │  │
│   with built-in bias mitigation. See        └────────────────┘  │
│   exactly why every candidate ranks where     ┌──────────────┐  │
│   they do.                                    │ Skills 28/40 │  │
│                                               │ Exp 25/35    │  │
│   [button-primary-large] Get Started          │ Edu 12/15    │  │
│   [button-outline-on-dark] See How It Works   └──────────────┘  │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [hero-band-light]   "Three pillars" feature grid (3-up)         │
│                                                                  │
│   [card-feature]      [card-feature]      [card-feature]        │
│   Explainable AI      Bias Mitigation     End-to-End Workflow   │
│   Every score has     Job descriptions    From posting to       │
│   a breakdown with    auto-flagged for    offer in one          │
│   evidence excerpts.  biased language.    transparent system.   │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [hero-band-light, alternating soft-gray surface]                │
│                                                                  │
│   How it works (3-step illustrated flow)                         │
│   1. Candidate uploads resume → AI parses + scores              │
│   2. Recruiter posts job → AI flags biased language             │
│   3. AI computes match scores with full breakdowns              │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [hero-band-dark]   "For Recruiters" + "For Candidates" split    │
│   2-up cards: each shows a tailored value prop with CTA          │
├──────────────────────────────────────────────────────────────────┤
│ [cta-band-dark]                                                  │
│   "Hiring should be transparent. Start now."                     │
│   [button-primary-large] Get Started                             │
├──────────────────────────────────────────────────────────────────┤
│ [footer-marketing]                                               │
└──────────────────────────────────────────────────────────────────┘
```

**Key components:** `nav-marketing-on-dark`, `hero-band-dark`, `card-product-ui-dark` (Score Ring + Breakdown Bar mockup), `card-feature`, `cta-band-dark`, `footer-marketing`.

**Primary actions:** Get Started → `/register`. Browse Jobs → `/jobs`.

**Edge states:** none (purely static).

---

### `/about` - Our Approach

**Purpose:** Thesis-friendly explanation of explainability + fairness philosophy. Lives in marketing for trust-building.

**Layout:**

- `hero-band-light` with badge "OUR APPROACH" + display headline "AI that shows its work"
- Long-form editorial body (12-col, content centered max 720px) explaining: explainability, PII redaction, weight transparency, audit trails
- Embedded `score-ring-lg` mockup as inline figure
- Closing `cta-band-dark`

**Components:** `hero-band-light`, inline body content, `cta-band-dark`, `footer-marketing`.

---

### `/jobs` - Browse Jobs (public)

**Purpose:** Public job listings searchable without login.

**Layout:**

```
┌──────────────────────────────────────────────────────────────────┐
│ [nav-marketing-top]                                              │
├──────────────────────────────────────────────────────────────────┤
│   Find your next role                          [search-pill]     │
│                                                                  │
│   Filters [segmented-control: All · Remote · On-site · Hybrid]  │
│   [select: Industry] [select: Experience] [select: Location]    │
│                                                                  │
│   Showing 142 jobs                              [select: Sort]   │
│                                                                  │
│   [card-list-row]                                                │
│   Senior Engineer · Acme Corp · Remote · Full-time              │
│   $120k-$160k · Posted 2 days ago                                │
│                                                              ›   │
│   [card-list-row] ...                                            │
│   [card-list-row] ...                                            │
│                                                                  │
│   [table-pagination]                                             │
├──────────────────────────────────────────────────────────────────┤
│ [footer-marketing]                                               │
└──────────────────────────────────────────────────────────────────┘
```

**Components:** `nav-marketing-top`, `search-pill`, `segmented-control`, `select`, `card-list-row`, `table-pagination`, `footer-marketing`.

**Primary action:** Click row → `/jobs/[id]`.

**Edge states:**

- Empty (no results): `empty-state` "No jobs match your filters" + reset filters CTA.
- Loading: 8 skeleton rows.

---

### `/jobs/[id]` - Job Detail (public)

**Purpose:** Show full job description; CTA to apply (requires login).

**Layout:**

- Sticky header with job title `{typography.display-md}`, company, location, employment type chips, "Apply Now" `button-primary` right
- Two-column body:
  - Left 8-col: rich-text job description, requirements, benefits
  - Right 4-col: sticky card with company info + posted date + applicant count + secondary "Save Job" button
- Below: "Similar Jobs" 3-up `card-list-row` grid
- `footer-marketing`

**Components:** `nav-marketing-top`, sticky header, body content, `card-list-row` (similar jobs).

**Primary action:** "Apply Now" → if not logged in → `/login?redirect=/candidate/jobs/[id]/apply`; if candidate → direct to apply page.

**Edge states:**

- Job closed: banner above body "This job is no longer accepting applications" in `chip-status-rejected` palette; Apply button disabled.

---

### `/contact` - Contact / Demo

**Purpose:** Lead form for institutional inquiries.

**Layout:**

- `hero-band-light` with form
- Form: name, email, company, role, message + `button-primary` submit
- Confirmation state: success card + "Back to home" link

**Components:** `hero-band-light`, form controls, `alert-inline` on submit.

---

## Authentication Surfaces

Centered single-card layout, no portal chrome, no marketing nav. Logo wordmark top, footer copyright bottom.

### `/login` - Sign In

**Purpose:** Email + password authentication. Routes to onboarding (if first-time) or to role's portal dashboard.

**Layout:**

```
┌──────────────────────────────────────────┐
│              [AuraHire wordmark]          │
│                                           │
│         ┌──────────────────────────┐      │
│         │  Welcome back            │      │
│         │                          │      │
│         │  Email                   │      │
│         │  [text-input]            │      │
│         │                          │      │
│         │  Password                │      │
│         │  [text-input · type=pwd] │      │
│         │            Forgot? ›     │      │
│         │                          │      │
│         │  [button-primary-large]  │      │
│         │      Sign In             │      │
│         │                          │      │
│         │  ── or ──                │      │
│         │                          │      │
│         │  Don't have an account?  │      │
│         │       [Sign up] ›        │      │
│         └──────────────────────────┘      │
│                                           │
│         © 2026 AuraHire                   │
└──────────────────────────────────────────┘
```

**Components:** centered card (`{rounded.xl}`, `{spacing.xl}` padding), `text-input`, `button-primary-large`, `button-tertiary` ("Forgot?" / "Sign up").

**Validation:**

- Empty fields → inline error
- Wrong credentials → `alert-inline` above form ("Email or password incorrect")
- Account not verified → `alert-inline` ("Verify your email first") + "Resend verification" link
- Rate-limit hit → `alert-inline` ("Too many attempts. Try again in 60 seconds.")

**Primary action:** Sign In → onboarding or portal dashboard based on `profile_completed` flag and role.

---

### `/register` - Register Entry (Role Selector)

**Purpose:** Pick a role first; then route to role-specific registration.

**Layout:**

- Centered card
- Headline: "Create your account"
- Two large `card-feature` tiles side-by-side:
  - "I'm a Candidate" - looking for jobs
  - "I'm a Recruiter" - hiring talent
- Each card has Lucide icon, body, button-primary inside
- Bottom: "Already have an account? Sign in"

**Primary action:** Click candidate → `/register/candidate`. Click recruiter → `/register/recruiter`.

---

### `/register/candidate` - Candidate Sign Up

**Purpose:** Create candidate account. Minimal fields per spec.

**Form fields:**

- Full Name `text-input`
- Email `text-input` (with async validation: not taken)
- Phone Number `text-input`
- Password `text-input type=password` (min 10 chars, with strength meter below)
- Confirm Password `text-input type=password` (must match)
- Checkbox: "I agree to the Terms and Privacy Policy"

**Layout:** centered card, fields stacked vertically.

**Primary action:** "Create Account" `button-primary-large` → sends verification email → `/verify-email/sent`.

**Edge:**

- Email already taken: inline error on email field with "Sign in instead?" link.
- Passwords don't match: inline error on confirm field.
- Server error: `alert-inline` above form.

---

### `/register/recruiter` - Recruiter Sign Up

**Purpose:** Create recruiter account.

**Form fields:**

- Full Name
- Company Name
- Email
- Phone Number
- Password
- Confirm Password
- Terms checkbox

Same validation, same routing as candidate signup.

---

### `/forgot-password` - Forgot Password

**Purpose:** Request password reset email.

**Layout:** centered card with single email field + `button-primary-large` "Send reset link".

**Confirmation state:** "Check your email" message + "Resend" link (rate-limited 60s).

---

### `/reset-password?token=xxx` - Reset Password

**Purpose:** Set new password via emailed link.

**Form:** New Password + Confirm Password + button "Set new password".

**Edge:** Invalid/expired token → error card with "Request new link" CTA.

---

### `/verify-email?token=xxx` - Verify Email (auto)

**Purpose:** Verify email from link. Auto-redirects on success.

**States:**

- Verifying (loading skeleton)
- Verified → redirect to `/onboarding/[role]` after 1s
- Invalid/expired → error card with "Resend verification" CTA

---

### `/verify-email/sent` - Verification Sent

**Purpose:** Confirmation that registration email was sent.

**Layout:** centered card, mail icon, "We sent a verification link to {email}", "Resend" button (rate-limited), "Wrong email? Sign up again".

---

## Onboarding Surfaces

Multi-step wizard pattern. `wizard-shell` + `wizard-progress`. No portal chrome until onboarding complete.

### `/onboarding/candidate` - Candidate Onboarding

**Wizard steps:**

#### Step 1: Upload Resume

```
┌──────────────────────────────────────────────────────────────────┐
│ [wizard-progress: 1●─2○─3○─4○─5○─6○]                            │
│                                                                  │
│   Let's start with your resume                                   │
│   We'll extract your information so you don't have to type it.   │
│                                                                  │
│   ┌────────────────────────────────────────┐                    │
│   │ [file-upload-dropzone]                 │                    │
│   │   ☁ Drag & drop your resume            │                    │
│   │     or click to browse                 │                    │
│   │     PDF, DOCX up to 10MB               │                    │
│   └────────────────────────────────────────┘                    │
│                                                                  │
│   On upload:                                                     │
│   [ai-shimmer card with caption "AI is parsing your resume..."] │
│                                                                  │
│   On parse complete:                                             │
│   ✓ We extracted 7 fields from your resume                       │
│   You can review and edit them in the next steps.                │
│                                                                  │
│ [back: hidden]                              [next: button-primary]│
└──────────────────────────────────────────────────────────────────┘
```

**Edge:**

- Parse fails: friendly card "We couldn't read your resume. You can fill out your profile manually." + still allow proceed.
- File too large: inline error.
- Wrong file type: inline error.

#### Step 2: Personal Information

Fields prefilled from resume + signup. Each AI-prefilled field has `badge-ai-suggested`.

- Full Name (from signup, editable)
- Email (from signup, read-only)
- Phone (from signup, editable)
- Location: city, state/region, country (from resume if present, with `badge-ai-suggested`)
- Headline / Current Title (from resume)
- Professional Summary (from resume, textarea)

#### Step 3: Education

Repeating block (each block = one entry). Prefilled from resume. Each block has:

- Institution
- Degree / Field of Study
- Start Year - End Year (or "Present")
- GPA (optional)
- "+ Add another education" link

#### Step 4: Experience

Repeating block. Prefilled.

- Company
- Title
- Start - End
- Responsibilities (textarea, prefilled with bullet points)
- Skills used (`multi-select`, prefilled)

#### Step 5: Skills

`multi-select` chip input prefilled with skills extracted by AI. User adds/removes. Below: "Suggested skills" chips clickable to add (from resume but uncategorized).

#### Step 6: Job Preferences

- Desired Role(s) `multi-select`
- Desired Seniority `select` (Junior / Mid / Senior / Lead / Manager / Director / VP+)
- Open To: `checkbox` group (Full-time, Part-time, Contract, Remote, Hybrid, On-site)
- Desired Salary Range (min - max with currency)
- Available Start Date `date-picker`

**Final action: "Generate my Profile Score"**

- Triggers AI scoring with `ai-shimmer` "Computing your Profile Score..."
- Routes to `/onboarding/candidate/result`

#### Step 7 (result): Profile Score Reveal

- Centered `score-ring-lg`
- `chip-match-band` ("Strong Profile") below
- `score-breakdown-bar` showing components
- "Improvement suggestions" card with 2-3 actionable tips (e.g., "Adding cloud certifications could increase your score by ~6 points")
- `button-primary-large` "Go to my dashboard" → `/candidate`

---

### `/onboarding/recruiter` - Recruiter Onboarding

**Wizard steps:**

#### Step 1: About You

- Full Name (from signup, editable)
- Email (from signup, read-only)
- Phone (from signup, editable)
- Job Title (e.g., "Talent Acquisition Manager")
- Department `select` (HR, Engineering, Operations, etc.)

#### Step 2: About Your Company

- Company Name (from signup, editable)
- Industry `select` (large list)
- Company Size `select` (1-10, 11-50, 51-200, 201-500, 501-1000, 1000+)
- Company Website
- Headquarters Location
- Company Description (textarea)
- Logo upload (optional, `file-upload-dropzone` for image)

#### Step 3: Hiring Focus

- Roles you typically hire for `multi-select`
- Hiring volume per quarter `select`
- "+ Invite teammates later" link (deferred - Phase 2)

**Final: "Go to dashboard" → `/recruiter`.**

---

## Candidate Portal

Auth-required. Sidebar + topbar shell. Shared layout across all 10 pages.

### `/candidate` - Dashboard

**Purpose:** At-a-glance view of applications, score, recommendations.

**Layout:**

```
┌────────┬──────────────────────────────────────────────────────────┐
│ SIDE   │ [topbar: breadcrumb · search · 🔔 · avatar]              │
│ NAV    ├──────────────────────────────────────────────────────────┤
│        │  Welcome back, Maria                                      │
│ ▸Dash  │                                                           │
│  Jobs  │  ┌───────────────┬───────────────┬───────────────┐       │
│  Apps  │  │ card-stat     │ card-stat     │ card-stat     │       │
│  Inter │  │ Profile Score │ Active Apps   │ Interviews    │       │
│  Profile│ │   78 / 100    │     3         │     1         │       │
│  Resume│  │ Strong Match  │               │ This week     │       │
│  Set   │  └───────────────┴───────────────┴───────────────┘       │
│        │                                                           │
│ [user] │  [card-widget: Recent Applications (3 most recent)]       │
│        │     [pipeline-card-compact rows]                          │
│        │     "View all applications" →                             │
│        │                                                           │
│        │  [card-widget: Recommended Jobs]                          │
│        │     [card-list-row × 3 with match score chips]            │
│        │                                                           │
│        │  [card-widget: Upcoming Interviews]                       │
│        │     If empty: empty-state "No upcoming interviews"        │
│        │                                                           │
│        │ [footer-portal]                                           │
└────────┴──────────────────────────────────────────────────────────┘
```

**Components:** `nav-portal-sidebar`, `nav-portal-topbar`, `card-stat`, `card-widget`, `pipeline-card-compact`, `card-list-row`, `chip-match-band`, `empty-state`, `footer-portal`.

**Edge:** New user (no apps yet): `empty-state` instead of widgets - "Browse jobs that match your profile."

---

### `/candidate/jobs` - Browse Jobs

**Purpose:** Logged-in job search. Same layout as public `/jobs` but each row shows the candidate's match score chip.

**Difference from public:**

- Each `card-list-row` includes `chip-match-band` showing this candidate's pre-computed match for that job (computed lazily on first view + cached)
- Sort options include "Best Match"
- "Save Job" button replaces "Apply" (apply moves to detail)

---

### `/candidate/jobs/[id]` - Job Detail (logged-in candidate)

**Purpose:** Full job description + match score preview + apply CTA.

**Layout:** like public job detail but right sidebar carries:

- `score-ring-md` showing this candidate's match against this job
- "View full breakdown" expand link → opens `sheet-side` with full Score Breakdown Bar + Evidence Callouts
- `button-primary-large` "Apply with this resume"

---

### `/candidate/jobs/[id]/apply` - Apply to Job

**Purpose:** Confirm resume + optional cover letter + submit.

**Layout:**

- Job summary card at top (read-only)
- "Use my current resume" toggle - defaults on
  - If on: shows current resume filename + "Replace for this application" link
  - If off: `file-upload-dropzone` for one-off resume
- Cover Letter (optional textarea)
- Live preview: current candidate's match score against this job (computed fresh) `score-ring-md` with breakdown
- `button-primary-large` "Submit Application"

**On submit:** trigger `ai-shimmer` "Finalizing your application..." → success page → redirect `/candidate/applications/[newId]`.

---

### `/candidate/applications` - My Applications

**Purpose:** All applications with status, filterable.

**Layout:**

- `segmented-control` filter: All · Applied · Screening · Interview · Offer · Closed
- `pipeline-card-compact` list (one row per application)
  - Each row: company logo + role + applied date + `chip-status` + `chip-match-band` + chevron-right
  - Click row → application detail

**Edge:** empty → `empty-state` "No applications yet" + browse CTA.

---

### `/candidate/applications/[id]` - Application Detail

**Purpose:** Full timeline of this application, including the score breakdown and any interviews scheduled.

**Layout:**

```
┌────────┬──────────────────────────────────────────────────────────┐
│ SIDE   │  Senior Engineer · Acme Corp                              │
│        │  Applied May 2 · [chip-status-screening]                  │
│        ├──────────────────────────────────────────────────────────┤
│        │  [tabs-line: Overview · Score Breakdown · Timeline]      │
│        │                                                           │
│        │  [Overview tab]                                           │
│        │  ┌──────────────┬──────────────────────────────────┐     │
│        │  │[score-ring-lg]│ Match Components                 │     │
│        │  │    78/100     │ [score-breakdown-bar]            │     │
│        │  │ Strong Match  │   Skills    28/40                │     │
│        │  └──────────────┘   Experience 25/35                │     │
│        │                     Education  12/15                │     │
│        │                     Cultural   13/10                │     │
│        │                     "Click any segment for evidence"│     │
│        │                                                     │     │
│        │  [Score Breakdown tab]                                    │
│        │  Per-component cards with `evidence-callout` blocks       │
│        │  showing resume excerpts that drove each sub-score        │
│        │                                                           │
│        │  [Timeline tab]                                           │
│        │  Vertical timeline: Applied → Screened → Interview        │
│        │  scheduled (date) → Offer pending                         │
│        └──────────────────────────────────────────────────────────┘
```

**Components:** `tabs-line`, `score-ring-lg`, `score-breakdown-bar`, `evidence-callout`, vertical timeline (custom - list with leading dot + connector).

**Primary actions:** Withdraw application (destructive, modal-confirmed).

---

### `/candidate/interviews` - Interviews

**Purpose:** All scheduled interviews.

**Layout:**

- Two sections: Upcoming, Past
- Each item: card with date/time, role, recruiter name, meeting link/format chip, "Add to calendar" button (download .ics)
- Empty: `empty-state`.

---

### `/candidate/profile` - Profile / AI Score

**Purpose:** Edit candidate profile + view current Profile Score.

**Layout:**

- Hero section at top: large `score-ring-lg` of current Profile Score + `chip-match-band` + "Last computed: May 1" + "Recompute" button (rate-limited)
- Tabs: Personal · Education · Experience · Skills · Preferences
- Each tab editable; saving triggers async re-score with `ai-shimmer` if material change

---

### `/candidate/resume` - Resume Manager

**Purpose:** Upload new resume versions, set default.

**Layout:**

- Default resume card with filename, upload date, "View" / "Download" / "Replace" actions
- "Upload new version" `file-upload-dropzone`
- Versions list: previous resumes (read-only)

**Behavior:** Replacing default resume triggers re-parse + re-score with `ai-shimmer`.

---

### `/candidate/settings` - Settings

**Purpose:** Account, notifications, privacy.

**Sections:**

- Account: name, phone, password change
- Notifications: toggles for email categories (application updates, new job matches, interview reminders)
- Privacy: "Download my data" button, "Delete my account" destructive button (modal confirm)

---

## Recruiter Portal

Auth-required, recruiter role.

### `/recruiter` - Dashboard

**Purpose:** Pipeline overview + recent activity.

**Layout:**

- 4 `card-stat`: Active Jobs, Total Applications (this month), Pending Reviews, Avg Match Score
- `card-widget: Pipeline Funnel` - horizontal stacked bar showing counts at each stage (Applied → Screening → Interview → Offer → Hired)
- `card-widget: Top Candidates This Week` - `card-list-row` × 5 with score chips, click-through to candidate
- `card-widget: Recent Activity` - vertical timeline of recent application events
- `card-widget: Bias Flags This Week` - count + link to job moderation if any flags pending recruiter review

---

### `/recruiter/jobs/new` - Post Job

**Purpose:** Create job posting with built-in bias check.

**Layout:**

- Wizard-like single-page form (no multi-step):
  - Job Title
  - Department / Team `select`
  - Employment Type `segmented-control` (Full-time / Part-time / Contract)
  - Location + remote/hybrid/on-site `segmented-control`
  - Salary Range (optional)
  - Description (rich text editor - Tiptap or shadcn-extended)
  - Required Skills `multi-select`
  - Experience Level `select`
  - Education Requirement `select`
  - Application Deadline `date-picker`
- Below editor, persistent **Bias Check Panel**:
  - On every blur of description field, AI scans for biased language
  - Flagged terms shown as inline `chip-bias-flag` over the text
  - Below: "Bias Flags Detected: 2" with click-through list and override option
- Bottom CTAs: "Save Draft" (`button-secondary`) + "Publish" (`button-primary` - disabled if any unresolved bias flags unless explicitly overridden with reason)

**On Publish:**

- Confirmation modal: "This will be visible to candidates immediately. Continue?"
- Audit log entry

---

### `/recruiter/jobs` - Manage Jobs

**Purpose:** All jobs created by this recruiter.

**Layout:**

- Filter: `segmented-control` (All · Active · Draft · Closed)
- `table-data` columns: Title · Status (`chip-status`) · Applications · Avg Match · Posted · Actions (View / Edit / Archive)
- Empty: `empty-state` "Post your first job".

---

### `/recruiter/jobs/[id]` - Job Detail (recruiter view)

**Purpose:** Job posting + applications list + analytics.

**Layout:**

- Sticky header: title + `chip-status` + actions (Edit / Archive / Duplicate)
- Tabs: Applications · Description · Analytics

**Applications tab:**

- Filters: `segmented-control` (All · New · Screening · Interview · Offer · Rejected)
- Sort: Best Match (default), Most Recent, Most Reviewed
- `table-data` rows: Avatar + Name · Match Score (`score-ring-sm` inline) · Match Band · Applied date · Status chip · Action menu

**Description tab:** read-only render of job description.

**Analytics tab:** views over time, applications over time, conversion rate, avg match score, top skills among applicants.

---

### `/recruiter/jobs/[id]/edit` - Edit Job

Same layout as Post Job, prefilled. Re-runs bias check on save.

---

### `/recruiter/jobs/[id]/applications` - Applications for Job

(Same as Applications tab on job detail - provides direct deep link.)

---

### `/recruiter/applications/[id]` - Application Detail (recruiter)

**Purpose:** Full candidate review with score, evidence, actions.

**Layout:**

```
Sticky header: Candidate Name · Job Title · [chip-status] · Actions
                                              [Schedule Interview]
                                              [Move to Shortlist]
                                              [Reject]

Tabs: Overview · Score Breakdown · Resume · Notes · Timeline

[Overview]
┌────────────────────────┬──────────────────────────────────┐
│ Candidate Info         │  Match Score                     │
│ - Name, contact        │  [score-ring-lg]  78/100         │
│ - Location             │  [chip-match-band] Strong Match  │
│ - Current Title        │                                  │
│ - Years experience     │  [score-breakdown-bar]           │
│ - Education            │  Skills · Exp · Edu · Cultural   │
│                        │  "View full breakdown →"         │
└────────────────────────┴──────────────────────────────────┘

[Score Breakdown tab]
For each component:
  Component title + score (e.g., "Skills: 28 / 40")
  Plain-language explanation
  [evidence-callout] cards quoting resume excerpts
  Inline link to PII-redaction notice ("Scoring runs on a redacted copy of the resume")

[Resume tab]
PDF preview (embedded) of the candidate's submitted resume + download link

[Notes tab]
Recruiter notes, threaded comments (recruiter only at MVP)

[Timeline tab]
Application events: Applied → Reviewed → Interview Scheduled → ...
Each event shows actor (recruiter name) and timestamp; AI events show "AI" actor
```

**Primary actions:** Schedule Interview, Move to Shortlist, Reject (destructive, modal-confirmed).

---

### `/recruiter/candidates/[id]` - Candidate Profile

**Purpose:** Full candidate view (across all their applications to this recruiter's jobs).

**Layout:**

- Hero with avatar + name + headline + Profile Score `score-ring-md`
- Tabs: Overview · Resume · Applications to my jobs · Notes
- Applications tab lists all applications this candidate made to this recruiter's jobs with per-job match score

---

### `/recruiter/shortlist` - Shortlisted Candidates

**Purpose:** Curated pool across jobs.

**Layout:**

- `table-data` with checkbox column for bulk actions
- Columns: Avatar + Name · Job Applied To · Match Score · Status · Action menu
- Bulk: "Schedule Interviews" (opens batch modal), "Move to Rejected", "Export to CSV"

---

### `/recruiter/interviews` - Interview Management

**Purpose:** All interviews recruiter is running.

**Layout:**

- Calendar view (week default) + list view toggle (`segmented-control`)
- Each interview card: date/time, candidate, job, format, meeting link field, "Record Feedback" button (opens modal)
- Filter: `segmented-control` (Upcoming · Completed · Cancelled)

**Schedule Interview modal:**

- Application reference (read-only)
- Date + time picker
- Format `segmented-control` (Phone · Video · In-person)
- Meeting link / location text input
- Send candidate notification toggle (default on)

---

### `/recruiter/offers/new?application=xxx` - Send Offer

**Purpose:** Generate and send offer letter.

**Layout:**

- Application reference card at top
- Form:
  - Offer Title
  - Salary
  - Start Date
  - Reporting Manager
  - Benefits summary
  - Custom message
- Live preview of offer letter (right side, sticky, rendered with template)
- `button-primary-large` "Send Offer" → email candidate + record offer

**Note:** E-signature deferred Phase 2; for MVP, candidate clicks Accept/Decline buttons in their portal.

---

### `/recruiter/analytics` - Analytics

**Purpose:** Aggregate metrics across recruiter's jobs.

**Layout:**

- Date range picker
- KPI cards: Time to Hire, Cost per Hire (manual input), Acceptance Rate, Avg Match Score
- Charts (Recharts):
  - Applications over time (line)
  - Funnel chart (Applied → ... → Hired)
  - Top skills among applicants (horizontal bar)
  - Match score distribution (histogram)
- Export: CSV

---

### `/recruiter/settings` - Settings

Account profile, company profile (editable), notification preferences, team management (Phase 2 stub).

---

## Admin Portal

Auth-required, admin role. Eight focused screens, each going deep.

### `/admin` - Command Center

**Purpose:** System-wide health and KPIs at a glance.

**Layout:**

- Top row of `card-stat`: Total Users, Active Jobs, Applications (today / this week), Avg Profile Score, Avg Match Score
- `card-widget: System Health` - uptime, AI service status (OpenAI), DB latency, recent error count (clickable to logs)
- `card-widget: Score Distribution` - histogram of all match scores in last 30 days, segmented by score band
- `card-widget: AI Processing` - avg parse time, avg score time, success rate, queue depth (stub for now since we run sync)
- `card-widget: Bias Flags This Week` - count + breakdown of flag types (gendered / age-coded / ableist) + click-through to bias monitor
- `card-widget: Recent Audit Events` - latest 10 audit log entries

---

### `/admin/users` - User Management

**Purpose:** Full CRUD on users.

**Layout:**

- Filters: role (All / Candidate / Recruiter / Admin) · status (Active / Suspended / Deleted) · created date range · search by name/email
- `table-data` columns: Avatar + Name · Email · Role chip · Status chip · Created · Last Active · Actions (View · Suspend · Reset Password · Change Role · Delete)
- Bulk: Suspend, Export CSV
- Click row → drawer (`sheet-side`) with full user detail + activity log

**Suspend modal:** "Reason for suspension" required textarea + confirm.
**Delete modal:** GDPR-compliant; explains what gets deleted, requires typing email to confirm.

---

### `/admin/jobs` - Job Moderation

**Purpose:** Review all jobs, approve/reject, see bias flag history.

**Layout:**

- Filters: status, recruiter, has-bias-flags
- `table-data` columns: Title · Recruiter · Company · Status · Bias Flags count · Applications · Posted · Actions (View · Archive · Flag for Review)
- Click row → drawer with full job + bias flag history (which terms flagged, who overrode, why)

---

### `/admin/applications` - Application Oversight

**Purpose:** System-wide application audit, drill into any AI score.

**Layout:**

- Filters: job, score range slider (0-100), status, date range
- `table-data` columns: Candidate · Job · Match Score (`score-ring-sm`) · Match Band · Applied · Status · Action ("View full breakdown")
- Click → drawer with **full Score Breakdown** including evidence callouts and the redacted resume snapshot used for scoring (admin-only view of redaction transparency)

This is a key thesis demo surface - admin can audit any AI decision in detail.

---

### `/admin/ai-config` - AI Scoring Configuration

**Purpose:** Tune the scoring weights system-wide. Showpiece for thesis.

**Layout:**

```
┌──────────────────────────────────────────────────────────────────┐
│  AI Scoring Configuration                                         │
│                                                                   │
│  Match Score Weights (must sum to 100)                            │
│  ┌────────────────────────────────────────┐                      │
│  │ Skills Match         [slider · 40 ]    │                      │
│  │ Experience Match     [slider · 35 ]    │                      │
│  │ Education Match      [slider · 15 ]    │                      │
│  │ Cultural Fit         [slider · 10 ]    │                      │
│  └────────────────────────────────────────┘                      │
│                                                                   │
│  Score Band Thresholds                                            │
│  Strong Match  [70  ]-100                                         │
│  Partial Match [40  ]-[69  ]                                      │
│  Limited Match 0-[39  ]                                           │
│                                                                   │
│  Bias Detection                                                   │
│  [toggle] Enabled (currently ON)                                  │
│  [multi-select] Flag categories: gendered, age-coded, ableist     │
│  [textarea] Custom flagged terms (one per line)                   │
│                                                                   │
│  PII Redaction                                                    │
│  [toggle] Enabled (currently ON, cannot be disabled)              │
│  Redacted fields: name, photo, age, gender, address              │
│                                                                   │
│  [Preview Impact]   [Save Configuration]                          │
└──────────────────────────────────────────────────────────────────┘
```

**Preview Impact** runs the new weights against last 100 applications and shows score-distribution delta - proves to admin (and thesis examiner) that the weights are working.

**Save Configuration** writes new config + audit log entry; future scores use new weights.

---

### `/admin/audit` - Audit Log

**Purpose:** Immutable log of all consequential system actions.

**Layout:**

- Filters: actor (any user) · entity type (User · Job · Application · Score · Config · BiasFlag) · action type · date range
- `table-data` columns: Timestamp · Actor · Action · Entity · Detail (truncated, click for full JSON diff in drawer)
- Export: CSV
- No edit/delete actions on audit entries - rows are append-only

---

### `/admin/analytics` - System Analytics

**Purpose:** Platform-wide statistics.

**Layout:**

- KPI tiles: total users, growth rate, active jobs, applications/day, avg time-to-hire
- Charts:
  - User growth (line, by role)
  - Job postings over time
  - Applications by status (stacked area)
  - Score distribution histogram
  - AI processing time (avg parse, avg score)
  - Most active recruiters (bar)
  - Top in-demand skills (bar)
- Date range picker
- Export: CSV per chart

---

### `/admin/bias-monitor` - Bias & Fairness Monitor

**Purpose:** Aggregate fairness oversight. Thesis showpiece.

**Layout:**

```
┌──────────────────────────────────────────────────────────────────┐
│  Bias & Fairness Monitor                                          │
│  Date range: Last 30 days [▾]                                     │
│                                                                   │
│  ┌──────────┬──────────┬──────────┬──────────┐                   │
│  │ Flags    │ Flags    │ Flags    │ Override │                   │
│  │ Total    │ Per Job  │ Resolved │ Rate     │                   │
│  │   24     │  0.18    │  87%     │  12%     │                   │
│  └──────────┴──────────┴──────────┴──────────┘                   │
│                                                                   │
│  [card-widget: Flag Breakdown by Category]                        │
│   Gendered (12) · Age-coded (8) · Ableist (4)  bar chart          │
│                                                                   │
│  [card-widget: Top Flagged Terms]                                 │
│   Term         Count  Action                                      │
│   "rockstar"    7     [View jobs]                                 │
│   "ninja"       4     [View jobs]                                 │
│   "young"       3     [View jobs]                                 │
│   ...                                                             │
│                                                                   │
│  [card-widget: Score Distribution Audit]                          │
│   Histogram of match scores by score band, segmented              │
│   by job category - useful for spotting disparate impact          │
│                                                                   │
│  [card-widget: Recent Override Decisions]                         │
│   Recruiter overrode "rockstar" flag · reason "internal team..."  │
│   timestamp · jump-to-job link                                    │
└──────────────────────────────────────────────────────────────────┘
```

**Components:** `card-stat`, `card-widget`, table, charts. Each metric is hover-explained ("How is this calculated?").

This is the screen most likely to be shown in the thesis defense. Make it polished.

---

## Cross-Cutting Concerns

### Loading States

Every page that fetches data:

- Skeleton placeholders for the layout shape
- Topbar + sidebar render immediately (cached)
- Full content loads incrementally

AI-pending sections always show `ai-shimmer` with caption, never a silent skeleton.

### Error States

- Network error: page-level `alert-inline` + retry button
- Permission denied: full-page error card with "Go back" + "Sign in as different user"
- 404: friendly page with illustration + "Go to dashboard"

### Empty States

Every list, table, or widget defines its empty state - never "this section is blank."

### Mobile Behavior

All portal pages collapse:

- Sidebar → drawer (`nav-mobile-drawer`)
- Tables → vertical card lists
- Score Ring sm size on mobile
- Pipeline → horizontal scroll
- Two-column detail pages → stacked single-column

---

## Page Count Summary

| Surface          | Pages                   |
| ---------------- | ----------------------- |
| Marketing        | 5                       |
| Auth             | 7                       |
| Onboarding       | 2 wizards (8 steps)     |
| Candidate Portal | 10                      |
| Recruiter Portal | 13                      |
| Admin Portal     | 8                       |
| **Total**        | **~45 distinct routes** |

---

## Known Gaps (Sprint Scope)

- Notifications inbox screen (we use toasts + email; no separate inbox page in sprint)
- Team management (Phase 2 - recruiter sees stub "Coming soon")
- E-signature offer flow (replaced with simple Accept/Decline buttons)
- Public landing redesign for non-English locales
- Advanced calendar view inside `/recruiter/interviews` (we ship list view + simple week grid)
- Candidate-side messaging (deferred - no in-app chat)
