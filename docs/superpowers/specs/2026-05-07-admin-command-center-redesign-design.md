# Admin Command Center Redesign — Design Spec

**Date:** 2026-05-07
**Status:** Draft → ready for implementation plan
**Owner:** UI/UX consistency sweep (admin portal)
**Related:** Candidate dashboard pattern (`apps/web/app/(candidate)/candidate/_dashboard-client.tsx`), recruiter dashboard pattern (`apps/web/app/(recruiter)/recruiter/_dashboard-client.tsx`)

## 1. Problem

The admin Command Center (`/admin`) is the single entry point for system administrators, but its UI/UX has drifted away from the patterns established in the candidate and recruiter portals.

Concretely, today the page renders:

- **Six cramped KPI tiles in a single row** — label-only, no icons, no descriptions, no tone color. They read like a debug console next to the candidate / recruiter tiles, which carry icons, descriptions, and score-band tone coloring.
- **A "Recent Audit Events" widget that surfaces raw action codes** like `score.match.preview.computed`, `resume.parsed`, `user.registered.candidate` rendered inside a monospace `<code>` pill. These codes are part of the engineering vocabulary; they are not legible to a human admin scanning the dashboard. The same raw codes also appear, unprocessed, in the `/admin/audit` table and audit detail sheet.
- A **Bias Flags widget** that's a plain `<ul>` of category-count rows, while the **Score Distribution widget** beside it uses bar visualizations — making the row visually inconsistent.
- **Section headers** that don't match the tiny-icon + uppercase-tracking pattern used in the candidate / recruiter dashboards.

The result is an admin portal that feels mechanically different from the rest of the platform, despite using the same color tokens and radii.

## 2. Goals

1. **Visual + interaction consistency** with the candidate and recruiter portal dashboards, achieved through reuse of the same component vocabulary (KpiTile shape, section headers, card padding/radii).
2. **Plain-English audit events** across the entire admin portal — the user sees "Job match preview computed", not `score.match.preview.computed`.
3. **No backend changes.** All humanization is a frontend presentation concern. `AdminStatsOverviewDto` shape is unchanged. No new endpoints. No DB migrations.
4. **No regressions** to existing realtime, loading, or empty-state behavior.

## 3. Non-Goals

- No new metrics or new widgets. Same data, restyled.
- No date-range filter on the admin dashboard. Admin metrics are either absolute (Total Users, Active Jobs) or already time-bounded (Apps Today, Apps This Week, Score Distribution Last 30 Days). A range filter would add UI complexity without delivering a corresponding admin workflow improvement. Re-evaluate later if a real need surfaces.
- No greeting / "Welcome back" header. The page is a system-level surface; the title `Command Center` and subhead `System health at a glance.` are the right register.
- No realtime channel changes. The existing `useRealtimeChannel(AuditEntry)` and `useRealtimeChannel(BiasFlagCreated)` invalidations stay as-is.
- No drill-down from KPI tiles. Click-to-detail behavior is reserved for the audit-event rows.

## 4. Layout

### 4.1 Page header

Unchanged in copy. Same h1 + subhead, same spacing tokens. Container max-width stays at `1280px`.

```
Command Center
System health at a glance.
```

### 4.2 KPI grid — 2 rows of 3, semantically grouped

Replace the existing single-row 6-up grid (`grid md:grid-cols-3 lg:grid-cols-6`) with two stacked sections, each rendered as a 3-up grid (`grid md:grid-cols-2 lg:grid-cols-3`). Each row gets a small section header.

**Row 1 — Footprint** (icon `BarChart3`, label `FOOTPRINT`)

| Tile           | Source field                 | Icon         | Tone    | Description              |
| -------------- | ---------------------------- | ------------ | ------- | ------------------------ |
| Total Users    | `stats.totalUsers`           | `Users`      | neutral | All-time accounts        |
| Active Jobs    | `stats.activeJobs`           | `Briefcase`  | neutral | Currently published      |
| Apps This Week | `stats.applicationsThisWeek` | `TrendingUp` | neutral | Submitted in last 7 days |

**Row 2 — Today & AI Quality** (icon `Sparkles`, label `TODAY & AI QUALITY`)

| Tile              | Source field              | Icon        | Tone      | Description           |
| ----------------- | ------------------------- | ----------- | --------- | --------------------- |
| Apps Today        | `stats.applicationsToday` | `Inbox`     | neutral   | Submitted today       |
| Avg Profile Score | `stats.avgProfileScore`   | `Sparkles`  | **score** | Across all candidates |
| Avg Match Score   | `stats.avgMatchScore`     | `BarChart3` | **score** | Last 30 days          |

The `KpiTile` shape is the canonical form already used by the candidate dashboard:

- Outer: `rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6`
- Top row: uppercase tracked label (left, `text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]`) + small icon (right, `h-4 w-4 text-[var(--color-muted)]`)
- Value: `mt-3 font-mono text-3xl font-medium`, color from tone
- Description: `mt-1 text-xs text-[var(--color-muted)]`

`tone="score"` applies the candidate dashboard color ladder:

- `value === 0` → muted
- `value < 40` → `score-low`
- `value < 70` → `score-mid`
- `value >= 70` → `score-high`

Loading state: render `—` in muted color (matches candidate behavior). The existing `<Skeleton>` rectangle can be removed in favor of the muted dash, since the layout no longer needs to reserve a precise visual height.

### 4.3 Snapshot row — 3-up below KPIs

Section header: tiny icon + uppercase label (`SNAPSHOT`), matching the candidate dashboard's "Snapshot" section.

Three cards, all sharing the same outer card style as the KPI tiles. Order: Score Distribution → Bias Flags → Recent Audit Events.

#### 4.3.1 Score Distribution (Last 30 Days)

Existing visualization is sound — preserve the per-band bar (limited / partial / strong, color-tied to score-low / mid / high). Changes are visual:

- Replace the inline `<h3>` with the small-icon + uppercase-tracking section header used elsewhere (icon `BarChart3`).
- Surface the `0 total` line as a smaller mono caption directly under the header.
- Empty state copy unchanged: `No match scores yet.`

#### 4.3.2 Bias Flags This Week

Today this is a plain row list (`category — count`). Upgrade to match the Score Distribution pattern: each category gets a horizontal bar proportional to the in-card max, plus a count on the right.

- Section header: small icon (`AlertTriangle`) + uppercase `BIAS FLAGS THIS WEEK`.
- Total caption beneath: `0 total` in mono muted.
- Empty state copy unchanged: `No flags this week.`
- Bar fill color: `var(--color-status-warning)` (consistent with the existing `chip-bias-flag` token in `DESIGN.md`).

#### 4.3.3 Recent Audit Events

Largest visual change in this redesign.

**Today's row layout (problematic):**

```
[ score.match.preview.computed ]   SYSTEM
12m ago
```

The action code dominates the row in a monospace pill; the raw string is what the user reads first.

**New row layout:**

```
[icon]  Job match preview computed             SYSTEM   12m ago
```

Concretely:

- Left: a tiny actor-type icon glyph inside a colored round plate (`h-7 w-7`) using the actor's existing `ACTOR_BG` color. Mapping: `user` → `User`, `ai` → `Sparkles`, `system` → `Cpu`. Unknown actor types fall back to `Activity`.
- Center: the **plain-English label** from `humanizeAuditAction(e.action)`, in `text-sm text-[var(--color-ink)]`.
- Right: actor-type pill (uppercase, existing styling) + relative timestamp (`12m ago`) in mono muted.

Whole row is clickable — opens the audit detail sheet (`AuditDetailSheetClient`) same as the audit table. Hover reveals the **raw action code** via `title=` attribute for engineering inspection.

Section header gets a `View all →` link to `/admin/audit`, matching the candidate dashboard's "Recent Applications" header.

Empty state copy unchanged.

### 4.4 Loading skeleton (`apps/web/app/(admin)/admin/loading.tsx`)

Adapt to the new structure:

- Title block (`h-8 w-64` + `h-5 w-96`) — unchanged
- 2 KPI rows: each renders a 3-up skeleton grid of `h-28` tiles
- Snapshot row: 3-up `h-72` cards (slightly taller than today's `h-64` to match the richer content)

## 5. Audit-action humanizer

### 5.1 Location

New file: `apps/web/lib/audit/humanize-action.ts`. Frontend-only — humanization is a presentation concern. The backend continues to write canonical action codes (the `AUDIT_ACTIONS` vocabulary in `apps/api/src/audit/audit.types.ts`).

### 5.2 API

```ts
/** Returns a plain-English label for a known audit action code.
 *  Falls back to a Title-Case-Words rendering for forward compatibility. */
export function humanizeAuditAction(action: string): string;
```

### 5.3 Lookup map (initial — covers every action emitted today)

This list reflects every `action: "..."` literal in `apps/api/src/` plus the full `AUDIT_ACTIONS` constant. Items grouped by domain.

**Identity & accounts**

| Code                              | Label                            |
| --------------------------------- | -------------------------------- |
| `user.registered.candidate`       | Candidate joined                 |
| `user.registered.recruiter`       | Recruiter joined                 |
| `user.login`                      | User signed in                   |
| `user.logout`                     | User signed out                  |
| `user.password_reset_requested`   | Password reset requested         |
| `user.password_reset`             | Password reset                   |
| `user.password_reset_forced`      | Password reset (forced by admin) |
| `user.email_verified`             | Email verified                   |
| `user.suspended`                  | User suspended                   |
| `user.reactivated`                | User reactivated                 |
| `user.deleted`                    | User deleted                     |
| `user.deleted_unverified_cleanup` | Unverified account cleaned up    |
| `user.role_changed`               | User role changed                |

**Onboarding**

| Code                                  | Label                 |
| ------------------------------------- | --------------------- |
| `user.onboarding.personal_updated`    | Personal info updated |
| `user.onboarding.preferences_updated` | Preferences updated   |
| `user.onboarding.about_updated`       | About updated         |
| `user.onboarding.company_updated`     | Company info updated  |
| `user.onboarding.completed`           | Onboarding completed  |

**Resumes**

| Code                    | Label                    |
| ----------------------- | ------------------------ |
| `resume.uploaded`       | Resume uploaded          |
| `resume.parsed`         | Resume parsed            |
| `resume.parse_failed`   | Resume parsing failed    |
| `resume.reparsed`       | Resume re-parsed         |
| `resume.reparse_failed` | Resume re-parsing failed |
| `resume.set_default`    | Default resume changed   |
| `resume.deleted`        | Resume deleted           |

**Jobs**

| Code                    | Label                          |
| ----------------------- | ------------------------------ |
| `job.created`           | Job created                    |
| `job.updated`           | Job updated                    |
| `job.published`         | Job published                  |
| `job.archived`          | Job archived                   |
| `job.archived_by_admin` | Job archived by admin          |
| `job.archived_by_cron`  | Job archived (deadline passed) |
| `job.bias_check_run`    | Bias check run on job          |

**Applications**

| Code                         | Label                            |
| ---------------------------- | -------------------------------- |
| `application.created`        | Application submitted            |
| `application.shortlisted`    | Candidate shortlisted            |
| `application.unshortlisted`  | Candidate removed from shortlist |
| `application.status_changed` | Application status changed       |
| `application.notes_updated`  | Application notes updated        |
| `application.withdrawn`      | Application withdrawn            |
| `application.email_sent`     | Candidate emailed                |

**Interviews**

| Code                         | Label                      |
| ---------------------------- | -------------------------- |
| `interview.scheduled`        | Interview scheduled        |
| `interview.feedback_updated` | Interview feedback updated |
| `interview.status_changed`   | Interview status changed   |

**Offers**

| Code              | Label           |
| ----------------- | --------------- |
| `offer.sent`      | Offer sent      |
| `offer.accepted`  | Offer accepted  |
| `offer.declined`  | Offer declined  |
| `offer.withdrawn` | Offer withdrawn |
| `offer.expired`   | Offer expired   |

**Scoring & AI**

| Code                           | Label                      |
| ------------------------------ | -------------------------- |
| `scoring_config.updated`       | Scoring weights updated    |
| `score.profile.computed`       | Profile score computed     |
| `score.match.computed`         | Match score computed       |
| `score.match.recomputed`       | Match score recomputed     |
| `score.match.preview.computed` | Job match preview computed |
| `queue.rescore_batch.enqueued` | Rescore batch enqueued     |
| `bias_flag.overridden`         | Bias flag overridden       |

**Companies & members**

| Code                                   | Label                      |
| -------------------------------------- | -------------------------- |
| `company.created`                      | Company created            |
| `company.updated`                      | Company updated            |
| `company.deleted`                      | Company deleted            |
| `company.active_switched`              | Active company switched    |
| `company_member.invited`               | Member invited             |
| `company_member.invitation_resent`     | Member invitation resent   |
| `company_member.invitation_revoked`    | Member invitation revoked  |
| `company_member.invitation_accepted`   | Member invitation accepted |
| `company_member.invitation_declined`   | Member invitation declined |
| `company_member.role_changed`          | Member role changed        |
| `company_member.removed`               | Member removed             |
| `company_member.left`                  | Member left                |
| `company_member.ownership_transferred` | Ownership transferred      |

**Notifications**

| Code                                   | Label                           |
| -------------------------------------- | ------------------------------- |
| `notifications.marked_all_read`        | Notifications marked as read    |
| `notification_preference.updated`      | Notification preference updated |
| `notification_preferences.reset`       | Notification preferences reset  |
| `notifications.digest_email_batch_run` | Notification digest sent        |
| `notifications.retention_run`          | Notification cleanup ran        |

**Cron / system**

| Code                                        | Label                                |
| ------------------------------------------- | ------------------------------------ |
| `cron.expire_offers.executed`               | Offer expiry cron ran                |
| `cron.archive_past_deadline_jobs.executed`  | Job archive cron ran                 |
| `cron.cleanup_unverified_accounts.executed` | Unverified account cleanup ran       |
| `cron.interview_reminder.executed`          | Interview reminder cron ran          |
| `cron.offer_expiry_reminder.executed`       | Offer expiry reminder cron ran       |
| `cron.interview_feedback_due.executed`      | Interview feedback reminder cron ran |
| `system.ai_scoring_failure_notified`        | AI scoring failure notified          |

### 5.4 Fallback for unknown codes

If an action code is not in the lookup map, render it as Title-Cased Words by splitting on `.` and `_`, capitalizing each token, and rejoining with single spaces. Example: `foo.bar_baz` → `Foo Bar Baz`. This guarantees that any future action emitted by the backend before the lookup map is updated still renders cleanly, never as a raw dotted string.

### 5.5 Consumers

1. **Recent Audit Events widget** (`_dashboard-client.tsx`) — primary label.
2. **Audit table** (`apps/web/app/(admin)/admin/audit/_audit-table-client.tsx`) — replaces the `<code>` pill in the `Action` cell with the humanized label. Raw code remains accessible via `title=` tooltip.
3. **Audit detail sheet** (`apps/web/app/(admin)/admin/audit/_audit-detail-sheet-client.tsx`) — the sheet header shows the humanized label as the prominent title, with the raw action code as a smaller monospace sub-line beneath, so engineers can still grep server logs by exact string.

## 6. Affected files

| File                                                              | Change                                                                                                                                                            |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/app/(admin)/admin/_dashboard-client.tsx`                | Replace `DashboardClient` body, `KpiTile` (new), `ScoreDistributionWidget`, `BiasFlagsWidget`, `RecentAuditWidget`. The existing `relativeTime` helper is reused. |
| `apps/web/app/(admin)/admin/loading.tsx`                          | Two 3-up KPI rows of `h-28`; one 3-up snapshot row of `h-72`.                                                                                                     |
| `apps/web/app/(admin)/admin/audit/_audit-table-client.tsx`        | Replace the `<code>` action cell with `humanizeAuditAction(r.action)`; preserve the raw code as the cell's `title=`.                                              |
| `apps/web/app/(admin)/admin/audit/_audit-detail-sheet-client.tsx` | Show humanized label as the sheet title; raw action code as a muted monospace sub-line.                                                                           |
| **New** `apps/web/lib/audit/humanize-action.ts`                   | The lookup map + fallback. Pure function, no imports beyond TS.                                                                                                   |

No backend changes. No `packages/shared` changes. No `packages/db` changes.

## 7. Realtime, caching, error handling

All preserved as-is:

- `useAdminStatsControllerOverviewV1({ query: { staleTime: 60_000, enabled: tokenReady } })` — same.
- `useRealtimeChannel(RealtimeEvent.AuditEntry, ...)` invalidates the overview query — same.
- `useRealtimeChannel(RealtimeEvent.BiasFlagCreated, ...)` invalidates the overview query — same.
- Failure path renders the existing `Failed to load admin overview.` line in `status-danger`.

No new error states are required — all humanization is a pure transformation over data the page already has.

## 8. Accessibility

- Each KPI tile remains a static `<div>` (no interactivity) — same as today.
- Recent Audit rows become clickable `<button>` elements (today they are non-interactive). They open the detail sheet, matching the audit-table row behavior. Each button gets an accessible label of the form `View details for ${humanizedLabel}, ${actorType}, ${relativeTime}`.
- Section headers use semantic `<h2>` (snapshot row) / `<h3>` (widget heads) for screen-reader navigation, same as candidate dashboard.
- Color is never the only carrier of meaning — the actor pill text label is always present alongside the colored plate.

## 9. Implementation order (sketch — refined in writing-plans)

1. Add `humanizeAuditAction` utility + unit-style verification in dev mode (a simple test file is optional; this is a pure function).
2. Update `_dashboard-client.tsx`: new `KpiTile` + restructured KPI grid first, verify visually, then the three widgets.
3. Update `loading.tsx` to match new shape.
4. Update audit table action cell.
5. Update audit detail sheet header.
6. Manual visual QA on `/admin`, `/admin/audit`, and audit detail sheet (human runs dev server; agent does not).

## 10. Risks & mitigations

| Risk                                                                                                                                                                                                                 | Mitigation                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adding a new `humanizeAuditAction` fork point — if backend adds a new action, frontend label is missing.                                                                                                             | Fallback Title-Casing renders cleanly even for unknown codes; new actions just appear as `Foo Bar Baz` until the map is updated. Acceptable tradeoff for not requiring API changes. |
| Widget widths shift — Recent Audit Events widget today is the rightmost narrow column; new layout puts it in a 3-up grid alongside Score Distribution and Bias Flags. Need to verify Audit list rows don't overflow. | Use `min-w-0` + `truncate` on the label text; relative timestamp is right-aligned and shrink-0. Long action labels truncate with ellipsis; full label visible in detail sheet.      |
| Realtime invalidation behavior unchanged — but visual flash if rerender pattern changes.                                                                                                                             | No data-shape changes; React Query reuses existing keys; rerenders identical to today.                                                                                              |
| `score` tone applied to absolute counts (Avg Profile Score, Avg Match Score) means an empty system shows muted `—` rather than red `0`.                                                                              | Intentional — matches the candidate dashboard rule (`value === 0` → muted). Empty system shouldn't read "low" tone.                                                                 |

## 11. Out of scope (re-stated for the implementer)

- No backend changes. Do **not** edit `apps/api/`, `packages/shared/`, or `packages/db/` for this slice.
- No new metrics or new realtime events.
- No date-range filter on the admin dashboard.
- No greeting or personalization on the page header.
- No drill-down from KPI tiles.
- No changes to `/admin/bias-monitor` or `/admin/analytics` — they're separate surfaces with their own design specs.
