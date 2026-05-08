# Browse Jobs Match Scores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface precomputed match-score previews on each `JobCard` shown in the candidate Browse Jobs grid, mirroring the dashboard's "Recommended for You" visual.

**Architecture:** Pure additive frontend change. `JobCard` gets two new optional props (`matchPreview`, `matchPreviewLoading`); the candidate Browse Jobs client component fetches previews via the existing `useMyMatchPreviewsQuery`, builds a `Map<jobId, preview>`, and threads each card's preview down. Stale "match scoring arrives in a future slice" subtitle is replaced with a query-aware copy.

**Tech Stack:** Next.js 16 App Router (client components), React 19, TanStack Query 5, Vitest + jsdom + @testing-library/react for unit tests. No backend changes, no new dependencies, no AI calls added.

**Spec:** `docs/superpowers/specs/2026-05-08-browse-jobs-match-scores-design.md`

---

## Pre-flight verification

Before starting Task 1, confirm the working tree is clean and the relevant files match the assumptions in this plan. If anything below is stale, stop and re-confirm with the human.

```bash
cd /Users/cjjutba/Projects/aurahire
git status                                  # expect clean (or only this plan unstaged)
grep -n "JobCard" -r apps/web --include="*.tsx" | grep -v node_modules
# Expected: matches in
#   - apps/web/components/jobs/job-card.tsx (definition)
#   - apps/web/app/(candidate)/candidate/jobs/_jobs-list-client.tsx (only consumer)
#   - apps/web/app/(candidate)/candidate/jobs/loading.tsx (skeleton, unaffected)
#   - apps/web/app/(candidate)/candidate/_dashboard-client.tsx (RecommendedJobCard — distinct symbol)
```

If a fourth consumer of `<JobCard>` exists, halt and re-evaluate before adding props.

Confirm the previews hook exists at the expected path:

```bash
test -f apps/web/hooks/use-match-previews.ts && echo OK
# Expected: OK
```

---

## Task 1: Extract band-color helpers in `job-card.tsx`

**Why first:** the score row and its tests both depend on these helpers. Extracting them as named exports up front lets the test file import them directly to assert correctness without rendering, and avoids inlining duplicate ternaries inside JSX later.

**Files:**
- Modify: `apps/web/components/jobs/job-card.tsx` (add helpers above the component)
- Create: `apps/web/components/jobs/job-card.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/components/jobs/job-card.test.tsx` with this exact content:

```tsx
import { describe, expect, it } from "vitest";

import { matchScoreColors } from "./job-card";

describe("matchScoreColors", () => {
  it("returns score-high tokens for scores >= 70", () => {
    expect(matchScoreColors(70)).toEqual({
      fill: "var(--color-score-high)",
      track: "var(--color-score-high-soft)",
    });
    expect(matchScoreColors(100)).toEqual({
      fill: "var(--color-score-high)",
      track: "var(--color-score-high-soft)",
    });
  });

  it("returns score-mid tokens for scores in [40, 70)", () => {
    expect(matchScoreColors(40)).toEqual({
      fill: "var(--color-score-mid)",
      track: "var(--color-score-mid-soft)",
    });
    expect(matchScoreColors(69)).toEqual({
      fill: "var(--color-score-mid)",
      track: "var(--color-score-mid-soft)",
    });
  });

  it("returns score-low tokens for scores below 40", () => {
    expect(matchScoreColors(0)).toEqual({
      fill: "var(--color-score-low)",
      track: "var(--color-score-low-soft)",
    });
    expect(matchScoreColors(39)).toEqual({
      fill: "var(--color-score-low)",
      track: "var(--color-score-low-soft)",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/cjjutba/Projects/aurahire/apps/web && pnpm vitest run components/jobs/job-card.test.tsx
```

Expected: FAIL — `matchScoreColors is not a function` (or `does not provide an export named 'matchScoreColors'`).

- [ ] **Step 3: Implement the helper in `job-card.tsx`**

Open `apps/web/components/jobs/job-card.tsx`. Just above the existing `interface JobCardProps {` declaration (currently at line 6), insert:

```tsx
/**
 * Map a numeric match score (0–100) to the CSS variables used to render the
 * progress bar fill + track. Mirrors the band thresholds the dashboard's
 * RecommendedJobCard uses (>= 70 → high, >= 40 → mid, else low).
 */
export function matchScoreColors(overallScore: number): {
  fill: string;
  track: string;
} {
  const ratio = overallScore / 100;
  if (ratio >= 0.7) {
    return {
      fill: "var(--color-score-high)",
      track: "var(--color-score-high-soft)",
    };
  }
  if (ratio >= 0.4) {
    return {
      fill: "var(--color-score-mid)",
      track: "var(--color-score-mid-soft)",
    };
  }
  return {
    fill: "var(--color-score-low)",
    track: "var(--color-score-low-soft)",
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/cjjutba/Projects/aurahire/apps/web && pnpm vitest run components/jobs/job-card.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Type-check and commit**

```bash
cd /Users/cjjutba/Projects/aurahire/apps/web && pnpm type-check
```

Expected: no errors.

```bash
git -C /Users/cjjutba/Projects/aurahire add \
  apps/web/components/jobs/job-card.tsx \
  apps/web/components/jobs/job-card.test.tsx
git -C /Users/cjjutba/Projects/aurahire commit -m "feat(jobs): extract matchScoreColors helper for JobCard score row"
```

---

## Task 2: Add `matchPreview` + `matchPreviewLoading` props and render the score row

**Files:**
- Modify: `apps/web/components/jobs/job-card.tsx` (extend `JobCardProps`, add score-row JSX)
- Modify: `apps/web/components/jobs/job-card.test.tsx` (append render tests)

- [ ] **Step 1: Write the failing tests**

Append the following to `apps/web/components/jobs/job-card.test.tsx`. Keep the existing `matchScoreColors` block; add this beneath it:

```tsx
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { JobCard } from "./job-card";

const baseJob = {
  id: "job-1",
  title: "Staff Backend Engineer",
  department: "Engineering",
  employmentType: "full-time",
  workMode: "remote",
  locationCity: "Manila",
  locationCountry: "Philippines",
  salaryMin: 220000,
  salaryMax: 340000,
  salaryCurrency: "PHP",
  status: "published" as const,
  publishedAt: "2026-05-01T00:00:00Z",
  company: { name: "TechCorp Inc.", logoUrl: null },
};

describe("JobCard score row", () => {
  it("renders MatchBandChip + numeric score + filled progress bar when matchPreview is present", () => {
    const { container } = render(
      <JobCard
        job={baseJob}
        href="/candidate/jobs/job-1"
        matchPreview={{ overallScore: 76, band: "strong" }}
      />,
    );

    expect(screen.getByText(/strong match/i)).toBeInTheDocument();
    expect(screen.getByText("76")).toBeInTheDocument();
    expect(screen.getByText("/ 100")).toBeInTheDocument();

    const fillBar = container.querySelector<HTMLDivElement>(
      "[data-testid='job-card-match-fill']",
    );
    expect(fillBar).not.toBeNull();
    expect(fillBar!.style.width).toBe("76%");
    expect(fillBar!.style.backgroundColor).toBe("var(--color-score-high)");
  });

  it("omits the score row entirely when no matchPreview and not loading", () => {
    const { container } = render(
      <JobCard job={baseJob} href="/candidate/jobs/job-1" />,
    );

    expect(screen.queryByText(/strong match|partial match|limited match/i)).toBeNull();
    expect(
      container.querySelector("[data-testid='job-card-match-fill']"),
    ).toBeNull();
    expect(
      container.querySelector("[data-testid='job-card-match-skeleton']"),
    ).toBeNull();
  });

  it("renders the skeleton placeholder when matchPreviewLoading and no matchPreview", () => {
    const { container } = render(
      <JobCard
        job={baseJob}
        href="/candidate/jobs/job-1"
        matchPreviewLoading
      />,
    );

    expect(
      container.querySelector("[data-testid='job-card-match-skeleton']"),
    ).not.toBeNull();
    expect(screen.queryByText(/strong match|partial match|limited match/i)).toBeNull();
  });

  it("matchPreview wins over matchPreviewLoading (no skeleton when both set)", () => {
    const { container } = render(
      <JobCard
        job={baseJob}
        href="/candidate/jobs/job-1"
        matchPreview={{ overallScore: 45, band: "partial" }}
        matchPreviewLoading
      />,
    );

    expect(screen.getByText(/partial match/i)).toBeInTheDocument();
    expect(
      container.querySelector("[data-testid='job-card-match-skeleton']"),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/cjjutba/Projects/aurahire/apps/web && pnpm vitest run components/jobs/job-card.test.tsx
```

Expected: the four new tests fail (the existing `matchScoreColors` ones still pass). The failures will be along the lines of `Property 'matchPreview' does not exist on type 'JobCardProps'` (compile error) or `Unable to find an element with the text: /strong match/i` (assertion failure).

- [ ] **Step 3: Extend `JobCardProps` and the destructuring**

In `apps/web/components/jobs/job-card.tsx`, replace the existing `JobCardProps` interface (currently at lines 6–25) with:

```tsx
interface JobCardProps {
  job: {
    id: string;
    title: string;
    department: string | null;
    employmentType: string;
    workMode: string;
    locationCity: string | null;
    locationCountry: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
    salaryCurrency: string;
    status: JobStatus;
    publishedAt: string | null;
    company: { name: string; logoUrl?: string | null };
  };
  href: string;
  showStatus?: boolean;
  applied?: boolean;
  /** Precomputed match preview for this candidate against this job. */
  matchPreview?: {
    overallScore: number;
    band: "strong" | "partial" | "limited";
  };
  /**
   * When true and `matchPreview` is absent, the score row renders a thin
   * skeleton bar so the card height stays stable while previews resolve.
   */
  matchPreviewLoading?: boolean;
}
```

In the `export function JobCard` line (currently line 27), update the destructuring:

```tsx
export function JobCard({
  job,
  href,
  showStatus,
  applied,
  matchPreview,
  matchPreviewLoading,
}: JobCardProps) {
```

- [ ] **Step 4: Add the score-row JSX**

Still in `apps/web/components/jobs/job-card.tsx`, locate the meta-chips block — the `<div className="flex flex-wrap items-center gap-1.5">` currently at line 80, which closes at the matching `</div>` (line 88). Immediately after that closing `</div>`, and **before** the footer `<div className="mt-auto space-y-1.5 border-t …` block, insert:

```tsx
      {/* Match score row — only on candidate-facing usage that passes matchPreview */}
      {matchPreview ? (
        <div className="flex items-center gap-3">
          <MatchBandChip band={matchPreview.band} />
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-[var(--radius-pill)]"
            style={{ backgroundColor: matchScoreColors(matchPreview.overallScore).track }}
          >
            <div
              data-testid="job-card-match-fill"
              className="h-full rounded-[var(--radius-pill)]"
              style={{
                width: `${matchPreview.overallScore}%`,
                backgroundColor: matchScoreColors(matchPreview.overallScore).fill,
              }}
            />
          </div>
          <span className="font-mono text-xs text-[var(--color-ink)]">
            {matchPreview.overallScore}
            <span className="text-[var(--color-muted)]"> / 100</span>
          </span>
        </div>
      ) : matchPreviewLoading ? (
        <div
          data-testid="job-card-match-skeleton"
          aria-hidden
          className="h-1.5 w-full animate-pulse rounded-[var(--radius-pill)] bg-[var(--color-surface-soft)]"
        />
      ) : null}
```

Add the `MatchBandChip` import at the top of the file. Locate the existing import block near line 1:

```tsx
import Link from "next/link";
import { MapPin, Briefcase, Building2, Check } from "lucide-react";
import type { JobStatus } from "@aurahire/shared";
import { JobStatusChip } from "./job-status-chip";
```

Append:

```tsx
import { MatchBandChip } from "@/components/score/match-band-chip";
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/cjjutba/Projects/aurahire/apps/web && pnpm vitest run components/jobs/job-card.test.tsx
```

Expected: all 7 tests pass (3 from Task 1, 4 from this task).

- [ ] **Step 6: Type-check**

```bash
cd /Users/cjjutba/Projects/aurahire/apps/web && pnpm type-check
```

Expected: no errors. (The candidate Browse Jobs client component does not yet pass the new props — that's fine because they're optional.)

- [ ] **Step 7: Commit**

```bash
git -C /Users/cjjutba/Projects/aurahire add \
  apps/web/components/jobs/job-card.tsx \
  apps/web/components/jobs/job-card.test.tsx
git -C /Users/cjjutba/Projects/aurahire commit -m "feat(jobs): JobCard renders match score row when preview present"
```

---

## Task 3: Wire `useMyMatchPreviewsQuery` into Browse Jobs and pass previews to cards

**Files:**
- Modify: `apps/web/app/(candidate)/candidate/jobs/_jobs-list-client.tsx`

- [ ] **Step 1: Add the previews query and previews-by-job-id Map**

Open `apps/web/app/(candidate)/candidate/jobs/_jobs-list-client.tsx`.

Add the import at the top of the file, alongside the existing hook imports (currently at line 8 you have `import { useCandidateJobsQuery } from "@/hooks/use-candidate-jobs";`). Add directly below it:

```tsx
import { useMyMatchPreviewsQuery } from "@/hooks/use-match-previews";
```

Inside the `CandidateJobsListClient` function, immediately after the existing line:

```tsx
  const { data, isLoading, isError } = useCandidateJobsQuery(params);
```

(currently around line 38), add:

```tsx
  const previews = useMyMatchPreviewsQuery();

  const previewsByJobId = useMemo(() => {
    const map = new Map<
      string,
      { overallScore: number; band: "strong" | "partial" | "limited" }
    >();
    for (const p of previews.data?.data ?? []) {
      map.set(p.jobId, { overallScore: p.overallScore, band: p.band });
    }
    return map;
  }, [previews.data]);
```

Add `useMemo` to the React import at the top of the file. The current imports include hooks already (e.g. `Link` from `next/link`); add or extend a React import line:

```tsx
import { useMemo } from "react";
```

Place this line near the other top-level imports (after `import Link from "next/link";`).

- [ ] **Step 2: Pass previews to each `<JobCard>`**

Locate the existing `<JobCard ... />` block inside the rows map (around lines 89–95). Replace it with:

```tsx
            {rows.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                href={`/candidate/jobs/${job.id}`}
                applied={!!appliedJobMap[job.id]}
                matchPreview={previewsByJobId.get(job.id)}
                matchPreviewLoading={previews.isLoading}
              />
            ))}
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/cjjutba/Projects/aurahire/apps/web && pnpm type-check
```

Expected: no errors.

- [ ] **Step 4: Run all jobs tests to confirm no regression**

```bash
cd /Users/cjjutba/Projects/aurahire/apps/web && pnpm vitest run components/jobs
```

Expected: all 7 tests still pass.

- [ ] **Step 5: Commit**

```bash
git -C /Users/cjjutba/Projects/aurahire add \
  apps/web/app/\(candidate\)/candidate/jobs/_jobs-list-client.tsx
git -C /Users/cjjutba/Projects/aurahire commit -m "feat(candidate): pass precomputed match previews to Browse Jobs cards"
```

---

## Task 4: Replace stale subtitle copy on Browse Jobs

**Files:**
- Modify: `apps/web/app/(candidate)/candidate/jobs/_jobs-list-client.tsx`

- [ ] **Step 1: Inspect current subtitle**

The current subtitle (line 71 region) reads:

```tsx
        <p className="mt-2 text-sm text-[var(--color-body)]">
          {isLoading
            ? "—"
            : meta.total === 0
              ? "No jobs available"
              : `${meta.total} job${meta.total === 1 ? "" : "s"} · match scoring arrives in a future slice`}
        </p>
```

- [ ] **Step 2: Replace the subtitle expression**

Replace the entire `<p>` block above with:

```tsx
        <p className="mt-2 text-sm text-[var(--color-body)]">
          {(() => {
            if (isLoading) return "—";
            if (meta.total === 0) return "No jobs available";

            const base = `${meta.total} job${meta.total === 1 ? "" : "s"}`;

            // Show the auto-scored nudge only once previews have loaded with
            // at least one match. While previews are still loading, render
            // just the count to avoid promising a feature that hasn't
            // hydrated yet.
            const previewCount = previews.data?.data?.length ?? 0;
            if (!previews.isLoading && previewCount > 0) {
              return `${base} · auto-scored against your resume`;
            }
            return base;
          })()}
        </p>
```

The IIFE keeps the subtitle as a single expression inside the `<p>` element so the surrounding JSX shape is unchanged.

- [ ] **Step 3: Type-check**

```bash
cd /Users/cjjutba/Projects/aurahire/apps/web && pnpm type-check
```

Expected: no errors.

- [ ] **Step 4: Lint**

```bash
cd /Users/cjjutba/Projects/aurahire/apps/web && pnpm lint
```

Expected: no errors. If `next lint` flags the IIFE pattern (it shouldn't — this pattern exists elsewhere in the codebase), refactor to a named local function `renderSubtitle()` defined just above the `return` of `CandidateJobsListClient`.

- [ ] **Step 5: Commit**

```bash
git -C /Users/cjjutba/Projects/aurahire add \
  apps/web/app/\(candidate\)/candidate/jobs/_jobs-list-client.tsx
git -C /Users/cjjutba/Projects/aurahire commit -m "fix(candidate): replace stale 'future slice' Browse Jobs subtitle"
```

---

## Task 5: Final verification

**Files:** none modified — this is a verification-only task.

- [ ] **Step 1: Run the full apps/web test suite**

```bash
cd /Users/cjjutba/Projects/aurahire/apps/web && pnpm test
```

Expected: all tests pass. The only test file added by this plan is `components/jobs/job-card.test.tsx`; pre-existing tests should be unaffected.

- [ ] **Step 2: Type-check across the workspace**

```bash
cd /Users/cjjutba/Projects/aurahire && pnpm -w turbo run type-check --filter=@aurahire/web
```

Expected: no errors. (If `turbo` is not installed at workspace root in your environment, fall back to `cd apps/web && pnpm type-check`.)

- [ ] **Step 3: Lint apps/web**

```bash
cd /Users/cjjutba/Projects/aurahire/apps/web && pnpm lint
```

Expected: no errors.

- [ ] **Step 4: Manual browser walkthrough (HUMAN-RUN ONLY)**

The agent does **not** run dev servers (per `CLAUDE.md` § Hard Rules). Hand off to the human with these checks:

1. Visit `http://localhost:3000/candidate/jobs` while logged in as a candidate who has uploaded a resume.
2. Confirm at least one card shows the band chip (Strong / Partial / Limited Match) + a colored progress bar + a `NN / 100` score.
3. Confirm the page subtitle reads `"… jobs · auto-scored against your resume"`.
4. As a sanity check on the loading state: open DevTools → Network → throttle to "Slow 3G", reload, and confirm the skeleton bars appear briefly before each card hydrates.
5. As a sanity check on the no-previews state: log in as a candidate without a parsed resume; the cards should render unchanged from before this slice (no chip, no bar) and the subtitle should read just `"… jobs"`.

If all five checks pass, the slice is complete.

- [ ] **Step 5: No commit needed**

This task is verification only — nothing to commit.

---

## Done

After Task 5 passes, the slice is shipped. Four commits land on `dev`:

1. `feat(jobs): extract matchScoreColors helper for JobCard score row`
2. `feat(jobs): JobCard renders match score row when preview present`
3. `feat(candidate): pass precomputed match previews to Browse Jobs cards`
4. `fix(candidate): replace stale 'future slice' Browse Jobs subtitle`

Task 5 is verification-only and adds no commit.

The candidate Browse Jobs page now visually matches the dashboard's Recommended-for-You scoring language for every job that has a precomputed preview, without burning any AI budget.
