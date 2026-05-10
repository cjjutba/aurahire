# Admin Job Moderation Visual Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `/admin/jobs` (Job Moderation) to visual + interaction parity with `/recruiter/jobs` so the three role portals share one design system, and rebuild the admin loading skeleton so it traces the final layout. Includes one tri-state backend tweak so the new "Bias = Clean" filter can express jobs with no bias flags on record.

**Architecture:** Mostly a frontend refactor of the admin jobs surface. The recruiter pattern is the visual peer (table-based) and is mirrored verbatim with admin-specific columns (Recruiter, Company, Bias). A new pill toolbar replaces the boxed Apply/Reset filter form; a new numbered pagination replaces the inline Prev/Next. The detail sheet is unchanged. The single backend change is a tri-state branch in `jobs.repository.ts` so `hasBiasFlags=false` becomes a "no flags on record" filter.

**Tech Stack:** Next.js 16 App Router (`apps/web`), React 19, TypeScript strict, Tailwind v4 with CSS-variable design tokens, Lucide icons, NestJS + Drizzle (`apps/api`).

**Spec:** `docs/superpowers/specs/2026-05-07-admin-jobs-moderation-design.md`

**Hard rules (from `CLAUDE.md`):**

- The implementer must NOT run any dev server, migration, or deploy command. Type-check and lint only.
- The user runs `pnpm dev` themselves and verifies the visual result in the browser.
- The implementer must NOT run destructive git commands. Commits are written into the plan as steps, but the executing session defers to `CLAUDE.md`'s commit policy and asks the user before committing.
- Backend tweak in Task 1 cannot be exercised end-to-end without the running stack, so it is verified by the user from the browser; the plan also calls out a pure shape-check via type-check.

**Testing posture:** This change is primarily visual. There is no precedent in `apps/api/src/modules/jobs` or `apps/api/src/modules/admin` for repository-level unit tests, and the frontend changes are pure markup/styling refactors. The plan therefore relies on:

- Per-task type-checks via `pnpm tsc --noEmit` to catch contract drift,
- Per-task lint via `pnpm lint` to catch unused imports and accessibility regressions,
- A final user-driven visual verification pass against the acceptance criteria in the spec.

---

## File Structure

| Path                                                       | Status                     | Responsibility                                                                                                                                                                    |
| ---------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------ | --- | ------------ | --- | ------------- |
| `apps/api/src/modules/jobs/jobs.repository.ts`             | **Modify** (lines 258-262) | Replace the truthy `hasBiasFlags` block with a tri-state branch.                                                                                                                  |
| `apps/web/app/(admin)/admin/jobs/_filters-client.tsx`      | **Delete**                 | Old boxed filter form with Apply/Reset. Superseded by `_jobs-toolbar-client.tsx`.                                                                                                 |
| `apps/web/app/(admin)/admin/jobs/_jobs-toolbar-client.tsx` | **Create**                 | Pill toolbar with debounced search, Status dropdown, Bias dropdown. Live-applies via `router.push` inside `startTransition`. Preserves unmanaged URL params (e.g. `recruiterId`). |
| `apps/web/app/(admin)/admin/jobs/_jobs-pagination.tsx`     | **Create**                 | Numbered pagination component routed at `/admin/jobs`, mirror of recruiter pagination.                                                                                            |
| `apps/web/app/(admin)/admin/jobs/_jobs-table-client.tsx`   | **Replace**                | Surface-soft header band, dot+label status pills, mono Bias/Apps cells, clickable-row a11y pattern that opens the existing detail sheet. Drops the embedded pagination block.     |
| `apps/web/app/(admin)/admin/jobs/page.tsx`                 | **Modify**                 | `text-3xl` → `text-2xl` h1, swap `<FiltersClient>` for `<JobsToolbarClient>`, render `<JobsPagination>` as a sibling of `<JobsTableClient>`, branch empty state on `q             |     | status |     | hasBiasFlags |     | recruiterId`. |
| `apps/web/app/(admin)/admin/jobs/loading.tsx`              | **Replace**                | Skeleton mirrors final layout: header (no CTA), toolbar pills, table grid `2fr_1fr_1fr_0.9fr_0.5fr_0.5fr_1fr_40px` with header band + 8 row skeletons.                            |

The detail sheet (`_job-detail-sheet-client.tsx`) is **not** modified.

---

## Task 1: Backend — tri-state `hasBiasFlags` filter

**Files:**

- Modify: `apps/api/src/modules/jobs/jobs.repository.ts:258-262`

The current implementation only branches on truthy `hasBiasFlags`, so the new "Bias = Clean" filter has no way to express "no flags on record". Add a `false` branch using `NOT EXISTS` against the same correlated subquery.

The Zod schema at `packages/shared/src/schemas/admin.ts:43` already accepts `z.coerce.boolean().optional()` (parses both `"true"` and `"false"` to actual booleans), so no schema change is required.

- [ ] **Step 1: Replace the truthy block with a tri-state branch**

Open `apps/api/src/modules/jobs/jobs.repository.ts` and locate the block at line 258:

```ts
if (filters.hasBiasFlags) {
  conditions.push(
    sql`EXISTS (SELECT 1 FROM ${biasFlagsTable} WHERE ${biasFlagsTable.jobId} = ${jobsTable.id})`,
  );
}
```

Replace it with:

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

Behavior:

- `undefined` → no condition added (returns the full set, unchanged).
- `true` → `EXISTS` correlated subquery (unchanged from today).
- `false` → new `NOT EXISTS` correlated subquery returns jobs with zero rows in `bias_flags`.

- [ ] **Step 2: Type-check the API workspace**

Run from the repo root:

```bash
pnpm --filter @aurahire/api tsc --noEmit
```

Expected: exit code 0, no diagnostics.

- [ ] **Step 3: Commit**

Ask the user before committing. If approved, run:

```bash
git add apps/api/src/modules/jobs/jobs.repository.ts
git commit -m "feat(api): tri-state hasBiasFlags filter for admin jobs list"
```

---

## Task 2: Create the pagination component

**Files:**

- Create: `apps/web/app/(admin)/admin/jobs/_jobs-pagination.tsx`

A near-clone of `apps/web/app/(recruiter)/recruiter/jobs/_jobs-pagination.tsx`. The only differences are the route prefix (`/admin/jobs`) and the explicit shape of the forwarded query keys (`q`, `status`, `hasBiasFlags`).

- [ ] **Step 1: Create the file**

Write the full contents of `apps/web/app/(admin)/admin/jobs/_jobs-pagination.tsx`:

```tsx
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  meta: { page: number; limit: number; total: number; totalPages: number };
  searchParams: Record<string, string | undefined>;
}

export function JobsPagination({ meta, searchParams }: Props) {
  if (meta.totalPages <= 1) return null;

  const start = (meta.page - 1) * meta.limit + 1;
  const end = Math.min(meta.page * meta.limit, meta.total);

  function hrefFor(page: number): string {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v != null && v !== "" && k !== "page") params.set(k, v);
    });
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/admin/jobs${qs ? `?${qs}` : ""}`;
  }

  const pages = pageWindow(meta.page, meta.totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <div className="text-xs text-[var(--color-muted)]">
        Showing <span className="font-mono">{start}</span>–
        <span className="font-mono">{end}</span> of{" "}
        <span className="font-mono">{meta.total}</span>
      </div>
      <div className="flex items-center gap-1">
        <PageLink
          href={hrefFor(meta.page - 1)}
          disabled={meta.page === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </PageLink>

        {pages.map((w, i) =>
          w === "..." ? (
            <span
              key={`gap-${i}`}
              className="px-2 text-sm text-[var(--color-muted)]"
            >
              …
            </span>
          ) : (
            <PageLink key={w} href={hrefFor(w)} active={w === meta.page}>
              {w}
            </PageLink>
          ),
        )}

        <PageLink
          href={hrefFor(meta.page + 1)}
          disabled={meta.page === meta.totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({
  children,
  href,
  active,
  disabled,
  ...rest
}: {
  children: React.ReactNode;
  href: string;
  active?: boolean;
  disabled?: boolean;
} & React.HTMLAttributes<HTMLElement>) {
  const className = [
    "inline-flex h-9 min-w-9 items-center justify-center rounded-[var(--radius-md)] px-2 text-sm transition",
    active
      ? "bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]"
      : "text-[var(--color-body)] hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]",
    disabled ? "pointer-events-none opacity-40" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (disabled)
    return (
      <span className={className} {...rest}>
        {children}
      </span>
    );
  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}

function pageWindow(current: number, total: number): Array<number | "..."> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | "..."> = [1];
  if (current > 4) out.push("...");
  const start = Math.max(2, current - 2);
  const end = Math.min(total - 1, current + 2);
  for (let i = start; i <= end; i++) out.push(i);
  if (current < total - 3) out.push("...");
  out.push(total);
  return out;
}
```

- [ ] **Step 2: Type-check the web workspace**

```bash
pnpm --filter @aurahire/web tsc --noEmit
```

Expected: exit code 0. (The component is referenced by no one yet, so its existence in isolation must still type-check.)

- [ ] **Step 3: Commit**

Ask the user before committing. If approved:

```bash
git add apps/web/app/\(admin\)/admin/jobs/_jobs-pagination.tsx
git commit -m "feat(web): admin jobs pagination component"
```

---

## Task 3: Create the toolbar component

**Files:**

- Create: `apps/web/app/(admin)/admin/jobs/_jobs-toolbar-client.tsx`

Pill toolbar with debounced search, Status dropdown, Bias dropdown. Live-applies via `router.push` inside `startTransition`. Mirrors the recruiter `_jobs-toolbar-client.tsx` pattern but with admin-specific options and no Sort dropdown.

- [ ] **Step 1: Create the file**

Write the full contents of `apps/web/app/(admin)/admin/jobs/_jobs-toolbar-client.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ToolbarProps {
  initialQuery: string;
  status: string;
  bias: string;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
  { value: "closed", label: "Closed" },
];

const BIAS_OPTIONS = [
  { value: "all", label: "All Bias" },
  { value: "flagged", label: "Flagged" },
  { value: "clean", label: "Clean" },
];

export function JobsToolbarClient({
  initialQuery,
  status,
  bias,
}: ToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(initialQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    setQ(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (q === initialQuery) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams({ q });
    }, 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function pushParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === "" || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    params.delete("page");
    startTransition(() => {
      const qs = params.toString();
      router.push(`/admin/jobs${qs ? `?${qs}` : ""}`);
    });
  }

  function selectStatus(value: string) {
    pushParams({ status: value });
  }

  function selectBias(value: string) {
    if (value === "flagged") pushParams({ hasBiasFlags: "true" });
    else if (value === "clean") pushParams({ hasBiasFlags: "false" });
    else pushParams({ hasBiasFlags: null });
  }

  const currentStatus =
    STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0]!;
  const currentBias =
    BIAS_OPTIONS.find((o) => o.value === bias) ?? BIAS_OPTIONS[0]!;

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      style={{ opacity: isPending ? 0.6 : 1, transition: "opacity 150ms" }}
    >
      {/* Search */}
      <div className="relative flex min-w-48 flex-1 items-center">
        <Search
          className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--color-muted)]"
          aria-hidden
        />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search jobs by title or description…"
          className="h-10 w-full rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] pl-9 pr-4 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* Status filter */}
      <FilterDropdown
        label="Status"
        current={currentStatus.label}
        options={STATUS_OPTIONS}
        onSelect={selectStatus}
      />

      {/* Bias filter */}
      <FilterDropdown
        label="Bias"
        current={currentBias.label}
        options={BIAS_OPTIONS}
        onSelect={selectBias}
      />

      {/* Spacer to mirror recruiter toolbar rhythm */}
      <div className="flex-1" />
    </div>
  );
}

function FilterDropdown({
  label,
  current,
  options,
  onSelect,
}: {
  label: string;
  current: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-3 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-hairline-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        }
      >
        <span>
          {label}: {current}
        </span>
        <ChevronDown
          className="h-3.5 w-3.5 text-[var(--color-muted)]"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom">
        {options.map((opt) => (
          <DropdownMenuItem key={opt.value} onClick={() => onSelect(opt.value)}>
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

Notes for the implementer:

- The toolbar starts every URL mutation from `new URLSearchParams(searchParams.toString())`, so any param it does not surface (today: `recruiterId`) round-trips through filter changes.
- The Bias dropdown maps three labels to two URL states: `flagged` → `hasBiasFlags=true`, `clean` → `hasBiasFlags=false`, `all` → param deleted.
- `pushParams` always deletes `page` so any filter mutation drops the user back to page 1 — same behavior as recruiter.

- [ ] **Step 2: Type-check the web workspace**

```bash
pnpm --filter @aurahire/web tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: Lint**

```bash
pnpm --filter @aurahire/web lint
```

Expected: clean (no warnings on the new file).

- [ ] **Step 4: Commit**

Ask the user before committing. If approved:

```bash
git add apps/web/app/\(admin\)/admin/jobs/_jobs-toolbar-client.tsx
git commit -m "feat(web): admin jobs pill toolbar with debounced search and dropdowns"
```

---

## Task 4: Replace `_jobs-table-client.tsx`

**Files:**

- Modify: `apps/web/app/(admin)/admin/jobs/_jobs-table-client.tsx`

Refactor the table to the recruiter-style markup: surface-soft header band, dot+label status pills, mono right-aligned Bias and Apps cells, formatted Posted, accessible row that opens the existing detail sheet. Strip the inline pagination block — pagination is rendered by the parent now.

- [ ] **Step 1: Replace the file contents**

Replace the entire file contents of `apps/web/app/(admin)/admin/jobs/_jobs-table-client.tsx` with:

```tsx
"use client";

import { useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { Eye, MoreHorizontal } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { JobDetailSheetClient } from "./_job-detail-sheet-client";

interface JobRow {
  id: string;
  title: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  recruiter: { id: string; fullName: string; email: string };
  company: { id: string; name: string };
  biasFlagsCount: number;
  applicationsCount: number;
}

interface Props {
  rows: JobRow[];
}

const JOB_STATUS: Record<string, { label: string; dot: string; text: string }> =
  {
    draft: {
      label: "Draft",
      dot: "bg-[var(--color-muted)]",
      text: "text-[var(--color-muted)]",
    },
    published: {
      label: "Published",
      dot: "bg-[var(--color-status-success)]",
      text: "text-[var(--color-status-success)]",
    },
    closed: {
      label: "Closed",
      dot: "bg-[var(--color-status-danger)]",
      text: "text-[var(--color-status-danger)]",
    },
    archived: {
      label: "Archived",
      dot: "bg-[var(--color-muted)]",
      text: "text-[var(--color-muted)]",
    },
  };

const DEFAULT_STATUS = JOB_STATUS["draft"]!;

const INTERACTIVE_SELECTOR =
  'a, button, [role="menuitem"], [role="menu"], [role="dialog"], [data-stop-row-click], input, select, textarea, label';

function formatPosted(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function JobsTableClient({ rows }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  function handleRowClick(jobId: string) {
    return (e: MouseEvent<HTMLTableRowElement>) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
        return;
      const target = e.target as HTMLElement;
      if (target.closest(INTERACTIVE_SELECTOR)) return;
      setOpenId(jobId);
    };
  }

  function handleRowKeyDown(jobId: string) {
    return (e: KeyboardEvent<HTMLTableRowElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpenId(jobId);
      }
    };
  }

  return (
    <>
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)]">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Title
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Recruiter
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Company
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Status
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Bias
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Apps
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Posted
              </th>
              <th className="w-10 px-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-hairline-soft)]">
            {rows.map((j) => {
              const status = JOB_STATUS[j.status] ?? DEFAULT_STATUS;
              return (
                <tr
                  key={j.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Open ${j.title}`}
                  onClick={handleRowClick(j.id)}
                  onKeyDown={handleRowKeyDown(j.id)}
                  className="cursor-pointer transition hover:bg-[var(--color-surface-soft)] focus:bg-[var(--color-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]"
                >
                  <td className="px-4 py-3 font-medium text-[var(--color-ink)]">
                    {j.title}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-body)]">
                    {j.recruiter.fullName}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-body)]">
                    {j.company.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${status.text}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                        aria-hidden
                      />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {j.biasFlagsCount > 0 ? (
                      <span className="text-[var(--color-score-mid)]">
                        {j.biasFlagsCount}
                      </span>
                    ) : (
                      <span className="text-[var(--color-muted-soft)]">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {j.applicationsCount > 0 ? (
                      <span className="text-[var(--color-ink)]">
                        {j.applicationsCount}
                      </span>
                    ) : (
                      <span className="text-[var(--color-muted-soft)]">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--color-muted)]">
                    {formatPosted(j.publishedAt)}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            aria-label="Job actions"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-muted)] transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                          />
                        }
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="bottom">
                        <DropdownMenuItem
                          onClick={() => setOpenId(j.id)}
                          className="flex cursor-pointer items-center gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openId && (
        <JobDetailSheetClient
          jobId={openId}
          open={!!openId}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}
```

Notes:

- The `Props` interface drops `meta` — pagination moves to the parent. The parent (`page.tsx`) will be updated in Task 5 to render `<JobsPagination>` as a sibling.
- The interactive selector mirrors `apps/web/components/ui/clickable-row.tsx:14`. Inline rather than wrapping `ClickableRow` because that component navigates via `router.push(href)`, while this row opens a state-controlled sheet.
- The actions cell uses `e.stopPropagation()` on the trigger button so a click on the kebab does not also fire the row's `onClick`.

- [ ] **Step 2: Type-check the web workspace**

```bash
pnpm --filter @aurahire/web tsc --noEmit
```

Expected: at this step, the type-check **may emit one error**: `page.tsx` still passes a `meta={...}` prop that no longer exists on `JobsTableClient`. That error is fixed in Task 5; do not fix it inline here. If any other diagnostics appear, address them before proceeding.

- [ ] **Step 3: Commit**

Ask the user before committing. If approved:

```bash
git add apps/web/app/\(admin\)/admin/jobs/_jobs-table-client.tsx
git commit -m "refactor(web): rebuild admin jobs table to match recruiter pattern"
```

---

## Task 5: Wire the new pieces into `page.tsx`

**Files:**

- Modify: `apps/web/app/(admin)/admin/jobs/page.tsx`

Step the h1 down to `text-2xl`, replace `<FiltersClient>` with `<JobsToolbarClient>`, render `<JobsPagination>` as a sibling of `<JobsTableClient>`, and branch the empty state on whether any filter param is present (`q || status || hasBiasFlags || recruiterId`).

- [ ] **Step 1: Replace the file contents**

Replace the entire file contents of `apps/web/app/(admin)/admin/jobs/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";

import { getCurrentSession } from "@/lib/auth/session";

import { JobsTableClient } from "./_jobs-table-client";
import { JobsToolbarClient } from "./_jobs-toolbar-client";
import { JobsPagination } from "./_jobs-pagination";

export const metadata = { title: "Job Moderation" };

interface PageProps {
  searchParams: Promise<{
    status?: string;
    recruiterId?: string;
    hasBiasFlags?: string;
    q?: string;
    page?: string;
  }>;
}

interface JobRow {
  id: string;
  title: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  recruiter: { id: string; fullName: string; email: string };
  company: { id: string; name: string };
  biasFlagsCount: number;
  applicationsCount: number;
}

interface ListBody {
  data: JobRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

function biasUiValue(raw: string | undefined): "all" | "flagged" | "clean" {
  if (raw === "true") return "flagged";
  if (raw === "false") return "clean";
  return "all";
}

export default async function JobsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const params = new URLSearchParams();
  if (sp.status) params.set("status", sp.status);
  if (sp.recruiterId) params.set("recruiterId", sp.recruiterId);
  if (sp.hasBiasFlags) params.set("hasBiasFlags", sp.hasBiasFlags);
  if (sp.q) params.set("q", sp.q);
  if (sp.page) params.set("page", sp.page);
  params.set("limit", "20");

  const res = await fetch(`${apiUrl}/api/v1/admin/jobs?${params.toString()}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="text-[var(--color-status-danger)]">
        Failed to load jobs.
      </div>
    );
  }
  const body = (await res.json()) as ListBody;

  const filtersActive = !!(
    sp.q ||
    sp.status ||
    sp.hasBiasFlags ||
    sp.recruiterId
  );

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <header>
        <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
          Job Moderation
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          {body.meta.total === 0
            ? "No jobs to moderate yet"
            : `${body.meta.total} job${body.meta.total === 1 ? "" : "s"}`}
        </p>
      </header>

      <JobsToolbarClient
        initialQuery={sp.q ?? ""}
        status={sp.status ?? "all"}
        bias={biasUiValue(sp.hasBiasFlags)}
      />

      {body.data.length === 0 ? (
        filtersActive ? (
          <EmptyFiltered />
        ) : (
          <EmptyJobs />
        )
      ) : (
        <>
          <JobsTableClient rows={body.data} />
          <JobsPagination
            meta={body.meta}
            searchParams={{
              q: sp.q,
              status: sp.status,
              hasBiasFlags: sp.hasBiasFlags,
              recruiterId: sp.recruiterId,
            }}
          />
        </>
      )}
    </div>
  );
}

function EmptyJobs() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No jobs to moderate yet
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        Recruiter-published jobs appear here once they&rsquo;re live.
      </div>
    </div>
  );
}

function EmptyFiltered() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No jobs match your filters
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        Try different search terms or clear the filters.
      </div>
      <Link
        href="/admin/jobs"
        className="mt-4 inline-flex h-9 items-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]"
      >
        Clear filters
      </Link>
    </div>
  );
}
```

Notes:

- `hasBiasFlags` is forwarded to the backend as the literal `sp.hasBiasFlags` string (`"true"` / `"false"`) — Zod's `z.coerce.boolean()` parses both. The previous code only forwarded the param when it equalled `"true"`; that branch is no longer correct because the new "Clean" filter sends `"false"`.
- `recruiterId` is now part of the `filtersActive` check so deep links from elsewhere in the admin portal (e.g., a future "see this recruiter's jobs" link) display the filtered empty state instead of the bare "No jobs to moderate yet" copy.
- The wrapper `mx-auto max-w-[1280px] space-y-6` is unchanged from the previous implementation.

- [ ] **Step 2: Type-check the web workspace**

```bash
pnpm --filter @aurahire/web tsc --noEmit
```

Expected: exit code 0. The Task 4 type-error (the missing `meta` prop) is now resolved because `page.tsx` no longer passes it.

- [ ] **Step 3: Lint**

```bash
pnpm --filter @aurahire/web lint
```

Expected: clean.

- [ ] **Step 4: Commit**

Ask the user before committing. If approved:

```bash
git add apps/web/app/\(admin\)/admin/jobs/page.tsx
git commit -m "feat(web): wire admin jobs page to new toolbar and pagination"
```

---

## Task 6: Delete the old filters component

**Files:**

- Delete: `apps/web/app/(admin)/admin/jobs/_filters-client.tsx`

`page.tsx` no longer imports `FiltersClient`; nothing else does either.

- [ ] **Step 1: Confirm there are no remaining importers**

Run:

```bash
grep -rn "_filters-client" apps/web/app/\(admin\)/ || true
grep -rn "from \"./\\_filters-client\"" apps/web/ || true
grep -rn "FiltersClient" apps/web/app/\(admin\)/admin/jobs/ || true
```

Expected: no matches outside `_filters-client.tsx` itself. If anything else imports it, stop and investigate.

- [ ] **Step 2: Delete the file**

```bash
rm apps/web/app/\(admin\)/admin/jobs/_filters-client.tsx
```

- [ ] **Step 3: Type-check + lint**

```bash
pnpm --filter @aurahire/web tsc --noEmit && pnpm --filter @aurahire/web lint
```

Expected: clean.

- [ ] **Step 4: Commit**

Ask the user before committing. If approved:

```bash
git add -u apps/web/app/\(admin\)/admin/jobs/_filters-client.tsx
git commit -m "chore(web): remove obsolete admin jobs FiltersClient"
```

---

## Task 7: Rebuild the loading skeleton

**Files:**

- Modify: `apps/web/app/(admin)/admin/jobs/loading.tsx`

Replace the three-block placeholder with a layout that traces the final markup. Use the same column hint grid as the table (`2fr_1fr_1fr_0.9fr_0.5fr_0.5fr_1fr_40px`) so the column widths animate into the real data without a layout shift.

- [ ] **Step 1: Replace the file contents**

Replace the entire file contents of `apps/web/app/(admin)/admin/jobs/loading.tsx` with:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      {/* Header: title + count, no CTA */}
      <header>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-16" />
      </header>

      {/* Toolbar pills: search + 2 filter dropdowns + spacer */}
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
  );
}
```

- [ ] **Step 2: Type-check + lint**

```bash
pnpm --filter @aurahire/web tsc --noEmit && pnpm --filter @aurahire/web lint
```

Expected: clean.

- [ ] **Step 3: Commit**

Ask the user before committing. If approved:

```bash
git add apps/web/app/\(admin\)/admin/jobs/loading.tsx
git commit -m "feat(web): admin jobs loading skeleton matches final layout"
```

---

## Task 8: Final verification

**Files:**

- Read-only across the touched paths.

A consolidated check before handing back to the user.

- [ ] **Step 1: Full repo type-check**

```bash
pnpm tsc --noEmit
```

Expected: exit code 0 across both workspaces.

- [ ] **Step 2: Full repo lint**

```bash
pnpm lint
```

Expected: clean.

- [ ] **Step 3: Build verification (web only)**

```bash
pnpm --filter @aurahire/web build
```

Expected: exit code 0. (This is allowed by `CLAUDE.md` — it's a build, not a server.)

- [ ] **Step 4: Hand off to the user for visual + behavioral verification**

Hand the user this checklist (matches the spec's acceptance criteria, with the exact paths to navigate). Tell them you cannot run the dev server yourself and ask them to start it (`pnpm dev`) and confirm:

1. Navigate to `/admin/jobs`. The h1 reads "Job Moderation" at the same visual weight as `/recruiter/jobs`'s "My Jobs" (text-2xl). The subtext reads `{N} jobs` or `No jobs to moderate yet`.
2. The filter row is a single pill toolbar — search pill on the left with a magnifying-glass icon, then `Status: All Statuses` dropdown, then `Bias: All Bias` dropdown, then empty space. There is no Apply or Reset button.
3. Type into the search pill — the URL updates to include `?q=...` after ~300 ms and the page transitions with a 0.6 opacity fade.
4. Open the Status dropdown — it lists `All Statuses · Draft · Published · Archived · Closed`. Picking one updates the URL and the table.
5. Open the Bias dropdown — it lists `All Bias · Flagged · Clean`. Picking `Flagged` filters to jobs with `biasFlagsCount > 0`. Picking `Clean` filters to jobs with `biasFlagsCount === 0`. Picking `All Bias` clears the filter.
6. The table header row uses a soft-gray background band; column labels are uppercase. Each row reveals a `surface-soft` hover tint.
7. Status pills render as a colored dot followed by a label (`Published` = green, `Draft` / `Archived` = muted, `Closed` = danger). The pills use a soft-gray surface, not the previous green-soft chip.
8. Bias and Apps numbers render in JetBrains Mono and right-aligned. Zeros render in `muted-soft`; non-zero bias counts render in `score-mid` (amber).
9. The Posted column shows short dates like `May 7, 2026`, or `—` when not yet published.
10. Pagination renders only when there are 2+ pages. The control shows `Showing X–Y of Z`, a numbered window with primary-soft active state, and chevron prev/next that disable on the boundaries.
11. Clicking anywhere on a row that is not the kebab opens the existing detail sheet. Pressing Tab, then Enter or Space on a focused row, opens the sheet.
12. With dev tools throttling enabled, refresh `/admin/jobs`. The skeleton matches the final layout: header (title + count, no right-side button), pill toolbar (search + 2 dropdowns), table (header band + 8 rows). The columns line up so there is no layout jump on hydration.
13. Apply a filter that returns no rows — the empty state reads `No jobs match your filters` with a `Clear filters` link that navigates back to `/admin/jobs`.

If any of these fail, the user reports the regression and the implementer re-opens the relevant task.

---

## Self-Review

After writing this plan, the spec was checked section by section:

- §1 Why this change → covered narratively, not a task.
- §2 Scope summary → covered by the file structure table and tasks 1–7.
- §3 Page header → Task 5.
- §4 Toolbar → Task 3 (creates), Task 5 (wires), Task 6 (deletes the old `FiltersClient`).
- §5 Table → Task 4.
- §6 Pagination → Task 2.
- §7 Empty states → Task 5.
- §8 Loading skeleton → Task 7.
- §9 Backend tri-state filter → Task 1.
- §10 Acceptance criteria → Task 8 step 4.
- §11 File-by-file change list → matches the File Structure table.
- §12 Risks and edge cases → the _Bias = Clean_ SQL semantics are noted in Task 1; the inline a11y rationale is noted in Task 4.

Placeholder scan: no TBDs or TODOs. Every code step contains the actual code.

Type consistency: the `JobsTableClient` `Props` shape changes between Task 4 (drops `meta`) and Task 5 (page no longer passes it). The plan calls this out explicitly so the type-check window between Task 4 and Task 5 is expected.
