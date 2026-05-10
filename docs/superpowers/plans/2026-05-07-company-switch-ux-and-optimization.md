# Company Switch — UX Overlay + Backend Optimization Plan

> **For agentic workers:** Use `superpowers:executing-plans` to work through this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make recruiter company switching feel deliberate (overlay during transition) and be measurably faster (membership cache, hover prefetch, single-roundtrip `companyStats`, parallelized PATCH + refresh).

**Architecture:** Two halves wired loosely — a frontend half in `apps/web` (overlay, lifted context state, `useTransition`, hover prefetch) and a backend half in `apps/api` (`ActiveCompanyGuard` membership cache, `companyStats` CTE consolidation). No schema changes, no API contract changes.

**Tech Stack:** Next.js 16 App Router, React 19 `useTransition`, TanStack Query (existing), NestJS, Drizzle ORM with `db.execute(sql\`...\`)`, ioredis via existing `CacheService`, Tailwind (existing tokens; no new keyframes).

**Spec:** [`docs/superpowers/specs/2026-05-07-company-switch-ux-and-optimization-design.md`](../specs/2026-05-07-company-switch-ux-and-optimization-design.md)

---

## Reference: file changes

**Create:**

- `apps/web/components/layout/company-switch-overlay.tsx`
- `apps/web/components/layout/company-switch-overlay.test.tsx`
- `apps/web/lib/dashboard-prefetch.ts`
- `apps/web/contexts/active-company-context.test.tsx` (if absent)
- `apps/api/src/common/guards/active-company.guard.spec.ts` (extend if present, else new)

**Modify:**

- `apps/web/contexts/active-company-context.tsx`
- `apps/web/components/layout/company-switcher.tsx`
- `apps/web/app/(recruiter)/layout.tsx`
- `apps/api/src/common/guards/active-company.guard.ts`
- `apps/api/src/common/guards/active-company.module.ts` (or wherever the guard's providers live; ensure CacheService is injected)
- `apps/api/src/modules/profiles/profiles.repository.ts`
- `apps/api/src/modules/applications/applications.repository.ts`

**Delete:** None.

---

## Phase 1 — Frontend UX (overlay + transition + concurrent PATCH)

User-visible win: overlay appears during the switch and stays up until the new tree renders. The switch click is no longer blocked by the PATCH roundtrip.

### Task 1.1: Build the overlay component

**Files:**

- Create: `apps/web/components/layout/company-switch-overlay.tsx`
- Create: `apps/web/components/layout/company-switch-overlay.test.tsx`

The overlay reads `isSwitching` and `pendingCompanyName` from `useActiveCompany()`. When not switching, returns null. When switching, renders a fixed-position blurred-canvas overlay with a centered card containing an AuraHire-Blue ring spinner and a `Switching to {name}…` caption.

- [ ] **Step 1: Create the overlay file**

```tsx
// apps/web/components/layout/company-switch-overlay.tsx
"use client";

import { useActiveCompany } from "@/contexts/active-company-context";

/**
 * Fixed-position overlay rendered once at the recruiter layout level.
 * Mounts whenever a company switch is in flight and stays up until the
 * SSR transition settles (driven by `isSwitching` from the context).
 *
 * Visual: white-canvas blurred backdrop + centered card with an AuraHire
 * Blue ring spinner. Echoes the design-system "Score Ring" cadence
 * (800ms rotation, primary on primary-soft track) without being a Score
 * Ring — this is a process indicator, not an evaluation surface.
 */
export function CompanySwitchOverlay() {
  const ctx = useActiveCompany();
  if (!ctx?.isSwitching) return null;

  const name = ctx.pendingCompanyName ?? "company";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(255,255,255,0.72)] backdrop-blur-sm"
    >
      <div className="flex min-w-[260px] flex-col items-center gap-4 rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-8 py-6 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
        <Spinner aria-label="Loading" />
        <p className="text-center text-sm text-[var(--color-body)]">
          Switching to{" "}
          <span className="font-semibold text-[var(--color-ink)]">{name}</span>…
        </p>
      </div>
    </div>
  );
}

function Spinner({ "aria-label": label }: { "aria-label": string }) {
  return (
    <div aria-label={label} role="img" className="relative h-10 w-10">
      <div className="absolute inset-0 rounded-full border-[3px] border-[var(--color-primary-soft)]" />
      <div
        className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[var(--color-primary)]"
        style={{ animationDuration: "0.8s" }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create the overlay test**

```tsx
// apps/web/components/layout/company-switch-overlay.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { CompanySwitchOverlay } from "./company-switch-overlay";
import { ActiveCompanyContextValue } from "@/contexts/active-company-context";

// Test harness: re-export the context to inject our own values
// (the production provider does fetches we don't want in this test).
import { ActiveCompanyContextForTesting } from "@/contexts/active-company-context";

function harness(value: Partial<ActiveCompanyContextValue>) {
  const full: ActiveCompanyContextValue = {
    activeCompanyId: null,
    activeMembership: null,
    memberships: [],
    isLoading: false,
    isSwitching: false,
    pendingCompanyName: null,
    switchCompany: async () => {},
    prefetchCompanyDashboard: () => {},
    ...value,
  };
  return (
    <ActiveCompanyContextForTesting.Provider value={full}>
      <CompanySwitchOverlay />
    </ActiveCompanyContextForTesting.Provider>
  );
}

describe("CompanySwitchOverlay", () => {
  it("returns null when not switching", () => {
    const { container } = render(harness({ isSwitching: false }));
    expect(container.firstChild).toBeNull();
  });

  it("renders the overlay with the target company name when switching", () => {
    render(
      harness({
        isSwitching: true,
        pendingCompanyName: "Test Company",
      }),
    );
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent(/switching to/i);
    expect(status).toHaveTextContent("Test Company");
  });

  it("falls back to 'company' caption if pendingCompanyName is null", () => {
    render(harness({ isSwitching: true, pendingCompanyName: null }));
    expect(screen.getByRole("status")).toHaveTextContent(
      /switching to company/i,
    );
  });

  it("spinner has aria-label='Loading'", () => {
    render(harness({ isSwitching: true, pendingCompanyName: "X" }));
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });
});
```

The test imports `ActiveCompanyContextForTesting` — we'll export the bare `Context` from the context module in Task 1.2 specifically for this test harness.

### Task 1.2: Lift switching state into the context + wire `useTransition`

**Files:**

- Modify: `apps/web/contexts/active-company-context.tsx`

Changes:

- Add `isSwitching: boolean`, `pendingCompanyName: string | null`, `prefetchCompanyDashboard: (companyId: string) => void` to `ActiveCompanyContextValue`.
- Inside the provider, hold `isSwitching` / `pendingCompanyName` in `useState`. Use React's `useTransition` and clear `isSwitching` in a `useEffect` when `isPending` flips to false.
- Rewrite `switchCompany`:
  - Early-return when `companyId === activeCompanyId`.
  - Set `pendingCompanyName` from `memberships`.
  - Set `isSwitching = true`.
  - Run `setActiveCompanyId` synchronously.
  - Kick off `setActiveCompanyOnServer` (do NOT await before starting the transition).
  - Run `queryClient.clear()`.
  - Inside `startTransition`, branch on `pathname`: if detail page, `router.push(sectionIndex)`; otherwise `router.refresh()`.
  - Await `setActiveCompanyOnServer` AFTER the transition is started, in a try/catch that rolls back `setActiveCompanyId` and clears `isSwitching` on failure (then re-throws so `CompanySwitcher.handleSelect` can surface the toast).
- Export the bare `ActiveCompanyContext` as `ActiveCompanyContextForTesting` for the overlay's test harness only.

- [ ] **Step 1: Update the context interface**

Replace the existing `ActiveCompanyContextValue` interface with:

```ts
export interface ActiveCompanyContextValue {
  activeCompanyId: string | null;
  activeMembership: Membership | null;
  memberships: Membership[];
  isLoading: boolean;
  /** True from the moment switchCompany is called until the SSR transition settles. */
  isSwitching: boolean;
  /** Display name of the company being switched TO. Null when not switching. */
  pendingCompanyName: string | null;
  switchCompany: (companyId: string) => Promise<void>;
  /** Fire warming GETs to the recruiter dashboard endpoints for `companyId`. */
  prefetchCompanyDashboard: (companyId: string) => void;
}
```

- [ ] **Step 2: Add the imports**

At the top of the file, add:

```ts
import { useTransition } from "react";
import { prefetchDashboardForCompany } from "@/lib/dashboard-prefetch";
```

- [ ] **Step 3: Rewire the provider**

Inside `ActiveCompanyProvider`, after `const activeMembership = ...`:

```ts
const [isSwitching, setIsSwitching] = useState(false);
const [pendingCompanyName, setPendingCompanyName] = useState<string | null>(
  null,
);
const [isPending, startTransition] = useTransition();

// Auto-clear when the SSR transition settles.
useEffect(() => {
  if (!isPending && isSwitching) {
    setIsSwitching(false);
    setPendingCompanyName(null);
  }
}, [isPending, isSwitching]);
```

Replace the existing `switchCompany` `useCallback` body with:

```ts
const switchCompany = useCallback(
  async (companyId: string) => {
    if (companyId === activeCompanyId) return;

    const target = memberships.find((m) => m.companyId === companyId);
    setPendingCompanyName(target?.companyName ?? null);
    setIsSwitching(true);

    // 1. Synchronous singleton update — next outgoing fetch carries the new header.
    setActiveCompanyId(companyId);

    // 2. Start PATCH (don't await yet — let it run in parallel with the transition).
    const previousCompanyId = activeCompanyId;
    const patchPromise = setActiveCompanyOnServer(companyId).catch((err) => {
      // Rollback path: restore client singleton, clear UI state, re-throw so
      // the caller's catch surfaces the toast.
      setActiveCompanyId(previousCompanyId ?? initialActiveCompanyId ?? null);
      setIsSwitching(false);
      setPendingCompanyName(null);
      throw err;
    });

    // 3. Drop cached previous-tenant client data.
    queryClient.clear();

    // 4. Trigger SSR transition. On a detail page we push to the section
    //    index (push triggers SSR; refresh would duplicate). Otherwise refresh.
    startTransition(() => {
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        const detailMatch = path.match(/^(\/recruiter\/[^/]+)\/[^/]+/);
        if (detailMatch?.[1]) {
          router.push(detailMatch[1]);
          return;
        }
      }
      router.refresh();
    });

    // 5. Await PATCH for error surfacing. The transition runs in parallel.
    await patchPromise;
  },
  [activeCompanyId, memberships, initialActiveCompanyId, queryClient, router],
);

const prefetchCompanyDashboard = useCallback((companyId: string) => {
  prefetchDashboardForCompany(companyId);
}, []);
```

Update the memoized `value`:

```ts
const value = useMemo<ActiveCompanyContextValue>(
  () => ({
    activeCompanyId,
    activeMembership,
    memberships,
    isLoading,
    isSwitching,
    pendingCompanyName,
    switchCompany,
    prefetchCompanyDashboard,
  }),
  [
    activeCompanyId,
    activeMembership,
    memberships,
    isLoading,
    isSwitching,
    pendingCompanyName,
    switchCompany,
    prefetchCompanyDashboard,
  ],
);
```

- [ ] **Step 4: Export the context for testing**

After `const ActiveCompanyContext = createContext<ActiveCompanyContextValue | null>(null);`, add:

```ts
/**
 * Test-only export. Production consumers must use `useActiveCompany()`.
 * The overlay's test harness needs a way to inject context values without
 * spinning up the full provider's auth/membership fetch.
 */
export const ActiveCompanyContextForTesting = ActiveCompanyContext;
```

### Task 1.3: Build the prefetch helper

**Files:**

- Create: `apps/web/lib/dashboard-prefetch.ts`

- [ ] **Step 1: Create the file**

```ts
// apps/web/lib/dashboard-prefetch.ts
"use client";

import { getAccessToken } from "@aurahire/shared";

const DASHBOARD_PATHS = [
  "/api/v1/applications/recruiter-stats?range=7d",
  "/api/v1/applications/recruiter-analytics",
  "/api/v1/applications/recent?limit=6",
] as const;

/**
 * Fire-and-forget GETs to the three recruiter-dashboard endpoints with
 * `X-Active-Company-Id: companyId`. Result is discarded — purpose is to
 * populate the API's Redis cache before the user actually clicks switch.
 *
 * Errors are swallowed; this is a best-effort warmer.
 */
export function prefetchDashboardForCompany(companyId: string): void {
  if (typeof window === "undefined") return;

  const token = getAccessToken();
  if (!token) return;

  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) return;

  for (const path of DASHBOARD_PATHS) {
    try {
      void fetch(`${baseUrl}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Active-Company-Id": companyId,
        },
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Cross-browser safety; some browsers throw synchronously on bad URLs.
    }
  }
}
```

### Task 1.4: Mount the overlay in the recruiter layout

**Files:**

- Modify: `apps/web/app/(recruiter)/layout.tsx`

Add a single import and mount the overlay component once. The overlay returns null when not switching, so the cost when idle is one React tree node.

- [ ] **Step 1: Locate the layout file and identify the children render site**

```bash
# Confirm the file exists
ls apps/web/app/\(recruiter\)/layout.tsx
```

- [ ] **Step 2: Add the import + mount**

Add at the top:

```ts
import { CompanySwitchOverlay } from "@/components/layout/company-switch-overlay";
```

Inside the layout JSX (anywhere inside `<ActiveCompanyProvider>` — typically as a sibling of the sidebar/main content, but BEFORE the closing provider tag):

```tsx
<ActiveCompanyProvider initialActiveCompanyId={...}>
  <CompanySwitchOverlay />
  {/* existing sidebar + main content */}
</ActiveCompanyProvider>
```

The overlay must be a descendant of the provider (it reads from `useActiveCompany`). Placement order doesn't matter for visual stacking because of `fixed inset-0 z-[60]`.

### Task 1.5: Rewire `CompanySwitcher`

**Files:**

- Modify: `apps/web/components/layout/company-switcher.tsx`

Drop the local `switching` state, read `isSwitching` from the context, and add hover prefetch handlers on each non-active dropdown row.

- [ ] **Step 1: Remove the local switching state**

Delete:

```ts
const [switching, setSwitching] = useState(false);
```

And remove the `setSwitching(true)` / `setSwitching(false)` calls inside `handleSelect`.

- [ ] **Step 2: Read switching from the context**

Change:

```ts
const { activeMembership, memberships, isLoading, switchCompany } = ctx;
```

To:

```ts
const {
  activeMembership,
  memberships,
  isLoading,
  isSwitching,
  switchCompany,
  prefetchCompanyDashboard,
} = ctx;
```

Replace `disabled={switching}` on the trigger button with `disabled={isSwitching}`.

Replace `if (switching) return;` in `handleSelect` with `if (isSwitching) return;`. Remove the `try { ... finally { setSwitching(false); }` wrapper — the context owns that lifecycle now. The body becomes:

```ts
async function handleSelect(companyId: string) {
  if (companyId === activeMembership?.companyId) return;
  if (isSwitching) return;
  try {
    await switchCompany(companyId);
  } catch (err) {
    toastApiError(err, "Failed to switch company");
  }
}
```

- [ ] **Step 3: Add hover prefetch**

Inside the component (outside the JSX), add a debounce ref:

```ts
const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const schedulePrefetch = useCallback(
  (companyId: string) => {
    if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
    prefetchTimerRef.current = setTimeout(() => {
      prefetchCompanyDashboard(companyId);
    }, 100);
  },
  [prefetchCompanyDashboard],
);

const cancelPrefetch = useCallback(() => {
  if (prefetchTimerRef.current) {
    clearTimeout(prefetchTimerRef.current);
    prefetchTimerRef.current = null;
  }
}, []);

useEffect(() => () => cancelPrefetch(), [cancelPrefetch]);
```

Make sure `useRef`, `useCallback`, and `useEffect` are in the React import.

For each non-active `DropdownMenuItem`, add the four event handlers:

```tsx
<DropdownMenuItem
  key={m.companyId}
  onClick={() => void handleSelect(m.companyId)}
  onMouseEnter={isActive ? undefined : () => schedulePrefetch(m.companyId)}
  onMouseLeave={isActive ? undefined : () => cancelPrefetch()}
  onFocus={isActive ? undefined : () => schedulePrefetch(m.companyId)}
  onBlur={isActive ? undefined : () => cancelPrefetch()}
  className="flex cursor-pointer items-center gap-2"
>
```

The active row gets no prefetch handlers (already-active = already-cached).

### Task 1.6: Verify Phase 1

- [ ] **Step 1: Type-check**

Run from repo root:

```bash
pnpm --filter @aurahire/web type-check
```

Expect zero errors.

- [ ] **Step 2: Run frontend tests**

```bash
pnpm --filter @aurahire/web test -- company-switch-overlay
```

All four overlay tests must pass.

- [ ] **Step 3: Lint**

```bash
pnpm --filter @aurahire/web lint
```

---

## Phase 2 — Backend membership cache

User-visible win: every authenticated recruiter request drops one Postgres roundtrip after the first within the 5-minute TTL. Concretely this trims ~3 DB queries from each cold dashboard refresh (3 endpoints, 3 guard hits).

### Task 2.1: Wire `CacheService` into `ActiveCompanyGuard`

**Files:**

- Modify: `apps/api/src/common/guards/active-company.guard.ts`

The guard currently injects `Reflector`, `CompanyMembersRepository`, and `DRIZZLE_CLIENT`. Add `CacheService`. Confirm `CacheModule` is exported globally (it is, per `apps/api/src/cache/cache.module.ts`) so no module wiring change is needed beyond the constructor.

- [ ] **Step 1: Import CacheService and tags**

At the top of `active-company.guard.ts`:

```ts
import { CacheService, TAGS, TTL_SECONDS } from "../../cache";
```

- [ ] **Step 2: Inject in the constructor**

```ts
constructor(
  private readonly reflector: Reflector,
  private readonly companyMembersRepo: CompanyMembersRepository,
  @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
  private readonly cacheService: CacheService,
) {}
```

- [ ] **Step 3: Cache `findActiveMembership`**

Replace the line:

```ts
const membership = await this.companyMembersRepo.findActiveMembership(
  user.id,
  companyId,
);
```

With:

```ts
const membership = await this.cacheService.getOrSet<
  Awaited<ReturnType<CompanyMembersRepository["findActiveMembership"]>>
>({
  key: `membership:${user.id}:${companyId}`,
  ttlSeconds: TTL_SECONDS.warm,
  tags: [TAGS.companyMembership(companyId), TAGS.userMemberships(user.id)],
  telemetryName: "guard:membership",
  load: () => this.companyMembersRepo.findActiveMembership(user.id, companyId),
});
```

The cached value can be `null` (no membership). `cacheService.getOrSet` stores `null` as JSON `null` and returns it on hit — that path is critical because it caches the _negative_ answer, preventing repeated DB hits for users probing companies they don't belong to.

- [ ] **Step 4: Cache the profile lookup fallback**

Replace the body of `lookupLastActiveCompanyId`:

```ts
private async lookupLastActiveCompanyId(
  userId: string,
): Promise<string | null> {
  return this.cacheService.getOrSet<string | null>({
    key: `last-active-company:${userId}`,
    ttlSeconds: TTL_SECONDS.warm,
    tags: [TAGS.userMemberships(userId)],
    telemetryName: "guard:last-active-company",
    load: async () => {
      const [row] = await this.db
        .select({ lastActiveCompanyId: profilesTable.lastActiveCompanyId })
        .from(profilesTable)
        .where(eq(profilesTable.id, userId))
        .limit(1);
      return row?.lastActiveCompanyId ?? null;
    },
  });
}
```

- [ ] **Step 5: Bust on auto-heal pointer write**

In `canActivate`, in the auto-heal branch, after the `await this.db.update(profilesTable).set({ lastActiveCompanyId: companyId })...` call, add:

```ts
await this.cacheService.bustTags([TAGS.userMemberships(user.id)]);
```

So the fresh pointer doesn't conflict with a now-stale cached null.

### Task 2.2: Bust on `setActiveCompany` profile-pointer writes

**Files:**

- Modify: `apps/api/src/modules/profiles/profiles.repository.ts`

`setActiveCompany` updates `profiles.lastActiveCompanyId`. The new profile-lookup cache uses tag `userMemberships(userId)`. We must bust that tag whenever the pointer moves, otherwise a request that arrives between the write and the next 5-minute TTL boundary reads the stale value.

- [ ] **Step 1: Find the `setActiveCompany` method**

The two write paths in `profiles.repository.ts`:

- Line ~138: writes `lastActiveCompanyId` as part of `acceptInvitation` / company creation.
- Line ~159: writes `lastActiveCompanyId` directly in `setActiveCompany`.

- [ ] **Step 2: Inject CacheService**

Add to the constructor:

```ts
import { CacheService, TAGS } from "../../cache";

constructor(
  @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
  private readonly cacheService: CacheService,
) {}
```

- [ ] **Step 3: Bust after each `lastActiveCompanyId` write**

After both write sites (the line ~138 update and the line ~159 update), add:

```ts
await this.cacheService.bustTags([TAGS.userMemberships(user.id)]);
// or, in the line-159 path where `companyId` is the only parameter and
// `userId` is implicit on the caller — confirm with the actual signature.
```

Read the current method bodies first; the exact bust call signature follows the user-id available in the local scope. If the method only takes `(userId, companyId)`, use `userId`. If it takes a profile object, use `profile.id`.

### Task 2.3: Backend tests

**Files:**

- Create / extend: `apps/api/src/common/guards/active-company.guard.spec.ts`

Cover:

- Cache hit on `membership:{userId}:{companyId}`: assert `companyMembersRepo.findActiveMembership` is NOT called.
- Cache miss: loader runs once.
- After `bustTags([companyMembership(companyId)])`, the next call hits the loader again.
- Profile-lookup cache hit: skips `db.select` on profiles.

Use the existing testing patterns in the repo's `*.spec.ts` files (NestJS `TestingModule.createTestingModule`, mock providers).

### Task 2.4: Verify Phase 2

- [ ] **Step 1: Type-check**

```bash
pnpm --filter @aurahire/api type-check
```

- [ ] **Step 2: Run guard spec**

```bash
pnpm --filter @aurahire/api test -- active-company.guard
```

- [ ] **Step 3: Lint**

```bash
pnpm --filter @aurahire/api lint
```

---

## Phase 3 — `companyStats` CTE consolidation

User-visible win: ~100ms shaved off cold dashboard load (one Postgres roundtrip instead of four).

### Task 3.1: Rewrite `companyStats` as a single CTE query

**Files:**

- Modify: `apps/api/src/modules/applications/applications.repository.ts`

- [ ] **Step 1: Locate the method**

`companyStats` is at line ~132. It currently runs four separate `db.select(...)` blocks. Replace the body (everything between the function's opening `{` and the `return` statement) with a single `db.execute` call against the CTE query in the spec.

Drizzle's `db.execute(sql\`...\`)` returns rows; the type is generic. Use a typed cast at the boundary.

- [ ] **Step 2: Implementation skeleton**

```ts
async companyStats(
  companyId: string,
  range: "7d" | "30d" | "90d" | "all",
): Promise<{
  activeJobs: number;
  totalApplications: number;
  totalApps: number;
  pendingReviews: number;
  pendingReview: number;
  inInterview: number;
  offered: number;
  hired: number;
  avgMatchScore: number;
  biasFlags: number;
}> {
  const rangeFilter = this.rangeFilter(range);

  // Single roundtrip via independent CTEs. PG planner can parallelize
  // CTE evaluation; we collapse the prior 4 sequential SELECTs into one.
  const result = await this.db.execute<{
    active_jobs: number;
    total: number;
    pending: number;
    interview: number;
    offered: number;
    hired: number;
    avg_score: number | null;
    bias_flags: number;
  }>(sql`
    WITH
      active_jobs AS (
        SELECT COUNT(*)::int AS c
        FROM ${jobsTable}
        WHERE ${jobsTable.companyId} = ${companyId}
          AND ${jobsTable.status} = 'published'
      ),
      apps_stats AS (
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE ${applicationsTable.status} = 'applied')::int AS pending,
          COUNT(*) FILTER (WHERE ${applicationsTable.status} = 'interview')::int AS interview,
          COUNT(*) FILTER (WHERE ${applicationsTable.status} = 'offer')::int AS offered,
          COUNT(*) FILTER (WHERE ${applicationsTable.status} = 'hired')::int AS hired
        FROM ${applicationsTable}
        INNER JOIN ${jobsTable} ON ${jobsTable.id} = ${applicationsTable.jobId}
        WHERE ${jobsTable.companyId} = ${companyId}
          ${rangeFilter ? sql`AND ${applicationsTable.appliedAt} >= ${rangeFilter}` : sql``}
      ),
      avg_score AS (
        SELECT AVG(${matchScoresTable.overallScore})::float AS avg_score
        FROM ${matchScoresTable}
        INNER JOIN ${jobsTable} ON ${jobsTable.id} = ${matchScoresTable.jobId}
        WHERE ${jobsTable.companyId} = ${companyId}
      ),
      bias_flags AS (
        SELECT COUNT(*)::int AS c
        FROM ${biasFlagsTable}
        INNER JOIN ${jobsTable} ON ${jobsTable.id} = ${biasFlagsTable.jobId}
        WHERE ${jobsTable.companyId} = ${companyId}
          AND ${biasFlagsTable.status} = 'flagged'
      )
    SELECT
      active_jobs.c AS active_jobs,
      apps_stats.total,
      apps_stats.pending,
      apps_stats.interview,
      apps_stats.offered,
      apps_stats.hired,
      avg_score.avg_score,
      bias_flags.c AS bias_flags
    FROM active_jobs, apps_stats, avg_score, bias_flags
  `);

  // Drizzle's execute returns { rows } for postgres-js / { rowCount, rows } for pg.
  // The project's existing pattern in applications.repository.ts (search for db.execute)
  // shows the access path — confirm and follow.
  const row = result.rows?.[0] ?? result[0];

  if (!row) {
    return {
      activeJobs: 0,
      totalApplications: 0,
      totalApps: 0,
      pendingReviews: 0,
      pendingReview: 0,
      inInterview: 0,
      offered: 0,
      hired: 0,
      avgMatchScore: 0,
      biasFlags: 0,
    };
  }

  const total = row.total ?? 0;
  const pending = row.pending ?? 0;

  return {
    activeJobs: row.active_jobs ?? 0,
    totalApplications: total,
    totalApps: total,
    pendingReviews: pending,
    pendingReview: pending,
    inInterview: row.interview ?? 0,
    offered: row.offered ?? 0,
    hired: row.hired ?? 0,
    avgMatchScore: Math.round(row.avg_score ?? 0),
    biasFlags: row.bias_flags ?? 0,
  };
}
```

The exact `result.rows` access path depends on the Drizzle driver wrapper. Search the file for an existing `db.execute` to confirm the project's pattern; mimic that exactly.

- [ ] **Step 3: Delete `countUnresolvedBiasFlagsForCompany` if no longer referenced**

That helper exists solely to feed `companyStats`. After the rewrite, run a project-wide grep:

```bash
# Use the Grep tool: pattern "countUnresolvedBiasFlagsForCompany"
```

If zero remaining references outside its own definition, delete the method.

### Task 3.2: Backend tests for `companyStats`

**Files:**

- Create / extend: `apps/api/src/modules/applications/applications.repository.spec.ts`

- [ ] **Step 1: Use the existing real-Postgres test fixture**

The repo's existing repository specs use a real Postgres test database. Follow that pattern: seed companies, jobs, applications, match scores, bias flags; call `companyStats(companyId, range)`; assert exact numbers.

- [ ] **Step 2: Cover all four ranges**

For each of `"7d"`, `"30d"`, `"90d"`, `"all"`:

- Seed apps with `appliedAt` straddling the range boundary.
- Assert `totalApplications` reflects only the in-range rows.
- Assert `activeJobs` ignores the range filter (it's published-status, not date-based).
- Assert `avgMatchScore` is unaffected by range (matches the prior implementation; can be revisited as a separate concern).

- [ ] **Step 3: Empty company**

Seed a brand-new company with zero jobs. Assert all counts are 0 and `avgMatchScore` is 0 (rounded from null).

### Task 3.3: Verify Phase 3

- [ ] **Step 1: Run repository spec**

```bash
pnpm --filter @aurahire/api test -- applications.repository
```

- [ ] **Step 2: Type-check + lint**

```bash
pnpm --filter @aurahire/api type-check
pnpm --filter @aurahire/api lint
```

---

## Phase 4 — Final integration verification

### Task 4.1: Full build verification

- [ ] **Step 1: Type-check the whole monorepo**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 2: Lint the whole monorepo**

```bash
pnpm lint
```

- [ ] **Step 3: Build verification**

```bash
turbo run build
```

(If `turbo run build` is too heavy, run `pnpm --filter @aurahire/web build` and `pnpm --filter @aurahire/api build` separately.)

### Task 4.2: Manual smoke test (human-driven; agent cannot run servers)

The agent cannot run `pnpm dev` or restart Docker containers. Hand off to the human with this checklist:

- [ ] **Step 1: Start the dev stack**

Human runs `pnpm dev` from repo root. Both Next.js (`:3000`) and NestJS (`:3333`) come up. Mailpit + Redis already running per project setup.

- [ ] **Step 2: Smoke test — overlay**

Log in as a recruiter with two memberships. Click switch from A → B in the sidebar. Verify:

- A blurred-canvas overlay appears with a centered card.
- The card shows `Switching to B…` with B's actual name.
- The spinner rotates with the AuraHire-Blue ring.
- The overlay disappears once the new dashboard renders.
- The dashboard numbers (ACTIVE JOBS / TOTAL APPLICATIONS / etc.) match B's data.

- [ ] **Step 3: Smoke test — detail-page redirect**

Switch from A → B while on `/recruiter/jobs/{some-job-id-from-A}`. Verify:

- URL changes to `/recruiter/jobs` (the section index).
- Overlay appears once (no double-render).
- Dashboard shows B's data.

- [ ] **Step 4: Smoke test — hover prefetch**

Open browser devtools Network tab. Open the company switcher dropdown, hover (don't click) a non-active row, hold for 200 ms. Verify:

- Three GETs to `/api/v1/applications/recruiter-stats`, `/recruiter-analytics`, `/recent` fire with `X-Active-Company-Id` set to the hovered company.
- Now click that row to switch. Verify the resulting switch is faster than a no-prefetch switch.

- [ ] **Step 5: Smoke test — backend cache hit**

With one terminal tailing the NestJS logs, switch back and forth between two companies a few times. Verify log lines like `[guard:membership] HIT key=membership:{userId}:{companyId}` appear after the first miss.

- [ ] **Step 6: Smoke test — Redis fail-open**

Stop the Redis container (`docker compose -f docker-compose.dev.yml stop redis`). Switch companies. Verify:

- Overlay still appears.
- Dashboard still renders (slower).
- No 500 errors.

Restart Redis. Verify cache hits resume.

---

## Out of scope (explicit)

- No schema migrations.
- No new API endpoints.
- No DTO contract changes.
- No realtime / websocket changes.
- No animation polish beyond the 800 ms spinner rotation.
- No mobile drawer-specific overlay changes (drawer inherits via the layout-level mount).
- No removal of `queryClient.clear()` in the switch flow.
- No tuning of `TTL_SECONDS.warm` — using the existing constant.
