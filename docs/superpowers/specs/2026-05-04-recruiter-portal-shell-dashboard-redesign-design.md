# Recruiter Portal - Shell + Dashboard Redesign (AutoSend-Inspired)

**Date:** 2026-05-04
**Scope:** Layout shell (`PortalShell` / `PortalSidebar` / `PortalTopbar`) + the recruiter `Dashboard` page (`/recruiter`).
**Visual reference:** AutoSend dashboard captures (Mobbin, May 2026) - the all-white shell, sidebar-led identity, no topbar, dense inline metric strips.

---

## Goals

1. Adopt AutoSend's **all-white, no-topbar** shell pattern: sidebar carries brand + workspace identity + nav + user, content area carries only page work. No breadcrumb, no avatar dropdown at top, no notification bell.
2. Keep AuraHire's brand discipline intact: AuraHire Blue stays scarce (active nav state, primary CTAs only), JetBrains Mono on every number, score-band colors only inside scores, no new accents introduced.
3. Rebuild the Dashboard page with three dense sections - Active Jobs, Pipeline Analytics, Recent Applications - replacing the current four-tile + recent-list layout.
4. Establish the page-header pattern (H1 + sub + right-aligned action) that the other five recruiter pages will adopt in slice 2.
5. No regressions on auth, mobile drawer behavior, or accessibility.

## Non-Goals (explicit, defer to a later slice)

- The other five recruiter pages: Jobs, Shortlist, Interviews, Analytics, Settings. Their _shell_ updates automatically; their _page contents_ do not change in this slice.
- Candidate and admin portals. Same shell components, but applying the same redesign there is a separate slice.
- Multi-tenant tenant-switching behavior. The tenant chip is geometric only - clicking it is a no-op for now.
- Detail pages (e.g., `/recruiter/jobs/[id]`). They currently rely on the breadcrumb for back-navigation; replacing that with a leading `← Back to …` link is deferred to slice 2.
- A new global `/recruiter/applications` index page. The "View all →" link in section 5 routes to the existing route segment; if that page is currently a placeholder, we will not build the full list view in this slice (link can route to `/recruiter/jobs` as a fallback).

---

## Files In Scope

| Path                                                                              | Change                                                                                                                            |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/components/layout/portal-shell.tsx`                                     | Drop `<PortalTopbar>`. Drop `<PortalFooter>` (or move into sidebar bottom). Background flips from `surface-soft` to `canvas`.     |
| `apps/web/components/layout/portal-sidebar.tsx`                                   | Major restructure: brand wordmark, tenant chip, sectioned nav, sticky bottom (Docs + user chip dropdown). Drop right-edge border. |
| `apps/web/components/layout/portal-topbar.tsx`                                    | **Delete.** Sign-out / user-info functionality migrates into the sidebar's bottom user chip dropdown.                             |
| `apps/web/components/layout/portal-footer.tsx`                                    | **Delete.** AutoSend has no marketing-style footer in the portal.                                                                 |
| `apps/web/components/layout/breadcrumb.tsx`                                       | **Delete** (or stop importing). Page H1 replaces it.                                                                              |
| `apps/web/app/(recruiter)/recruiter/page.tsx`                                     | Full rewrite: 3-section dashboard (Active Jobs / Pipeline Analytics / Recent Applications).                                       |
| `apps/web/app/(recruiter)/recruiter/_dashboard-client.tsx` _(new)_                | Client component for the date-range filter on Pipeline Analytics.                                                                 |
| `apps/api/src/modules/jobs/jobs.controller.ts` (+ service / repo)                 | Extend `GET /api/v1/jobs/mine` with `?include=stats` returning per-job aggregates in one query.                                   |
| `apps/api/src/modules/applications/applications.controller.ts` (+ service / repo) | Extend `GET /api/v1/applications/recruiter-stats` with `?range=7d                                                                 | 30d | 90d | all` + add 4 more metrics (`inInterview`, `offered`, `hired`, `biasFlags`). Add new `GET /api/v1/applications/recent?limit=6`. |
| `packages/shared/src/api-client/generated.ts` (+ openapi.json)                    | Regenerated from updated OpenAPI spec.                                                                                            |

---

## Section 1 - Sidebar

**Container:** 256px width on `lg:` and up; mobile drawer (existing `<Sheet>` pattern preserved). Background `--color-canvas` (white). **No right-edge border** - sidebar dissolves into the same-color content area; cards inside content carry the visual structure.

**Top-down stack:**

1. **Brand wordmark.** "AuraHire" in `title-sm` (16px / 600), `--color-ink`. 24px padding (`spacing.lg`) on all sides of the top block. Mirrors AutoSend's "AUTOSEND" mark.

2. **Tenant chip.** Inline row, no pill bg:
   - 32px circular avatar with company initials (e.g., "TC") on `--color-surface-strong` bg, `--color-ink` text, `caption-strong`.
   - Company name (e.g., "TechCorp Inc.") in `body-md` / 500 / `--color-ink`.
   - Trailing `chevrons-up-down` icon (Lucide), 16px, `--color-muted`.
   - Click target is a button but currently a no-op (geometric placeholder for future tenant-switching). Cursor stays `default` if no-op, `pointer` once functional.
   - Data source: the recruiter's `companies.name` from the existing JWT-authenticated session/profile. No new endpoint needed.

3. **Section labels + nav items.** Three sections, each with a label row followed by its items.
   - **Section labels:** `MAIN` / `PIPELINE` / `ACCOUNT` in `caption-strong` (12px / 600 / 0.04em uppercase, `--color-muted`). 16px top padding within section, 8px bottom padding to first nav item. No leading colored bars (preserves AuraHire's monochrome-with-blue-accent rule).
   - **Nav items:** 36px height, 12px horizontal padding, 12px gap between icon and label. 18px Lucide icon + 14px / 500 label.
     - **Default:** `--color-body` text, transparent bg.
     - **Hover:** `--color-surface-strong` bg, `--color-ink` text.
     - **Active:** `--color-primary-soft` bg + `--color-primary` text + 600 weight + same-color icon. (Preserved from current - borrowing AutoSend's _density_, not its grayscale active state.)
   - **Section content:**
     - `MAIN`: Dashboard (`LayoutDashboard` icon, `/recruiter`)
     - `PIPELINE`: Jobs (`Briefcase`, `/recruiter/jobs`) · Shortlist (`Star`, `/recruiter/shortlist`) · Interviews (`Calendar`, `/recruiter/interviews`)
     - `ACCOUNT`: Analytics (`BarChart3`, `/recruiter/analytics`) · Settings (`Settings`, `/recruiter/settings`)

4. **Spacer** - `flex-1` to push the bottom block to the bottom edge of the sidebar.

5. **Bottom block** (sticky to bottom of sidebar, 16px padding, top hairline `--color-hairline-soft`):
   - **Docs link:** 36px row, leading `BookOpen` icon (18px) + label "Docs" (14px / 500) + trailing `↗` (`ExternalLink`, 14px, muted). Routes to `/help` (placeholder route - page may not exist yet; that is acceptable for this slice).
   - **User chip:** 36px row, leading 32px avatar (initials on `--color-surface-strong`) + name "Maya Patel" (`body-md` / 500, truncated with ellipsis) + trailing `chevrons-up-down` icon. Click opens a `<DropdownMenu>` anchored upward (the existing portal-topbar dropdown logic, relocated):
     - Header label: full name + email (current pattern preserved).
     - Separator.
     - Destructive item: `Sign out` with `LogOut` icon - calls `supabase.auth.signOut()` exactly as the topbar does today, including the `setSessionOnlyMarker(false)` call.

**Mobile drawer:** the same content tree renders inside `<SheetContent side="left" className="w-72 …">`. The bottom block becomes flex-pushed within the sheet too. The mobile entry point (the hamburger button) was inside `PortalTopbar`; with the topbar deleted, it relocates to a 44×44 floating button in the top-left of `<main>` shown only on `< lg` viewports.

---

## Section 2 - Page header pattern

The topbar (`<PortalTopbar>`) is deleted. Each page's first DOM element is its own header row.

**Header row** (top of every page, applied to Dashboard now and to the other five pages in slice 2):

- **Left:** H1.
  - Existing pages use `text-3xl` (~30px). New scale: **24px / 400 / -0.4px** (`title-lg` retuned). Smaller fits portal density better; matches AutoSend's page-header scale.
  - Color `--color-ink`. Inter (not Inter Display - portal context, not marketing display).
- **Sub-headline:** immediately below H1, 8px gap. `body-sm` (14px / 400, `--color-body`). Optional - pages without one (e.g., simple list pages) skip this.
- **Right side, baseline-aligned to H1:** optional primary action - pill button (`+ New Job` on Jobs page) or pill-with-chevron menu (e.g., `Export ▾` later). 44px height. The Dashboard page has **no top-right action** (its actions are inside section cards).

**Spacing rules:**

- 32px from window/sidebar edge to H1 (`px-8 py-8` on `<main>` - replacing current `px-6 py-8`).
- 32px from header block to first content section.
- 32px between content sections (`spacing.portal-section` token).

**Content max-width:** drop the page-level `max-w-[1280px]` cap on the dashboard. Content fills available width up to `max-w-[1440px]` naturally - AutoSend's metric strips stretch nearly edge-to-edge inside the content area, which is what gives the dense, enterprise feel. Apply via `<main>` outer container.

**Mobile hamburger:** 44×44 button, top-left, `lg:hidden`. Opens the same `<Sheet>` drawer as before.

---

## Section 3 - Dashboard / Active Jobs

**Section header** (above the card list):

- Leading 14px `Briefcase` icon (`--color-muted`).
- Label `ACTIVE JOBS` in `caption-strong` (12px / 600 / 0.04em uppercase, `--color-muted`).
- Right-aligned link: `View all jobs →` in `--color-primary` (`body-sm`, no underline, hover underlines). Routes to `/recruiter/jobs`.
- 16px gap to first card.

**Card list:** top 5 of the recruiter's published jobs, ordered by most recent application activity (server-side ordering via the new `?include=stats` endpoint).

**Card** - one per job:

- **Container:** white bg (`--color-canvas`), 1px `--color-hairline` border, 16px radius (`--radius-lg`), 24px padding (`spacing.lg`). Hover: border becomes `--color-primary-soft`. Click navigates to `/recruiter/jobs/[id]`.
- **Top row:** status pill + posted date.
  - Status pill: leading 8px colored dot + label in `caption-strong` (uppercase). DESIGN.md mandates lifecycle states use `--color-status-*` tokens, not scoring colors. Mappings:
    - `PUBLISHED` → `--color-status-success` dot + text, on `--color-surface-strong` neutral bg.
    - `DRAFT` → `--color-muted` dot + text, on `--color-surface-strong` bg.
    - `CLOSED` → `--color-status-danger` dot + text, on `--color-surface-strong` bg.
  - **Note for implementation:** DESIGN.md describes "soft background paired with status color text," but soft variants of `--color-status-*` are not defined in `globals.css` today. Two options for the implementation plan: (a) introduce `--color-status-{success,warning,danger,info}-soft` tokens in `globals.css`, then use them as pill bg; or (b) keep the neutral `--color-surface-strong` bg (above) and lean on the colored leading dot + colored text for status signal. Option (b) is the lower-risk path for this slice.
  - Dot separator (•) muted.
  - Posted date: `Posted Mar 12, 2026` (`caption` / `--color-muted`).
  - 3-dot more menu (`MoreHorizontal` icon) top-right of the card, opens dropdown with `View` / `Edit` / `Unpublish` items. **Items are wired to no-op handlers in this slice** (functional implementations are slice 2 / 3 work).
- **Title:** job title in `title-md` (18px / 600 / `--color-ink`). 12px top margin.
- **Subtitle:** metadata row in `body-sm` (`--color-body`):
  - `<location-mode> · <employment-type> · <salary-min>-<salary-max> <currency>`
  - Salary numbers in JetBrains Mono (`number-display` size override to 14px to fit body line).
- **Inline metric strip:** 16px below subtitle, with a 1px `--color-hairline-soft` divider above the strip.
  - 7 evenly-spaced columns (`grid grid-cols-7 gap-4`).
  - **Columns:** `CANDIDATES` · `NEW` · `SHORTLISTED` · `INTERVIEWED` · `OFFERED` · `HIRED` · `AVG SCORE`.
  - **Each cell:**
    - Top: label in `caption-strong` (12px / 600 / 0.04em uppercase, `--color-muted`).
    - Bottom: value in JetBrains Mono `number-display` (18px / 500 / `--color-ink`). 4px gap from label.
  - **`AVG SCORE` value color:** band-colored - `< 40` `--color-score-low`, `40-69` `--color-score-mid`, `>= 70` `--color-score-high`. Only place the score-band colors appear in this section.

**Empty state:** if the recruiter has zero jobs, replace the card list with a single centered card (same container styling, 64px vertical padding):

- Muted Briefcase icon (24px).
- "No active jobs" (`body-md` / 500 / `--color-ink`).
- "Post your first opening to start collecting candidates." (`caption` / `--color-muted`).
- Primary pill CTA: `+ Create your first job` linking to `/recruiter/jobs/new`.

---

## Section 4 - Dashboard / Pipeline Analytics

**Section header:**

- Leading 14px `BarChart3` icon (`--color-muted`).
- Label `PIPELINE ANALYTICS` in `caption-strong` uppercase muted.
- (No right-aligned link; the bottom-of-card CTA serves that role.)
- 16px gap to card.

**Card** - single card containing the date filter + 8-cell metric grid + bottom CTA:

- **Container:** white bg, 1px `--color-hairline` border, 16px radius, 24px padding.
- **Top row** (inside card, 16px bottom margin):
  - **Left:** subtitle "Where every candidate sits in your pipeline right now." (`body-sm` / `--color-muted`).
  - **Right:** date-range selector pill - `--color-surface-strong` bg, `--radius-pill`, 14px / 500 label "Last 7 days", trailing `ChevronDown` icon (14px). Click opens `<DropdownMenu>` with options: `Last 7 days` (default), `Last 30 days`, `Last 90 days`, `All time`. Selecting an option re-fetches the metrics with the corresponding `?range=` query param.

- **Metric grid:**
  - 2 rows × 4 columns (`grid grid-cols-4 gap-x-4 gap-y-4`).
  - 1px `--color-hairline-soft` divider between row 1 and row 2 (CSS `border-bottom` on row 1's row container, with `pb-4 mb-4` for breathing room).
  - **No vertical dividers** between columns (matches AutoSend).
  - **Row 1 (operational):** `ACTIVE JOBS` · `TOTAL APPS` · `PENDING REVIEW` · `IN INTERVIEW`.
  - **Row 2 (outcome):** `OFFERED` · `HIRED` · `AVG MATCH SCORE` · `BIAS FLAGS`.
  - **Each cell:**
    - Top row (label):
      - 8px circular leading status dot (color rules below).
      - Label in `caption-strong` uppercase muted.
      - Trailing `Info` icon (`info-icon`, 12px, `--color-muted`) inside a tooltip wrapper. Hover/focus reveals a `<Tooltip>` with one-sentence explanation of the metric.
    - Bottom (value): JetBrains Mono `number-display` (18px / 500, `--color-ink`). 4px gap below label.
  - **Status dot color rules:**
    - `ACTIVE JOBS`, `TOTAL APPS`, `OFFERED`: neutral muted dot (`--color-muted`).
    - `PENDING REVIEW`: amber (`--color-score-mid`) when value > 0, otherwise muted.
    - `IN INTERVIEW`: info-blue (`--color-status-info` / `--color-primary`).
    - `HIRED`: success-green (`--color-score-high`).
    - `BIAS FLAGS`: amber when value > 0, otherwise muted (zero is a neutral state, not a positive one).
    - `AVG MATCH SCORE`: score-band-colored per the value's band (low / mid / high).

- **Bottom CTA** (inside card, hairline above, 16px top padding):
  - 1px `--color-hairline-soft` horizontal divider spanning the card width (with -24px horizontal margin to bleed past the card padding, AutoSend pattern).
  - Centered link: `View applications →` in `--color-primary` `body-sm` / 500. Routes to `/recruiter/applications` (or fallback `/recruiter/jobs` if the index page does not exist yet - see Non-Goals).

**Tooltip copy** (one sentence per metric, written terse):

- `ACTIVE JOBS`: "Jobs currently published and accepting applications."
- `TOTAL APPS`: "Applications received in the selected range, across all your jobs."
- `PENDING REVIEW`: "Applications still in `applied` status - not yet screened."
- `IN INTERVIEW`: "Candidates scheduled for or completed interviews."
- `OFFERED`: "Candidates with an active offer extended."
- `HIRED`: "Candidates whose application reached `hired` status."
- `AVG MATCH SCORE`: "Mean of overall match scores across all your applications, 0-100."
- `BIAS FLAGS`: "Job descriptions flagged by the bias detector that you have not resolved."

---

## Section 5 - Dashboard / Recent Applications

**Section header:**

- Leading 14px `Inbox` icon (`--color-muted`).
- Label `RECENT APPLICATIONS` in `caption-strong` uppercase muted.
- Right-aligned link: `View all →` in `--color-primary` (`body-sm`). Routes to `/recruiter/applications` (with the same fallback noted above).
- 16px gap to card.

**Card:** single card wrapping the row list - white bg, 1px `--color-hairline` border, 16px radius, 0 padding (rows handle internal padding).

**Row** - last 6 applications across all of this recruiter's owned jobs, ordered by `appliedAt DESC`:

- 56px min height, 16px horizontal + 12px vertical padding. `--color-hairline-soft` divider between rows (none on last row). Hover: bg `--color-surface-soft`. Click: navigates to `/recruiter/applications/[id]`.
- **Layout (left → right, vertically centered, `flex items-center gap-4`):**
  1. **Status pill** - leading 8px colored dot + uppercase label in `caption-strong`, pill geometry (`--radius-pill`, 4px vertical / 8px horizontal padding). Per DESIGN.md, application lifecycle states use `--color-status-*` tokens, not scoring colors. Mappings (using the same Option (b) approach from section 3 - neutral bg, colored dot + text):
     - `APPLIED`: `--color-status-info` dot + text.
     - `SCREENING`: `--color-status-info` dot + text.
     - `INTERVIEW`: `--color-status-info` dot + text.
     - `OFFER`: `--color-status-success` dot + text.
     - `HIRED`: `--color-status-success` dot + text.
     - `REJECTED`: `--color-status-danger` dot + text.
     - `WITHDRAWN`: `--color-muted` dot + text.
     - All on `--color-surface-strong` bg.
     - **Note:** the existing dashboard code (`STATUS_COLOR` map in `apps/web/app/(recruiter)/recruiter/page.tsx`) currently mixes score and status tokens (e.g., uses `--color-score-mid` for `screening`, `--color-score-high` for `offer`/`hired`). Implementation must replace that map with the DESIGN.md-compliant mapping above.
  2. **Avatar:** 32px circle, candidate initials, `--color-surface-strong` bg, `--color-ink` text, `caption-strong`.
  3. **Two-line text block** (flex-1, allows truncation):
     - Line 1: candidate full name in `body-md` (16px / 500 / `--color-ink`).
     - Line 2: "Applied to **\<job title\>**" in `caption` (`--color-muted`), with the job title bolded (`font-semibold`).
  4. **Right side** (push to far right, vertically centered, `flex items-center gap-3`):
     - Match score: `78/100` in JetBrains Mono `body-sm`, value colored by score band, `/100` always muted. (Format: `<value>` colored + `/100` muted, both in mono.)
     - Applied date: `5/4/2026` (locale-formatted) in `caption` muted.

**Empty state:** centered inside the card, 48px vertical padding:

- Muted `Inbox` icon (24px).
- "No applications yet" (`body-md` / 500 / `--color-ink`).
- "Once candidates apply to your jobs, they'll appear here." (`caption` / `--color-muted`).

---

## Backend Changes

### 1. Extend `GET /api/v1/jobs/mine` with `?include=stats`

**Module:** `apps/api/src/modules/jobs/`.

**New query param:** `include` - comma-separated values, currently supports `stats`. Other values are ignored (forward-compat).

**Response shape addition** (when `include=stats` present):

```ts
type JobWithStats = Job & {
  stats: {
    candidates: number; // total apps for this job
    new: number; // applied
    shortlisted: number; // shortlisted
    interviewed: number; // interview
    offered: number; // offer
    hired: number; // hired
    avgScore: number; // round(avg(match_scores.overall_score)), 0 if no apps
  };
};
```

**Implementation:** single Drizzle query with `LEFT JOIN applications ON job_id` + `LEFT JOIN match_scores ON application_id`, grouped by job, aggregated with `COUNT(CASE WHEN status = 'applied' THEN 1 END)` etc. and `AVG(match_scores.overall_score)`. **Avoids the N+1 the current dashboard suffers** (5 sequential `by-job/[id]` calls + manual flatten/sort).

**Ordering:** add `?order=recent-activity` (default for the dashboard call) - orders by `MAX(applications.applied_at)` descending. Existing default ordering (created_at desc) preserved when param absent.

**Result limit:** existing `?limit=` param unchanged.

### 2. Extend `GET /api/v1/applications/recruiter-stats` with `?range`

**Module:** `apps/api/src/modules/applications/`.

**New query param:** `range` - one of `7d` | `30d` | `90d` | `all`. Default `7d` if absent (preserves current dashboard which reads "this week").

**Response shape change:**

```ts
type RecruiterStats = {
  activeJobs: number; // existing
  totalApps: number; // renamed from totalApplications (field rename - handle both during transition)
  pendingReview: number; // renamed from pendingReviews
  inInterview: number; // NEW
  offered: number; // NEW
  hired: number; // NEW
  avgMatchScore: number; // existing
  biasFlags: number; // NEW - count of unresolved bias_detection rows on this recruiter's jobs
};
```

**Backwards-compat note:** existing field names `totalApplications` / `pendingReviews` are used by the current dashboard. To avoid a flag-day, return **both** the old and new field names from the API for one release (e.g., `totalApps` and `totalApplications` aliasing the same value). Drop the old names in a follow-up commit once all callers are migrated. Mark the old fields as deprecated in the OpenAPI spec.

**Implementation:** single query against `applications` joined with `jobs` filtered by `jobs.recruiter_id = current_user.id` and `applications.applied_at` filtered by the selected range. `biasFlags` joins `bias_detection` table filtered by `resolved = false`.

### 3. New `GET /api/v1/applications/recent`

**Module:** `apps/api/src/modules/applications/`.

**Query params:** `limit` (default 6, max 20).

**Response shape:**

```ts
type RecentApplication = {
  id: string;
  status: ApplicationStatus;
  appliedAt: string; // ISO 8601
  candidate: { fullName: string; email: string } | null;
  job: { id: string; title: string } | null;
  matchScore: { band: "low" | "mid" | "high"; overallScore: number } | null;
};
```

Same shape as the existing manually-flattened result on the dashboard - just moved server-side.

**Implementation:** single query, `applications` joined with `jobs` filtered by `jobs.recruiter_id = current_user.id`, `LEFT JOIN candidates`, `LEFT JOIN match_scores`, ordered by `applied_at DESC`, limited.

### 4. Regenerate API client

After the backend changes ship, regenerate `packages/shared/openapi.json` and `packages/shared/src/api-client/generated.ts` via the existing codegen script. The dashboard page consumes only the regenerated client - no hand-written `fetch()` calls.

---

## Auth, Permissions, Audit

- All three new/extended endpoints stay under `@UseGuards(SupabaseAuthGuard, RolesGuard)` with `@Roles('recruiter')`.
- Filtering by `recruiter_id = current_user.id` is enforced at the SQL layer in every query - RLS continues to apply as the third defense layer.
- No `audit_logs` writes for read-only endpoints (consistent with existing pattern).

---

## Testing & Verification

**Unit / integration:**

- New repo methods get integration tests against the seeded DB (existing pattern under `apps/api/test/`).
- Range filter (`7d` / `30d` / `90d` / `all`) verified against fixture data with applications spanning multiple time windows.
- N+1 fix verified by query-count assertion (the new `?include=stats` issues 1 query, not N+1).

**Manual / visual (human-run, since Claude does not run dev servers per `CLAUDE.md` § Hard Rules):**

- Sign in as the seeded recruiter (`recruiter@gmail.com`). Verify the sidebar renders with the company chip, sectioned nav, and bottom user chip.
- Verify the topbar is gone, no breadcrumb, no avatar dropdown at the top of `<main>`.
- Verify the three dashboard sections render with the correct data, status pill colors, score-band colors, and JetBrains Mono numbers.
- Verify the date range selector on Pipeline Analytics actually changes values when switching ranges.
- Verify the mobile hamburger button opens the drawer with the same content tree, including the bottom user chip and Sign out flow.
- Verify Sign out from the new bottom user chip dropdown still calls `supabase.auth.signOut()` and clears the session-only marker.

**Accessibility:**

- The user chip dropdown trigger remains a `<button>` with proper `aria-haspopup` / `aria-expanded` (preserved from the relocated topbar logic).
- All interactive nav items keep `focus-visible` rings using `--color-primary`.
- Tooltips on metric cells must be keyboard-accessible (focus on the `Info` icon should reveal them, not just hover).

---

## Open Decisions Carried Into Implementation

- **Docs link target:** `/help` is the placeholder. If a help page does not exist, the link still renders - clicking it 404s gracefully via Next.js's default 404. Acceptable for this slice; revisit when help content lands.
- **`/recruiter/applications` index:** if the route segment exists but only renders a placeholder, the "View all →" link will route there anyway. The actual list page is not in this slice's scope.
- **Field renames in `recruiter-stats` response:** if the only consumer is this dashboard, we can rename without aliasing. Verify call-sites during implementation; if anything else reads the old field names, ship aliases and deprecate.
- **Status-pill soft-bg tokens:** DESIGN.md describes status pills as "soft bg + status color text," but `--color-status-*-soft` tokens are not defined in `globals.css`. The spec defaults to neutral-bg pills (Option (b)) for this slice. If the implementation wants the soft-bg variant, it must add four new tokens (`--color-status-success-soft`, `--color-status-warning-soft`, `--color-status-danger-soft`, `--color-status-info-soft`) and document them in DESIGN.md. Treat this as a small but real design-system extension, not a quiet token addition.

---

## Slice Boundary

This slice ships **shell + dashboard only**. The other five recruiter pages (Jobs, Shortlist, Interviews, Analytics, Settings) inherit the new shell automatically (since they share `<PortalShell>`) but their page contents stay as they are today. Slice 2 will:

1. Apply the same page-header pattern (24px H1 + sub + right-aligned action) consistently across all five pages.
2. Replace the breadcrumb-style navigation on detail pages (`/recruiter/jobs/[id]`, `/recruiter/applications/[id]`) with a leading `← Back to …` link.
3. Reflow the Jobs / Shortlist / Interviews / Analytics list views to the AutoSend density patterns (leading status pills, inline metric strips where applicable).

Candidate and admin portals (slices 3+) reuse the same `<PortalSidebar>` + `<PortalShell>` with role-specific nav items and tenant chip content (candidate: AuraHire wordmark + "My Workspace" or candidate name; admin: AuraHire wordmark + "Admin Console").
