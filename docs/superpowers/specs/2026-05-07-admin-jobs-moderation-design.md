# Admin Job Moderation - Visual Parity with Recruiter Jobs

**Date:** 2026-05-07
**Surface:** `/admin/jobs` (Job Moderation)
**Goal:** Bring the Admin Job Moderation page in line with the visual language and interaction patterns of `/recruiter/jobs` so the three role portals share one design system. Update the loading skeleton to match the final layout.

---

## 1. Why this change

Today the admin moderation list reads as a different generation of UI than the recruiter list:

- A boxed, label-above filter card with explicit `Apply` / `Reset` buttons.
- A bare table with no surface-soft header band and no dot-style status pills.
- Plain `← Prev / Next →` link pagination.
- A skeleton that does not resemble the rendered layout.

The recruiter jobs page (`apps/web/app/(recruiter)/recruiter/jobs/_jobs-list-client.tsx`) already implements the platform pattern: pill-shaped toolbar with debounced search and inline filter dropdowns, surface-soft table header, dot+label status pills, numbered pagination, and a skeleton aligned to the same grid as the rendered table. Both surfaces are table-based, so admin should adopt the recruiter pattern verbatim - adapted to the admin's columns and signals (recruiter, company, bias count).

Out of scope: the detail sheet (`_job-detail-sheet-client.tsx`) is already styled and functional.

---

## 2. Scope summary

| Area         | Action                                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Header       | Step `h1` from `text-3xl` to `text-2xl` (recruiter rhythm); same flex layout, no right-side CTA.                                                                                                 |
| Filters      | Replace `_filters-client.tsx` with `_jobs-toolbar-client.tsx` matching recruiter toolbar (pill row, dropdowns, debounced search, no Apply button).                                               |
| Table        | Refactor `_jobs-table-client.tsx` - surface-soft header band, dot+label status pills, mono numbers with conditional muted-soft, clickable-row a11y pattern that opens the existing detail sheet. |
| Pagination   | New `_jobs-pagination.tsx` - copy of recruiter pattern, route prefix `/admin/jobs`.                                                                                                              |
| Skeleton     | Rebuild `loading.tsx` to mirror the final layout (header, toolbar pills, table header band + grid rows).                                                                                         |
| Backend      | One small tri-state tweak in `jobs.repository.ts` so the Bias filter can express _Clean_ (no flags) in addition to _Flagged_.                                                                    |
| Out of scope | Detail sheet, archive flow, sort (no backend support).                                                                                                                                           |

---

## 3. Page header (`apps/web/app/(admin)/admin/jobs/page.tsx`)

- Wrapper: `mx-auto max-w-[1280px] space-y-6` (unchanged).
- Header: `flex items-start justify-between gap-4`.
  - Left: `<h1 class="text-2xl font-normal tracking-tight text-[var(--color-ink)]">Job Moderation</h1>` plus `<p class="mt-2 text-sm text-[var(--color-body)]">{N} job{s}</p>` (or `No jobs to moderate yet` when total is zero).
  - Right: empty (admin does not create jobs).
- Server-side fetch unchanged in semantics. The toolbar takes over query-param ownership.

The page reads `searchParams` and forwards them as `initialFilters` to the toolbar. It still renders `JobsTableClient` plus the new `JobsPagination`. The empty-state block (lines 80-88 today) is replaced by the two new components below.

---

## 4. Toolbar - `_jobs-toolbar-client.tsx` (new)

Replaces `_filters-client.tsx` (delete it after the new toolbar is wired in).

### Behavior

- Pill row: `flex flex-wrap items-center gap-2`, with `style={{ opacity: isPending ? 0.6 : 1 }}` while transitions are pending.
- Search input: pill, `h-10 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] pl-9 pr-4 text-sm`. Lucide `Search` icon at `left-3`. Debounced 300 ms - pushes `q` (or removes it if empty) and resets `page`.
- Filter dropdowns implemented with the same `FilterDropdown` shape recruiter uses (`DropdownMenu` + `DropdownMenuTrigger` rendering a pill with `bg-surface-strong` and chevron):
  - **Status**: All Statuses · Draft · Published · Archived · Closed.
  - **Bias**: All Bias · Flagged · Clean.
- Spacer `flex-1` after the filter pills (no Sort dropdown - backend has no `sort` param; adding one is explicitly out of scope).
- Filter changes immediately push the new query string and call `router.push(...)` inside `startTransition` - no Apply / Reset buttons. The `Reset` affordance lives on the empty-state CTA when filters are active.
- The toolbar starts from `new URLSearchParams(searchParams.toString())` on every mutation so query keys it does not surface in the UI (e.g. `recruiterId`, used for deep-link filtering by recruiter) round-trip untouched.

### Mapping URL → state

The toolbar receives `initialFilters` from the page and reads/writes the same query keys the backend already accepts:

| UI value                                                       | URL param                                                                              |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Search                                                         | `q`                                                                                    |
| Status (`all` / `draft` / `published` / `archived` / `closed`) | `status` (omitted when `all`)                                                          |
| Bias (`all` / `flagged` / `clean`)                             | `hasBiasFlags=true` for _flagged_, `hasBiasFlags=false` for _clean_, omitted for _all_ |
| Page (any change in filters)                                   | `page` deleted on every filter mutation                                                |

The Zod schema (`packages/shared/src/schemas/admin.ts:40` - `listAdminJobsQuerySchema`) already accepts `hasBiasFlags` as `z.coerce.boolean().optional()`. No schema change is required.

### Files

- **New:** `apps/web/app/(admin)/admin/jobs/_jobs-toolbar-client.tsx`.
- **Delete:** `apps/web/app/(admin)/admin/jobs/_filters-client.tsx` (no other consumers).
- **Edit:** `apps/web/app/(admin)/admin/jobs/page.tsx` - replace `<FiltersClient />` with `<JobsToolbarClient initialFilters={...} />` and forward `hasBiasFlags` (string `"true"` / `"false"` / undefined) plus the existing `status` and `q`.

---

## 5. Table - `_jobs-table-client.tsx` (refactor)

### Container

- `overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]`.
- `<table class="w-full text-sm">`.

### Header band

`<thead><tr class="border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)]">` with each `<th>` styled `px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]`. Right-align Bias and Apps headers with `text-right`.

Columns and approximate widths (used for the skeleton grid as well):

| #   | Column    | Width hint | Alignment |
| --- | --------- | ---------- | --------- |
| 1   | Title     | 2fr        | left      |
| 2   | Recruiter | 1fr        | left      |
| 3   | Company   | 1fr        | left      |
| 4   | Status    | 0.9fr      | left      |
| 5   | Bias      | 0.5fr      | right     |
| 6   | Apps      | 0.5fr      | right     |
| 7   | Posted    | 1fr        | left      |
| 8   | Actions   | 40px       | right     |

### Body rows

`<tbody class="divide-y divide-[var(--color-hairline-soft)]">`. Each row mirrors `ClickableRow`'s a11y semantics inline (since the row opens a sheet, not navigates):

- `<tr role="link" tabIndex={0} aria-label="Open {title}"`.
- `onClick`: ignore modified clicks (`metaKey`, `ctrlKey`, `shiftKey`, `altKey`, non-primary button) and any click whose target matches the interactive selector `'a, button, [role="menuitem"], [role="menu"], [role="dialog"], [data-stop-row-click], input, select, textarea, label'`. Otherwise call `setOpenId(j.id)`.
- `onKeyDown`: when `e.target === e.currentTarget` and key is Enter or Space, prevent default and `setOpenId(j.id)`.
- Class: `cursor-pointer transition hover:bg-[var(--color-surface-soft)] focus:bg-[var(--color-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]`.

### Cell styling

- **Title**: `px-4 py-3 font-medium text-[var(--color-ink)]`. No internal `<Link>` (sheet, not a route).
- **Recruiter / Company**: `px-4 py-3 text-[var(--color-body)]`.
- **Status pill** (`px-4 py-3`): `<span class="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider {text}"><span class="h-1.5 w-1.5 rounded-full {dot}" aria-hidden />{label}</span>`. Variant map:
  - `draft` → dot `bg-[var(--color-muted)]`, text `text-[var(--color-muted)]`, label `Draft`.
  - `published` → dot `bg-[var(--color-status-success)]`, text `text-[var(--color-status-success)]`, label `Published`.
  - `closed` → dot `bg-[var(--color-status-danger)]`, text `text-[var(--color-status-danger)]`, label `Closed`.
  - `archived` → dot `bg-[var(--color-muted)]`, text `text-[var(--color-muted)]`, label `Archived`.
- **Bias** (`px-4 py-3 text-right font-mono text-sm`): when `biasFlagsCount > 0` the value renders in `text-[var(--color-score-mid)]`; when `0` it renders as `0` in `text-[var(--color-muted-soft)]`. (Renders the number only - no icon - to keep the column dense; flag detail lives in the sheet.)
- **Apps** (`px-4 py-3 text-right font-mono text-sm`): `text-[var(--color-ink)]` when `> 0`, `text-[var(--color-muted-soft)]` when `0`.
- **Posted** (`px-4 py-3 text-[var(--color-muted)] text-sm`): formatted via `new Date(publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })`. When `publishedAt` is null, render `<span class="text-[var(--color-muted)]">-</span>`.
- **Actions** (`px-2 py-3 text-right`): unchanged DropdownMenu containing `View Details`. Archive remains inside the sheet.

### Drop the inline pagination from this file

The current implementation embeds pagination at the bottom of `JobsTableClient`. Move that responsibility entirely into the new `_jobs-pagination.tsx` and let `page.tsx` render the table and pagination as siblings.

---

## 6. Pagination - `_jobs-pagination.tsx` (new)

Mirror `apps/web/app/(recruiter)/recruiter/jobs/_jobs-pagination.tsx` - same component skeleton (`JobsPagination`, `PageLink`, `pageWindow`) - with two route differences:

- `hrefFor(page)` builds links against `/admin/jobs` instead of `/recruiter/jobs`.
- The component's `searchParams` prop forwards admin-specific keys: `q`, `status`, `hasBiasFlags`.

Visual contract:

- Wrapper: `flex flex-wrap items-center justify-between gap-3 pt-2`.
- Left text: `Showing <mono>{start}</mono>-<mono>{end}</mono> of <mono>{total}</mono>` in `text-xs text-[var(--color-muted)]`.
- Right cluster: chevron prev, numbered links, chevron next. Active page uses `bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]`. Disabled pages render as `<span>` with `pointer-events-none opacity-40`.
- `pageWindow` rule (unchanged from recruiter): show all pages when `total <= 7`, otherwise `[1, "...", current ± 2, "...", total]` with the ellipses elided when adjacent.

Returns `null` when `meta.totalPages <= 1`.

---

## 7. Empty states

Both states live in `_jobs-table-client.tsx` (or a new `_jobs-empty-states.tsx` if the table file gets too long; either is acceptable, follow whichever keeps the file under ~250 lines). Recommended copy:

- **`EmptyJobs`** (no jobs at all):
  - Headline: `No jobs to moderate yet`.
  - Body: `Recruiter-published jobs appear here once they're live.`
  - No CTA.
- **`EmptyFiltered`** (filters active, zero results):
  - Headline: `No jobs match your filters`.
  - Body: `Try different search terms or clear the filters.`
  - CTA: `Clear filters` link → `/admin/jobs`. Style as the recruiter `EmptyFiltered` link (`h-9 rounded-pill border-hairline px-4 text-sm text-ink hover:bg-surface-soft`).

`page.tsx` chooses between them based on whether any filter param is present (`q || status || hasBiasFlags || recruiterId`).

---

## 8. Loading skeleton - `loading.tsx` (rebuild)

Replace the current three-block placeholder with a layout that traces the final markup. Use the same column hint grid as the table (`grid-cols-[2fr_1fr_1fr_0.9fr_0.5fr_0.5fr_1fr_40px]`) so column widths animate into the real data without a layout shift.

```tsx
<div className="mx-auto max-w-[1280px] space-y-6">
  {/* Header */}
  <header>
    <Skeleton className="h-8 w-48" />
    <Skeleton className="mt-2 h-4 w-16" />
  </header>

  {/* Toolbar pills */}
  <div className="flex flex-wrap items-center gap-2">
    <Skeleton className="h-10 min-w-48 flex-1 rounded-[var(--radius-pill)]" />
    <Skeleton className="h-10 w-40 rounded-[var(--radius-pill)]" />
    <Skeleton className="h-10 w-36 rounded-[var(--radius-pill)]" />
    <div className="flex-1" />
  </div>

  {/* Table */}
  <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
    {/* Header band */}
    <div className="grid grid-cols-[2fr_1fr_1fr_0.9fr_0.5fr_0.5fr_1fr_40px] gap-4 border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-4 py-3">
      <Skeleton className="h-3 w-12" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-3 w-14" />
      <Skeleton className="ml-auto h-3 w-10" />
      <Skeleton className="ml-auto h-3 w-10" />
      <Skeleton className="h-3 w-14" />
      <span />
    </div>
    {/* Rows */}
    <div className="divide-y divide-[var(--color-hairline-soft)]">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[2fr_1fr_1fr_0.9fr_0.5fr_0.5fr_1fr_40px] items-center gap-4 px-4 py-3"
        >
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-20 rounded-[var(--radius-pill)]" />
          <Skeleton className="ml-auto h-4 w-6" />
          <Skeleton className="ml-auto h-4 w-6" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="ml-auto h-6 w-6 rounded-full" />
        </div>
      ))}
    </div>
  </div>
</div>
```

---

## 9. Backend - tri-state Bias filter

`apps/api/src/modules/jobs/jobs.repository.ts:258` currently treats `hasBiasFlags` as a truthy gate:

```ts
if (filters.hasBiasFlags) {
  conditions.push(
    sql`EXISTS (SELECT 1 FROM ${biasFlagsTable} WHERE ${biasFlagsTable.jobId} = ${jobsTable.id})`,
  );
}
```

That cannot express _Clean_ (jobs with no flags). Update to:

```ts
if (filters.hasBiasFlags === true) {
  conditions.push(
    sql`EXISTS (SELECT 1 FROM ${biasFlagsTable} WHERE ${biasFlagsTable.jobId} = ${jobsTable.id})`,
  );
} else if (filters.hasBiasFlags === false) {
  conditions.push(
    sql`NOT EXISTS (SELECT 1 FROM ${biasFlagsTable} WHERE ${biasFlagsTable.jobId} = ${jobsTable.id})`,
  );
}
```

Recruiter callers that don't pass `hasBiasFlags` are unaffected (the condition block is skipped). The Zod schema accepts both values already.

This is the only backend change required.

---

## 10. Acceptance criteria

- `/admin/jobs` header reads as a peer to `/recruiter/jobs` (same `text-2xl` h1 weight, same subtext rhythm).
- The filter row is a single pill toolbar with debounced search, two filter dropdowns (Status, Bias), and no Apply / Reset buttons.
- Selecting Bias = _Flagged_ returns only jobs with at least one row in `bias_flags`; _Clean_ returns only jobs with zero. _All Bias_ returns the full set.
- Status pills render as dot+label in `bg-surface-strong`; the `Published` pill uses `status-success` (green dot + green text), not the previous `score-high-soft` green chip.
- Bias and Apps cells render in JetBrains Mono, right-aligned, with `muted-soft` zeros and `score-mid` non-zero bias counts.
- Posted column renders short dates (`May 7, 2026`) or `-` when not yet published.
- Pagination renders the recruiter-style numbered control with primary-soft active state.
- Hovering a row tints to `surface-soft`; clicking the row (anywhere except the actions menu and any link/button inside) opens the existing detail sheet. Tab focus shows a primary inset ring; Enter / Space activate.
- `loading.tsx` renders a skeleton whose column widths align with the final table grid so there is no layout jump on hydration.

---

## 11. File-by-file change list

| Path                                                       | Change                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/app/(admin)/admin/jobs/page.tsx`                 | Header `text-3xl` → `text-2xl`. Replace `<FiltersClient />` with `<JobsToolbarClient />`. Move pagination out of the table client; render `<JobsPagination />` as a sibling of `<JobsTableClient />`. Switch the empty-state block to render `EmptyFiltered` when filters are active and `EmptyJobs` otherwise. |
| `apps/web/app/(admin)/admin/jobs/_filters-client.tsx`      | **Delete** (no other importers).                                                                                                                                                                                                                                                                                |
| `apps/web/app/(admin)/admin/jobs/_jobs-toolbar-client.tsx` | **New.** Pill row with debounced search, Status dropdown, Bias dropdown. Live-apply via `router.push` inside `startTransition`.                                                                                                                                                                                 |
| `apps/web/app/(admin)/admin/jobs/_jobs-table-client.tsx`   | Refactor: `overflow-hidden` container, surface-soft header band, accessible row pattern with onClick → `setOpenId`, dot+label status pills, mono Bias and Apps cells, formatted Posted, drop the inline pagination block.                                                                                       |
| `apps/web/app/(admin)/admin/jobs/_jobs-pagination.tsx`     | **New.** Copy of recruiter pagination, route prefix `/admin/jobs`.                                                                                                                                                                                                                                              |
| `apps/web/app/(admin)/admin/jobs/loading.tsx`              | Rebuild to mirror header + toolbar + table grid layout.                                                                                                                                                                                                                                                         |
| `apps/api/src/modules/jobs/jobs.repository.ts`             | Tri-state `hasBiasFlags` block (`true` → EXISTS, `false` → NOT EXISTS).                                                                                                                                                                                                                                         |

---

## 12. Risks and edge cases

- **A11y of clickable rows.** The row already toggles a sheet via `onClick`. Keeping that behavior while inheriting the recruiter `ClickableRow` a11y pattern requires inlining the selector check; a thin reused helper is optional but the inline path is fine and matches what other admin tables do.
- **Bias = Clean correctness.** The new SQL `NOT EXISTS` returns rows that have never had a flag _or_ whose flags were resolved/overridden - `bias_flags` rows are not deleted on resolve. The list copy (`Clean`) means "no flags on record". If product later wants "Clean = no active flags", swap the predicate to `NOT EXISTS (... AND status = 'flagged')`. Acceptable for the current sprint; flag in the implementation plan.
- **No sort param.** The recruiter toolbar exposes a Sort dropdown; the admin one intentionally does not. If product later asks for sort-by-newest / sort-by-most-flagged, that's a separate slice that touches `listAdminJobsQuerySchema`, the service, and the repo.
- **Status copy parity.** Recruiter uses `Published` in `status-success`; admin previously used `PUBLISHED` in `score-high-soft`. The change makes the moderation status semantically correct (lifecycle state, not a score band) - one of the explicit DESIGN.md rules.
