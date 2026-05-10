# Multi-Tenancy + Settings Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (in the executing session) to implement this plan **phase-by-phase**. This is a **post-sprint architectural overhaul**, not a single slice — it deliberately exceeds the May 2–4 window. Dispatch one fresh subagent per phase; review between phases; halt on failure. The plan is **forward-only**: there is no fallback to single-tenancy after Phase 1 lands. Cutover happens once, at the end of Phase 2.

**Authored:** 2026-05-05
**Estimated wall time:** ~3 focused days end-to-end (24 working hours; agents run faster but reviews + fixes consume the difference)
**Depends on:** All Day 1–4 slices complete (sprint shipped). System currently in single-tenant state — every recruiter owns one company 1:1.
**Out of scope:** Stripe billing, per-seat plan tiers, `subscription_items`, paywalls, "upgrade to add seats" gates. Schema leaves room for these (e.g., `companies.plan_id` nullable column reserved) but no enforcement, no UI, no Stripe integration.

---

## Goal

Convert AuraHire from a single-tenant model (one recruiter ⇄ one company) into a **multi-tenant** model where:

1. A **user account** can belong to **multiple companies** as a member with a per-company role
2. Every recruiter-side resource (jobs, applications, scoring config, audit logs, etc.) is scoped to a **company**, not to a recruiter
3. The user has an **active company** at any moment; the sidebar combobox switches it
4. New companies are created either at signup (the existing flow) or **after** signup from the company switcher
5. New members are added via **email invitations** with single-use tokens
6. The settings page is rebuilt as a **left-rail tabbed surface** with 9 sections split across "Personal" and "{Active Company}" groups, with role-aware visibility (Owner / Admin / Recruiter / Member)

The thesis-defining property — **explainable, fair AI scoring with full audit trail** — is preserved and _strengthened_: every audit log now carries `company_id`, making per-tenant explainability queries trivial.

---

## Why now (and why this is worth the scope)

The settings page motivated this. The original ask was "production-ready settings, like multiple tabs." But six of the nine planned sections (Company, Team Members, Scoring Config, Bias & Fairness, Integrations, Danger Zone) are **fictions** without multi-tenancy:

- "Team Members" implies a team — today there's one recruiter per company
- "Company settings" implies the company is editable as a shared entity — today it's tied to a single owner
- "Scoring Config" is per-recruiter today; for the thesis, it should be per-company so a team converges on agreed weights
- "Audit logs by company" is the headline explainability surface — but logs aren't yet tagged with `company_id`

So this work is **enabling infrastructure** for the settings page, the thesis demo (multi-recruiter teams reviewing the same candidate), and any future B2B feature.

---

## Architecture overview

### New tables

```sql
-- One row per (user, company) membership.
CREATE TABLE company_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES profiles(id) ON DELETE CASCADE, -- NULL while invitation pending
  email           text NOT NULL, -- snapshot at invite time; survives user deletion
  role            text NOT NULL CHECK (role IN ('owner', 'admin', 'recruiter')),
  status          text NOT NULL CHECK (status IN ('invited', 'active', 'suspended', 'left')),
  invitation_token  text UNIQUE,         -- single-use; null once accepted
  invitation_expires_at timestamptz,
  invited_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  invited_at      timestamptz NOT NULL DEFAULT now(),
  joined_at       timestamptz,           -- set when status flips invited→active
  removed_at      timestamptz,           -- set when status flips active→suspended/left
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id),          -- one membership per (company, user)
  UNIQUE (company_id, email)             -- can't invite same email twice to one company
);

CREATE INDEX company_members_user_status_idx ON company_members(user_id, status);
CREATE INDEX company_members_company_status_idx ON company_members(company_id, status);
CREATE INDEX company_members_invitation_token_idx ON company_members(invitation_token) WHERE invitation_token IS NOT NULL;
```

**Why no separate `invitations` table?** The lifecycle (invited → active → suspended/left) is the same row's status field. Merging keeps queries simple ("show all team members including pending invites" is one query) and avoids a foreign-key dance when an invitee accepts. Trade-off: rows linger after acceptance; we accept that cost.

### Modified tables

```sql
-- profiles: track the user's currently-active company
ALTER TABLE profiles ADD COLUMN last_active_company_id uuid REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX profiles_last_active_company_idx ON profiles(last_active_company_id);

-- companies: track who created it; useful for analytics + the "first owner" concept
-- (companies.created_by already exists per profiles.repository.ts:89 — no change)

-- recruiter_profiles: drop the 1:1 link
-- Today: recruiter_profiles.company_id (NOT NULL, FK to companies)
-- After:  REMOVE this column entirely. Membership lives in company_members.
ALTER TABLE recruiter_profiles DROP COLUMN company_id;

-- jobs: already has company_id (jobs.repository assumed). Verify.
-- audit_logs: ADD company_id NULLABLE so cross-tenant admin actions still log
ALTER TABLE audit_logs ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX audit_logs_company_id_idx ON audit_logs(company_id);

-- scoring_configs: already keyed on company_id (per docs/main/ai-design.md). Verify.
```

### Active company resolution

Every recruiter-side request must resolve **which company** is being acted on. Resolution priority:

1. **Header override** — `X-Active-Company-Id: {uuid}` from frontend (frontend always sends this once a company is selected)
2. **Stored default** — `profiles.last_active_company_id` if header absent
3. **Fallback** — first active membership ordered by `joined_at asc` (the user's "oldest" company; deterministic)
4. **None** — user has zero active memberships → 403 + frontend redirect to `/onboarding/company`

### `ActiveCompanyGuard` (new)

Lives at `apps/api/src/common/guards/active-company.guard.ts`. Runs **after** `SupabaseAuthGuard` + `RolesGuard`. Responsibilities:

1. Resolve active `company_id` per the priority above
2. Verify `company_members` row exists with `status='active'`
3. Attach `req.activeCompanyId` and `req.companyRole` (one of `owner`, `admin`, `recruiter`)
4. Reject with 403 + `{ code: "NO_ACTIVE_COMPANY" }` if user has no membership

Applied **globally** to all `/api/v1/*` routes that have `@Roles('recruiter')`, except a small allowlist of "pre-membership" endpoints (`/profiles/me`, `/companies/create`, `/invitations/accept`, `/invitations/preview`, `/profiles/me/memberships`).

A new decorator `@RequireCompanyRole('owner' | 'admin')` enforces per-route role gates inside the active company.

### Frontend active company context

A new `<ActiveCompanyProvider>` mounted in `apps/web/app/(recruiter)/layout.tsx`:

- On mount, fetches `/api/v1/profiles/me/memberships` (returns: `[{ companyId, name, logoUrl, role, status }]`)
- Reads `profiles.last_active_company_id` (returned by `/profiles/me` already)
- Stores `{ activeCompanyId, activeCompany, role, memberships }` in React context
- Exposes `useActiveCompany()` hook everywhere
- Adds an Axios/fetch interceptor that injects `X-Active-Company-Id: {activeCompanyId}` on every API call from this layout
- On switch: PATCH `/profiles/me { lastActiveCompanyId }`, then `queryClient.clear()`, then `router.refresh()` to repaint server components

### Sidebar company switcher (replaces the cosmetic chip)

Component lives at `apps/web/components/layout/company-switcher.tsx`. UX:

```
┌──────────────────────────┐
│  TI  TechCorp Inc.    ⇕  │  ← clickable, opens combobox
└──────────────────────────┘
              ↓ open
┌──────────────────────────┐
│  ✓  TechCorp Inc.        │  ← current; shows checkmark + role chip on right
│       Owner              │
│                          │
│     Acme Co              │
│       Recruiter          │
│                          │
│     Beta Labs            │
│       Admin              │
│ ────────────────────────│
│  +  Create new company   │  ← always visible
│  ✉  Accept invitation    │  ← visible if user has pending invitations
└──────────────────────────┘
```

Built on top of the existing dropdown-menu primitive (matches shortlist filter style). Avatar block on the trigger reuses the `initials()` helper.

### Email branding

All transactional emails sent on a company's behalf get the company name + logo prepended:

- `interview-scheduled`, `interview-cancelled`
- `offer-sent`, `offer-decision`, `offer-expired`
- `application-received`, `application-status-changed`

The new `_brand-header.tsx` template (already present in `apps/api/src/email/templates/_brand-header.tsx` per `git status`) takes a `company` prop. Templates that previously read just AuraHire branding now layer company branding above AuraHire's footer.

The recruiter invitation email is the **one** template that has only AuraHire branding (until the user joins, the company isn't "theirs" yet) — it shows the inviting company name in body copy only.

### Cache invariants

Every Redis cache key gains a `company` segment:

| Old key                                            | New key                                              |
| -------------------------------------------------- | ---------------------------------------------------- |
| `dashboard:recruiter:{userId}:analytics`           | `dashboard:recruiter:{userId}:{companyId}:analytics` |
| `interviews:recruiter:{userId}:list`               | `interviews:recruiter:{userId}:{companyId}:list`     |
| `jobs:recruiter:{userId}:list:{hash}`              | `jobs:company:{companyId}:list:{hash}`               |
| `applications:recruiter:{userId}:shortlist:{hash}` | `applications:company:{companyId}:shortlist:{hash}`  |

Tag invalidation similarly company-scoped. Cutover requires a **full Redis flush** to prevent cross-tenant cache poisoning.

### RLS rewrite

Every existing policy of the form:

```sql
USING (recruiter_id = auth.uid())
```

becomes:

```sql
USING (
  EXISTS (
    SELECT 1 FROM company_members
    WHERE company_members.company_id = <table>.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.status = 'active'
  )
)
```

Tables affected: `jobs`, `applications`, `match_scores`, `interviews`, `offers`, `scoring_configs`, `bias_flags`, `bias_requests`, `audit_logs` (read scope; admin role bypasses via separate policy).

Expected query plan impact: ~5–15% slower on heavy list endpoints. Compensated by indexing `company_members(user_id, company_id, status)` (already in the new table DDL above).

### Public job URLs

Today: `/jobs/{slug}` where slug must be globally unique. With multi-tenancy, two companies could pick the same slug.

**Decision:** Keep `/jobs/{id}` (UUID) for canonical URLs. Slugs become **per-company** for SEO-friendly variants: `/c/{company-slug}/jobs/{job-slug}`. The UUID form always works as a permalink; the company-prefixed form is the marketing surface. Existing `/jobs/{slug}` URLs are deprecated by treating slug as nullable on `jobs.slug` and only generating UUID URLs going forward; old shared links 404 (acceptable — system has no public users yet).

---

## User flows (post-cutover)

### Recruiter — first-time signup

```
/register
  ↓ email + password (Supabase Auth)
/auth/verify (email link click)
  ↓ verified
/onboarding (new step 0)
  ┌──────────────────────────────────────────────────────────────┐
  │ "How do you want to start with AuraHire?"                    │
  │   ○ Create a new company                                     │
  │   ○ Join my team (I have an invitation)                      │
  └──────────────────────────────────────────────────────────────┘
  ├─ "Create" → /onboarding/company       (existing form, slightly modified)
  │              ↓ submit
  │              [Tx: insert companies, insert profiles, insert
  │               company_members(role=owner, status=active),
  │               set profiles.last_active_company_id]
  │              ↓
  │              /onboarding/profile      (existing recruiter profile form)
  │              ↓ submit
  │              /recruiter (dashboard)
  │
  └─ "Join"   → /onboarding/invite
                ↓ paste token OR (if `?token=...` in URL) auto-fill
                [GET /invitations/preview?token=...]
                ↓ shows "{Inviter} invited you to {Company} as {Role}"
                ↓ Accept
                [POST /invitations/accept body={token}]
                [Tx: update company_members set status='active',
                 user_id=me, joined_at=now(), invitation_token=null;
                 set profiles.last_active_company_id=that company]
                ↓
                /onboarding/profile
                ↓
                /recruiter (dashboard, scoped to that company)
```

### Recruiter — invited _without_ an account

```
Email link: aurahire.app/invite/{token}
   ↓ no session
/invite/{token}
   ↓ shows preview (server-fetches /invitations/preview)
   ↓ "Sign up to accept"
[Set cookie pendingInviteToken={token}]
   ↓
/register (standard signup)
   ↓ email verified
/onboarding (cookie detected → skip "create vs join" choice → straight to invite acceptance)
   ↓ Accept (cookie consumed + cleared)
/onboarding/profile
   ↓
/recruiter
```

### Recruiter — already signed in, clicks invite link for a _different_ company

```
aurahire.app/invite/{token}
   ↓ session detected
/invite/{token} (auth-aware page)
   ↓ shows preview "{Inviter} invited you to {Company} as {Role}"
   ↓ "Accept" → POST /invitations/accept
   ↓ Toast: "You joined {Company} as {Role}. Switch to it now?"
   ↓ Switch button → updates last_active_company_id + queryClient.clear() + router.refresh()
   ↓ Lands on /recruiter under the new active company
```

### Recruiter — daily work

Every page in `/recruiter/*` reads `useActiveCompany()`. Every API call carries `X-Active-Company-Id`. Server controllers run through `ActiveCompanyGuard`. The user's mental model is "I'm working in TechCorp right now"; switching companies is one click.

### Recruiter — switching companies

1. Click sidebar combobox → opens
2. Select another company in the list
3. Frontend: PATCH `/profiles/me { lastActiveCompanyId }`, await response
4. `queryClient.clear()` invalidates everything
5. `router.refresh()` re-renders server components
6. URL stays the same (e.g., `/recruiter/jobs`); data reloads under new scope
7. **Edge case:** if URL is `/recruiter/jobs/{id}` and that job belongs to the previous company, the API returns 404 → frontend redirects to `/recruiter/jobs`

### Recruiter — inviting a teammate (Settings → Team Members)

Owner / Admin only. Form: email + role.

```
POST /api/v1/companies/{companyId}/invitations { email, role }
  ↓ backend:
   - verifies caller is owner/admin of companyId
   - rejects if email already has an active or invited row in this company
   - generates invitation_token (32 bytes, base64url), expires_at = now() + 14d
   - inserts company_members(user_id=null, status='invited', email, role, token)
   - sends invitation email with link aurahire.app/invite/{token}
   ↓
Pending row appears in team list with "Resend" / "Revoke" / "Copy link" actions
```

Resend = regenerate token + send new email + update expires_at.
Revoke = delete the row.

### Recruiter — leaving / being removed

- **Self-leave** (Settings → Danger Zone → "Leave company"): row updated to `status='left'`, `removed_at=now()`. `last_active_company_id` is repointed to the next-oldest active membership; if none, cleared and user is redirected to `/onboarding` (must create or join one).
- **Last owner leaving** is blocked unless ownership is first transferred. The "Leave" button shows "Transfer ownership first" if there's no other admin.
- **Owner removes a member** (Team Members table → ⋮ → "Remove"): row updated to `status='suspended'`, `removed_at=now()`. Member's audit history is preserved. On their next request, `ActiveCompanyGuard` rejects → frontend signs them out of that company and switches.
- **Owner deletes the company** (Danger Zone, requires typing the company name to confirm): cascade via `ON DELETE CASCADE` on `company_members.company_id`, plus explicit deletes for `jobs`, `applications`, `interviews`, `offers`, `scoring_configs`, `bias_flags`. Audit logs are kept (with `company_id` set to NULL via `ON DELETE SET NULL` on the FK) — historical record of the company existing.

### Candidate — flow

Candidates are **not** affected by multi-tenancy. Their flow is unchanged:

- Sign up, verify email, onboarding (name, headline, resume upload, AI parse, profile score)
- Browse `/jobs` — sees jobs across all companies, each card now shows the company name + logo
- Apply — application is created on `(candidate_id, job_id)`; `company_id` derived from the job's join
- Funnel — status updates exactly as before; emails now carry the company's branding
- Settings — gains a new **"Privacy & Data"** section: export, delete account (PII scrub on audit logs, hashed reference retained), and a "Who has my data" view listing every company the candidate has applied to with a per-company "Revoke this company's view" action

What changes for the candidate is **perception**, not mechanics:

- Application detail "Applied to {Company}" instead of "Applied to {Job}"
- Email "TechCorp scheduled an interview" instead of "AuraHire scheduled an interview"
- An application visible to a team rather than one recruiter — but the candidate doesn't know team size, so no copy change there

### Admin — flow

Admin sits **above** the tenant boundary. `profiles.role = 'admin'` is independent of `company_members`. An admin doesn't need to be in any company.

- `/admin` dashboard — cross-tenant: total companies, users, jobs, applications, avg scores, top companies by activity
- `/admin/companies` — every company; columns: name, owner, member count, job count, created, status. Per-row actions: Suspend (sets `companies.suspended=true`; `ActiveCompanyGuard` rejects all member access until restored), Restore, View as (impersonation — opens `/recruiter` with that company as active; flagged in audit log with `actor_type='admin_impersonation'`), Delete (cascade as above)
- `/admin/users` — every user across roles. Suspend globally (Supabase Auth ban → invalidates sessions). Reset password. Change role.
- `/admin/audit` — cross-tenant audit log viewer. Filter by user, company, action, date range. Export CSV. **The thesis explainability surface.**
- `/admin/scoring` — system-wide scoring weight defaults. New companies' `scoring_configs` clone these on creation. Editing does NOT retroactively change existing companies' configs.
- `/admin/bias` — aggregate bias detection stats across companies; outlier detection (frequent overrides flagged for review)
- `/admin/help` — manage help articles surfaced in all role portals (`apps/web/app/(admin|candidate|recruiter)/*/help/`, currently empty per `git status`)

Admins **bypass** `ActiveCompanyGuard` — they see everything, audit-logged. A separate `AdminBypassGuard` runs first and short-circuits the active-company check when `user.role === 'admin'`.

---

## Phase breakdown

The work is sequenced into **6 phases**. Each phase ends in a state where the system is functional (CI green, manual smoke test green); a phase can be a separate PR. Within a phase, the executing agent dispatches one subagent per task.

### Phase 1 — Schema migration + data model (Day 1: ~4 hours)

**Goal:** Land the new tables, alter existing ones, backfill production data, generate Drizzle types. System remains functionally single-tenant after this phase (every recruiter still has exactly one company; nothing in code reads `company_members` yet).

**Tasks:**

1. Write Drizzle migration `packages/db/src/migrations/NNNN_multi_tenancy.sql`:
   - `CREATE TABLE company_members ...` (DDL above)
   - `ALTER TABLE profiles ADD COLUMN last_active_company_id ...`
   - `ALTER TABLE audit_logs ADD COLUMN company_id ...`
   - `ALTER TABLE recruiter_profiles DROP COLUMN company_id` (after backfill)
   - All indexes from the DDL above

2. Write the **backfill** as a single `WITH` statement in the same migration:

   ```sql
   WITH new_owners AS (
     INSERT INTO company_members (company_id, user_id, email, role, status, joined_at)
     SELECT
       rp.company_id,
       rp.id,
       p.email,
       'owner',
       'active',
       p.created_at
     FROM recruiter_profiles rp
     INNER JOIN profiles p ON p.id = rp.id
     RETURNING company_id, user_id
   )
   UPDATE profiles
     SET last_active_company_id = new_owners.company_id
     FROM new_owners
     WHERE profiles.id = new_owners.user_id;
   ```

3. Update `packages/db/src/schema.ts`:
   - Add `companyMembersTable`
   - Add `lastActiveCompanyId` to `profilesTable`
   - Add `companyId` to `auditLogsTable`
   - Remove `companyId` from `recruiterProfilesTable`
   - Export new types: `CompanyMember`, `NewCompanyMember`, `CompanyMemberRole`, `CompanyMemberStatus`

4. Update `packages/shared/src/enums/index.ts`:
   - Re-export `COMPANY_MEMBER_ROLE` (`['owner', 'admin', 'recruiter']`)
   - Re-export `COMPANY_MEMBER_STATUS` (`['invited', 'active', 'suspended', 'left']`)
   - Re-export the corresponding type unions

5. **Human runs the migration** in dev (`drizzle-kit push` or `supabase db push`). Claude does NOT run this — see `CLAUDE.md` § Hard Rules.

**DoD for Phase 1:**

- [ ] Migration file written, reviewed
- [ ] Drizzle schema regenerates types successfully (`pnpm tsc --noEmit` green)
- [ ] Backfill plan documented in the migration's leading comment
- [ ] All existing tests still pass (no behavioral change yet)
- [ ] Human has applied migration and verified row counts:
  - `SELECT COUNT(*) FROM company_members` equals `SELECT COUNT(*) FROM recruiter_profiles` from before
  - Every existing recruiter has `last_active_company_id` set

---

### Phase 2 — Backend guard + endpoint scoping (Day 1.5: ~6 hours)

**Goal:** Wire `ActiveCompanyGuard` and the `@RequireCompanyRole` decorator. Refactor every recruiter endpoint to scope by `req.activeCompanyId` instead of `userId`. **Cutover phase** — old "recruiter owns it" code paths are removed.

**Tasks:**

1. Implement `apps/api/src/common/guards/active-company.guard.ts`:
   - Reads `X-Active-Company-Id` header (falls back to `profiles.last_active_company_id`)
   - Verifies via `companyMembersRepo.findActive(userId, companyId)`
   - Attaches `req.activeCompanyId`, `req.companyRole`
   - Skipped when `user.role === 'admin'` (admin bypass)

2. Implement `@RequireCompanyRole('owner' | 'admin' | 'recruiter')` decorator + accompanying guard. Defaults to "any active member" when decorator absent.

3. Implement `apps/api/src/modules/companies/company-members.repository.ts`:
   - `findActive(userId, companyId)` → `CompanyMember | null`
   - `listForUser(userId)` → `Array<{ company, role, status }>` (joins companies)
   - `listForCompany(companyId)` → `Array<{ user, role, status }>` (joins profiles)
   - `insert`, `update`, `delete`, `findByToken`, etc.

4. Implement `apps/api/src/modules/companies/companies.controller.ts` + service:
   - `POST /companies` — create new company (caller becomes owner)
   - `GET /companies/me` — current active company details
   - `PATCH /companies/me` — update active company (owner/admin only)
   - `DELETE /companies/me` — delete (owner only, requires confirmation)
   - `GET /companies/me/members` — list team members + pending invites
   - `POST /companies/me/members` — invite (owner/admin only)
   - `PATCH /companies/me/members/:id` — change role / suspend (owner/admin only)
   - `DELETE /companies/me/members/:id` — remove member (owner/admin only)

5. Implement `apps/api/src/modules/invitations/invitations.controller.ts`:
   - `GET /invitations/preview?token=...` — public; returns `{ company, inviterName, role, expiresAt, status }` for the invite page
   - `POST /invitations/accept { token }` — auth required; flips status to active, populates user_id, sets last_active_company_id
   - `POST /invitations/decline { token }` — auth required; deletes the row

6. Implement `apps/api/src/modules/profiles/profiles.controller.ts` additions:
   - `GET /profiles/me/memberships` — returns the user's full membership list (used by the sidebar switcher)
   - `PATCH /profiles/me` — already exists; extend to accept `lastActiveCompanyId` (validated against memberships)

7. Refactor every recruiter endpoint to use `req.activeCompanyId`. Files to touch:
   - `apps/api/src/modules/jobs/jobs.controller.ts` + service + repository
   - `apps/api/src/modules/applications/applications.controller.ts` + service + repository
   - `apps/api/src/modules/interviews/interviews.controller.ts` + service + repository (already partially scoped via `jobs.recruiter_id` — switch to `jobs.company_id`)
   - `apps/api/src/modules/offers/offers.controller.ts` + service + repository
   - `apps/api/src/modules/scoring/...`
   - `apps/api/src/modules/bias/bias.controller.ts` + service
   - Recruiter dashboard analytics queries

8. Apply `ActiveCompanyGuard` globally via `app.useGlobalGuards(...)` in `main.ts`, with a **public allowlist** for `/auth/*`, `/companies` (POST), `/profiles/me`, `/profiles/me/memberships`, `/invitations/*`.

9. Update every audit log call to include `companyId`. Audit service signature gains `companyId?: string` (optional only for admin/system actions).

10. Update every Redis cache key to include `:{companyId}:`. Add a one-time Redis flush in the deployment runbook.

11. Update RLS policies (write the SQL; human runs):
    ```sql
    -- Example for jobs:
    DROP POLICY IF EXISTS jobs_recruiter_select ON jobs;
    CREATE POLICY jobs_company_member_select ON jobs FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM company_members cm
          WHERE cm.company_id = jobs.company_id
            AND cm.user_id = auth.uid()
            AND cm.status = 'active'
        )
      );
    -- Repeat for: applications, match_scores, interviews, offers,
    --             scoring_configs, bias_flags, bias_requests, audit_logs
    ```

**DoD for Phase 2:**

- [ ] `ActiveCompanyGuard` compiles, tested with unit tests covering: header present + valid, header absent + last_active fallback, no membership → 403, admin bypass
- [ ] All recruiter endpoints scope by `req.activeCompanyId`; grep for `recruiterId` in queries returns zero results in `apps/api/src/modules/{jobs,applications,interviews,offers,scoring,bias}`
- [ ] Cache keys include company segment; `pnpm tsc --noEmit` green
- [ ] Audit log entries for the demo recruiter include `companyId`
- [ ] RLS migration script written; human applies + spot-checks via `EXPLAIN`
- [ ] Manual test: API client with `X-Active-Company-Id: <wrong-id>` returns 403 across every protected endpoint
- [ ] All existing E2E flows still work (recruiter creates job, candidate applies, recruiter scores, etc.)

---

### Phase 3 — Frontend active-company context + sidebar switcher (Day 2: ~3 hours)

**Goal:** Frontend reads, persists, and switches active company. The sidebar chip becomes a real combobox.

**Tasks:**

1. Implement `apps/web/contexts/active-company-context.tsx`:
   - `<ActiveCompanyProvider>` with state `{ activeCompanyId, activeCompany, role, memberships, isLoading }`
   - On mount: fetch `/profiles/me/memberships` + read `last_active_company_id` from `/profiles/me`
   - Exposes `useActiveCompany()` hook
   - Exposes `switchCompany(companyId)` function: PATCH `last_active_company_id`, await, `queryClient.clear()`, `router.refresh()`

2. Wire the provider in `apps/web/app/(recruiter)/layout.tsx` (between `<RoleGuard>` and `<PortalSidebar>`).

3. Update `apps/web/lib/_client-fetch.ts` (and the server fetch helper):
   - Add a request interceptor that injects `X-Active-Company-Id: {activeCompanyId}` from the context
   - Server-side: read `last_active_company_id` from session profile and inject

4. Implement `apps/web/components/layout/company-switcher.tsx`:
   - Uses dropdown-menu primitive
   - Trigger: company avatar (initials) + name + `⇕` icon, matches existing sidebar TechCorp Inc. visual
   - Content: list of memberships (✓ on active, role chip on right) + dividers + "+ Create new company" + "✉ Accept invitation" (only if pending)
   - Clicking a company calls `switchCompany`
   - Clicking "Create" navigates to `/onboarding/company?from=switcher`
   - Clicking "Accept" opens a paste-token modal

5. Replace the existing static company chip in `apps/web/components/layout/portal-sidebar.tsx` with `<CompanySwitcher />`.

6. Handle 404 on company switch: if the user is on `/recruiter/jobs/{id}` and the new active company doesn't have that job, the API returns 404 → catch in client component → redirect to `/recruiter/jobs`.

**DoD for Phase 3:**

- [ ] `useActiveCompany()` hook returns expected shape on every recruiter page
- [ ] Sidebar combobox opens, lists memberships, switches company on click, persists across reload
- [ ] All TanStack queries refetch on switch (no stale data shown)
- [ ] Visual match to the existing chip (initials, name, ⇕ icon, hover state)
- [ ] Type-check + lint green

---

### Phase 4 — Onboarding fork + invitation flow (Day 2: ~4 hours)

**Goal:** Update signup to support both "create company" and "join via invite." Implement the public `/invite/{token}` page and the in-app accept flow. Implement the email template.

**Tasks:**

1. Add `/onboarding/start` step at `apps/web/app/onboarding/start/page.tsx`:
   - Two large radio cards: "Create a new company" / "Join my team"
   - On submit, redirects to `/onboarding/company` or `/onboarding/invite`

2. Update `apps/web/app/onboarding/recruiter/...` to route through the new fork. The existing company form moves to `/onboarding/company` unchanged.

3. Implement `/onboarding/invite` flow:
   - Form with token input (or pre-filled from URL `?token=...`)
   - Calls `/invitations/preview` to fetch company + inviter + role
   - "Accept" calls `/invitations/accept`, then redirects to `/onboarding/profile`

4. Implement public-aware invite landing `apps/web/app/invite/[token]/page.tsx`:
   - Server component: fetches preview server-side
   - If session: shows "Accept" button + "Switch to it now?" toast post-accept
   - If no session: shows "Sign up to accept" → sets `pendingInviteToken` cookie → redirects to `/register`

5. In `/register`'s post-verify handler: detect `pendingInviteToken` cookie → skip the "create vs join" step → route directly to `/onboarding/invite?token=...`.

6. Implement the React Email template at `apps/api/src/email/templates/team-invitation.tsx`:
   - Subject: `{Inviter} invited you to {Company} on AuraHire`
   - CTA: `aurahire.app/invite/{token}`
   - Expiry note: "Expires in 14 days"
   - AuraHire branding only (the company isn't yet "theirs")

7. Implement the Settings → Team Members page (Phase 5 ships the full settings shell, but this page is built early because the invite flow needs it):
   - Stub it inside the existing `/recruiter/settings` until Phase 5 reorganizes
   - Table: avatar, name (or pending email), role, status, joined date, ⋮ actions

**DoD for Phase 4:**

- [ ] Fresh recruiter signup → "Create company" path works end-to-end (already mostly working; just confirm onboarding/start gate is in place)
- [ ] Fresh recruiter signup → "Join my team" path works end-to-end with manual token
- [ ] Invite link from email: signed-out path (cookie → register → auto-route) works
- [ ] Invite link from email: signed-in path (`/invite/{token}` → preview → accept → switch) works
- [ ] Inviting an existing email is rejected with a clear error
- [ ] Resend / Revoke / Copy link work
- [ ] Token expiry is enforced (test with expired token → 410 Gone)
- [ ] Email arrives in Mailpit with correct content + working link

---

### Phase 5 — Settings shell + 9 sections (Day 2.5: ~6 hours)

**Goal:** Rebuild `/recruiter/settings` (and the candidate equivalent) as a left-rail tabbed surface. Each section is a sub-route.

**Layout:**

```
/recruiter/settings/
├── layout.tsx                 ← left-rail nav
├── page.tsx                   ← redirect to /profile
├── profile/page.tsx           ← Personal: profile (existing form, moved)
├── security/page.tsx          ← Personal: change password, sessions
├── notifications/page.tsx     ← Personal: per-event email toggles
├── privacy/page.tsx           ← Personal: data export, delete account
├── company/page.tsx           ← Company: name, logo, website, size, industry  (owner/admin only)
├── members/page.tsx           ← Company: team table + invite (owner/admin only)
├── scoring/page.tsx           ← Company: scoring weight config (owner/admin only)
├── bias/page.tsx              ← Company: bias detection sensitivity (owner/admin only)
├── integrations/page.tsx      ← Company: webhooks, Slack, ATS export (owner/admin only)
└── danger/page.tsx            ← Company: leave / transfer / delete   (mixed)
```

**Tasks:**

1. Build `apps/web/app/(recruiter)/recruiter/settings/layout.tsx`:
   - Two-column layout: left rail (256px) + main content (max-width 720px for readability)
   - Left rail: two groups — "PERSONAL" (always shown) and "{ActiveCompany.name}" (shown only if `role !== 'recruiter'` OR sections that recruiters can read)
   - Each item: icon + label, active state matches existing sidebar items
   - Mobile: collapse rail to a top tab strip

2. Build each section page. They share the form pattern from the existing `_settings-form-client.tsx`. Use TanStack Query mutations + the existing `<Toast>` patterns.

3. **Profile** — existing form, moved verbatim.

4. **Security** — change password (Supabase Auth `updateUser`), list active sessions (Supabase Auth `getSessionList` if available, otherwise stub), 2FA placeholder ("Coming soon").

5. **Notifications** — table of event toggles. Schema: `notification_preferences(user_id, event, channel, enabled)`. Events: new application, interview reminders, offer events, weekly digest. Default all `true`.

6. **Privacy** — data export ("Email me a zip" → triggers a backend job that generates the zip and emails a download link). Delete account button (confirms, scrubs PII from audit logs, removes profile + cascade).

7. **Company** — owner/admin form. Name, logo upload (Supabase Storage), website, size enum, industry text. Logo is shown on every job card + email header.

8. **Members** — table with avatar, name/email, role, status, joined, ⋮. Invite modal: email + role. Pending invites have Resend / Revoke / Copy link. Owner can transfer ownership (modal: select another admin, type their email to confirm).

9. **Scoring** — sliders for weights (skills, experience, education, keywords). Sum must equal 100. Save bumps `prompt_version` and writes audit log entry. Show last-modified timestamp + author + diff vs previous.

10. **Bias & Fairness** — toggles + thresholds (sensitivity per category from `BIAS_CATEGORY` enum). Override audit (read-only list).

11. **Integrations** — webhook URL field (events fire to it), Slack incoming webhook URL, "Export to CSV" buttons for jobs/applications. Stub the webhook delivery with a confirmation that the URL is reachable.

12. **Danger Zone** — three subsections:
    - "Leave company" (any member, blocked for last owner)
    - "Transfer ownership" (owner only)
    - "Delete company" (owner only; requires typing company name)

13. Candidate parallel: `apps/web/app/(candidate)/candidate/settings/{profile,security,notifications,privacy}` — only the four personal sections. No company group.

14. Admin gets `apps/web/app/(admin)/admin/settings/` with admin-specific sections (system-wide scoring defaults, system-wide bias thresholds, help articles). Out of scope for the recruiter-focused settings page above; ship in a follow-up phase if time permits.

**DoD for Phase 5:**

- [ ] All 9 recruiter sections accessible via left-rail navigation
- [ ] Role-based visibility works (recruiter cannot see Company / Members / Scoring / etc.)
- [ ] Profile / Security / Notifications / Privacy all save successfully and persist
- [ ] Company / Members / Scoring / Bias / Integrations / Danger Zone all save successfully (where editable) and audit-log
- [ ] Mobile breakpoint works (rail collapses to top tabs)
- [ ] Visual consistency with shortlist / jobs pages (pill CTAs, hairline cards, mono numbers, etc.)
- [ ] Type-check + lint green; manual smoke test of every section

---

### Phase 6 — Email branding, candidate UI tweaks, admin oversight, RLS verification (Day 3: ~5 hours)

**Goal:** Polish remaining surfaces. Re-brand emails. Update candidate-facing copy. Wire admin's cross-tenant views.

**Tasks:**

1. Update every transactional email template to accept and render company branding (the `_brand-header.tsx` from `git status` is already started):
   - `interview-scheduled`, `interview-cancelled` — company name + logo
   - `offer-sent`, `offer-decision`, `offer-expired` — company name + logo
   - `application-received`, `application-status-changed` — company name + logo
   - `password-reset`, `verify-email` — AuraHire branding only (account-level, not company-level)
   - `team-invitation` — AuraHire branding + company name in body copy

2. Update candidate-facing copy:
   - Job cards (`/jobs`) and detail page now show company name + logo prominently
   - Application list shows "Applied to {Company}" instead of just job title
   - Notifications mirror the email subjects ("TechCorp scheduled an interview")

3. Build `/admin/companies` page with the table + actions described in the Admin flow section.

4. Build `/admin/audit` cross-tenant viewer: filter by user/company/action/date, CSV export.

5. Wire the "View as" admin impersonation: clicking it sets a session cookie `adminImpersonating: <companyId>`; the `ActiveCompanyGuard` honors this when `user.role === 'admin'`. Every audit log entry during impersonation gets `actor_type='admin_impersonation'`. Visible banner on top of the screen during impersonation: "Viewing as TechCorp Inc. — exit"

6. Run an RLS verification pass:
   - Sign in as recruiter A in company X, attempt to read jobs.company_id=Y via raw SQL through Supabase client → MUST be denied
   - Sign in as recruiter B in company X, attempt the same → MUST be allowed (B is a member of X)
   - Cross-test for: jobs, applications, interviews, offers, scoring_configs, bias_flags, audit_logs

**DoD for Phase 6:**

- [ ] All email templates render company branding correctly in Mailpit preview
- [ ] Candidate-facing surfaces show company attribution
- [ ] Admin can list, suspend, restore, impersonate, delete companies
- [ ] Admin audit log viewer works with cross-tenant filtering and CSV export
- [ ] RLS spot checks pass for all 8 affected tables
- [ ] No regression on existing E2E flows

---

## Things to expect that will bite you

These are surfaced again from the conversation thread, in checklist form:

- [ ] **Cache poisoning during cutover** — flush Redis on deploy
- [ ] **In-flight requests during company switch** — TanStack query keys must include `companyId` so stale responses are dropped
- [ ] **Email templates referencing "your company"** as a singleton — sweep all 10 templates
- [ ] **Seed data assumes 1 recruiter = 1 company** — must regenerate to seed multi-member companies + pending invites
- [ ] **Public job URL slug collisions** — pick UUID-based URLs as canonical (`/jobs/{id}`); slugs become per-company
- [ ] **Invite token security** — long-random, single-use, expire on use, rate-limited acceptance
- [ ] **Audit log volume growth** — partial index on `company_id`; consider `created_at` partitioning later
- [ ] **Last owner edge case** — block leave/delete-account if it would orphan a company
- [ ] **Pending member counts** — does Settings → Members count "invited" rows toward member count? Decide upfront. **Recommendation:** show separately ("3 active, 2 pending") to keep UX honest.
- [ ] **Email-already-invited** — POST `/invitations` must reject if the email already has any non-`left` row in the same company (active or invited)
- [ ] **User-deleted-after-invite** — if an invitee deletes their account before accepting, the row's `email` column is the only identifier; revoke pending invites if email matches a deleted user
- [ ] **Company suspension UX** — when an admin suspends a company, members on that page get a full-screen "This company is suspended. Contact your administrator." overlay; their `last_active_company_id` is **not** auto-changed (so when company is restored, they land back where they were)
- [ ] **Membership-only admin paths** — `/admin/users` etc. don't go through `ActiveCompanyGuard`; ensure no leak of admin endpoints under `/api/v1/recruiter/*`

---

## Definition of Done (overall)

The full overhaul is complete when ALL the following are true:

**Backend:**

- [ ] All 6 phases' DoD checklists are green
- [ ] Every recruiter endpoint scopes by `req.activeCompanyId`; zero remaining references to `recruiterId` as a scoping field in `apps/api/src/modules/{jobs,applications,interviews,offers,scoring,bias,...}`
- [ ] Every audit log entry from a recruiter action includes `companyId`
- [ ] All RLS policies reference `company_members`; old `recruiter_id = auth.uid()` policies removed
- [ ] `ActiveCompanyGuard` applied globally with documented allowlist
- [ ] `pnpm --filter @aurahire/api exec tsc --noEmit` clean
- [ ] `pnpm --filter @aurahire/api test` clean

**Frontend:**

- [ ] `<ActiveCompanyProvider>` mounted in recruiter layout
- [ ] Sidebar combobox switches companies; data refetches; persists across sessions
- [ ] Onboarding fork (create vs join) works for fresh signups
- [ ] Public `/invite/{token}` page works for signed-in and signed-out users
- [ ] All 9 settings sections functional with role-based visibility
- [ ] Candidate-facing surfaces show company attribution
- [ ] All transactional emails carry company branding where appropriate
- [ ] `pnpm --filter @aurahire/web exec tsc --noEmit` clean
- [ ] `pnpm --filter @aurahire/web exec next lint` clean

**Data:**

- [ ] Migration applied; all existing recruiters have one `company_members(role=owner, status=active)` row
- [ ] Every existing recruiter has `last_active_company_id` set
- [ ] `recruiter_profiles.company_id` column dropped (verify with `\d recruiter_profiles`)
- [ ] Redis flushed on cutover

**Verification:**

- [ ] Manual demo path: Recruiter A creates company X → invites Recruiter B → B accepts → B sees X's jobs → A switches to a second company Y (created via switcher) → A creates a job in Y → B can NOT see Y's jobs
- [ ] Admin path: admin lists all companies → impersonates X → audit log shows the impersonation
- [ ] Candidate path: candidate applies to a job in X → email arrives branded with X's name + logo → status update arrives the same way
- [ ] Cross-tenant negative path: attempt to fetch a job from another company by ID → 403 or 404 (consistent with existing patterns)

---

## What's deliberately deferred

These are real and worth doing, just not in this plan:

- **Stripe billing + per-seat plan tiers** — schema leaves room (e.g., `companies.plan_id` reservation), no enforcement
- **SSO (Google Workspace / Okta / Azure AD)** — Supabase Auth supports it; configuration is per-company, future work
- **White-label custom domains** — `tenant.aurahire.app` or `careers.tenant.com`
- **Per-company custom prompts** — currently the AI prompts are global with per-company _weights_; full prompt-per-company is a later iteration
- **Audit log retention policies** — admin-configurable retention; today we keep forever
- **Two-factor authentication** — UI placeholder only in Phase 5
- **Company-level API keys** — for ATS integrations; today the integrations section stubs the webhook URL only
- **Right-to-be-forgotten automation** — candidate's "Revoke this company's view" is implemented; full GDPR-style export/delete request workflow is manual/admin-driven for now

---

## How to execute this plan

Per-phase execution:

1. Read this plan in full
2. Read `docs/main/architecture.md` and `docs/main/database-schema.md` to align on existing module conventions
3. Use `superpowers:subagent-driven-development` to dispatch one subagent per task within the active phase
4. Review subagent output before proceeding
5. Halt and re-plan if any DoD checkbox in the active phase becomes false
6. Human runs all migrations, restarts servers, and flushes Redis (per `CLAUDE.md` § Hard Rules)
7. Each phase ends with a commit + short PR; phases are independent enough to ship serially

This plan replaces the original "settings page tabs" ask with the architectural foundation that makes those tabs meaningful. Once Phase 5 lands, the settings page is itself the deliverable the original ask described.
