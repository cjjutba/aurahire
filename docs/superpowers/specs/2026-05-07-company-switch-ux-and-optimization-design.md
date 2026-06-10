# Company Switch - UX Overlay + Backend Optimization

**Date:** 2026-05-07
**Owner:** Recruiter portal multi-tenant switch flow
**Status:** approved (option: lift-state + useTransition for the UX fix; option: per-(user, company) Redis cache for membership; option: companyStats CTE consolidation; option: hover prefetch with 100ms debounce; option: parallelize PATCH with router.refresh + skip refresh on detail-page redirect)
**Related:**

- [Recruiter Portal Shell + Dashboard Redesign](./2026-05-04-recruiter-portal-shell-dashboard-redesign-design.md) - introduces the `CompanySwitcher` component this spec rewires.
- [Redis Caching Strategy](../plans/2026-05-05-redis-caching-strategy.md) - defines the `TAGS.companyMembership` / `TAGS.userMemberships` infrastructure this spec leans on.

## Problem

Switching companies in the recruiter sidebar feels broken:

1. **No loading feedback.** `CompanySwitcher` keeps its `switching` flag local, sets it to `true` before `setActiveCompanyOnServer`, and clears it as soon as the PATCH resolves. The dropdown closes; the page continues to show the _previous_ company's dashboard for several hundred milliseconds while `router.refresh()` fan-outs to three backend endpoints under the hood. The recruiter sees a frozen-looking dashboard with no spinner. They cannot tell whether the click registered.
2. **The switch is sequential when it does not need to be.** The current flow runs (a) `await setActiveCompanyOnServer` then (b) `queryClient.clear()` then (c) `router.refresh()` strictly in series. The PATCH only matters for SSR / fallback paths - the client already has the new company id from `setActiveCompanyId(companyId)` in step (a-pre). One full round-trip is wasted.
3. **`router.refresh()` is fire-and-forget.** It returns no promise, so even if we wanted to keep the spinner alive until the next paint, we have no completion signal. React's `useTransition` is the documented hook for this exact case (`startTransition(() => router.refresh())` exposes `isPending` until the SSR render lands).
4. **Cold-company switches hit Postgres for every dashboard endpoint.** A switch into a never-visited company misses Redis on `dashboard:company:{id}:stats`, `:analytics`, `:recent`. Each of those three endpoints additionally fires `ActiveCompanyGuard`, which runs `findActiveMembership` against Postgres on every authenticated recruiter request - that lookup is **never** cached today, even though `TAGS.companyMembership(companyId)` and `TAGS.userMemberships(userId)` already exist and are busted on every member-mutation path.
5. **`companyStats` does four roundtrips.** The dashboard "stats" endpoint runs four sequential queries (`activeJobs`, `appsRow`, `avgRow`, `biasFlags`) - Postgres can return all of them in a single trip via independent CTEs.
6. **Detail-page redirect followed by `router.refresh()` runs an unnecessary second SSR pass.** When the user is on `/recruiter/jobs/abc-123` and switches company, `switchCompany` fires `router.push(detailIndex)` AND `router.refresh()`. The push already triggers a fresh server render at the new path; the refresh re-renders the same tree a second time.

The screenshots the user shared confirm multi-tenant scoping itself is correct: Test Company shows `1` active job and "Senior Software Engineer" in Top Jobs by Volume; the new "Company Name" company shows `0`. The data isolation is sound. The bug is purely the perceived freeze and the avoidable round-trips.

## Goal

Make a company switch _feel_ instant, then make it _be_ fast:

1. While a switch is in flight, render a centered, blurred-canvas overlay so the recruiter has unambiguous feedback that the click registered and the system is working. The overlay stays up until the new SSR render is committed.
2. Eliminate the avoidable serial roundtrip in the switch flow.
3. Eliminate the per-request Postgres hit in `ActiveCompanyGuard` by caching `findActiveMembership` against the existing `TAGS.companyMembership` / `TAGS.userMemberships` tag scaffolding.
4. Warm Redis on the most likely _next_ switch by prefetching dashboard endpoints when the user hovers a non-active row in the dropdown.
5. Collapse `companyStats` from four roundtrips to one query.
6. Skip the redundant `router.refresh()` when a detail-page redirect already triggered an SSR pass.

This is a cross-cutting change in two halves:

- **UX half** (frontend, `apps/web`): overlay component, lifted context state, `useTransition` rewire, hover prefetch.
- **Backend half** (`apps/api`): membership cache, `companyStats` CTE consolidation.

No schema changes, no API contract changes, no AI prompt changes.

## Scope

### In scope

**Frontend (`apps/web`):**

- New: `apps/web/components/layout/company-switch-overlay.tsx` - fixed-position overlay with backdrop blur, centered card, AuraHire-Blue ring spinner, target-company caption.
- Modify: `apps/web/contexts/active-company-context.tsx` - lift `isSwitching` (and a transient `pendingCompanyName`) into the context. Wrap `router.refresh()` in `React.useTransition` so the overlay can stay up until SSR settles. Run `setActiveCompanyOnServer` and `router.refresh()` concurrently. Skip `router.refresh()` when a detail-page `router.push` was triggered.
- Modify: `apps/web/components/layout/company-switcher.tsx` - drop the local `switching` state, read `isSwitching` from the context, add hover prefetch on dropdown rows.
- Modify: `apps/web/app/(recruiter)/layout.tsx` - render `<CompanySwitchOverlay />` once at the layout level (so it sits above the entire portal canvas).
- New: `apps/web/lib/dashboard-prefetch.ts` - small helper that issues parallel GETs to the three recruiter dashboard endpoints with a target `X-Active-Company-Id` header. Used by hover prefetch only; result is discarded - the only purpose is to populate Redis on the API side.

**Backend (`apps/api`):**

- Modify: `apps/api/src/common/guards/active-company.guard.ts` - wrap the `findActiveMembership` call in `cacheService.getOrSet` with TTL `TTL_SECONDS.warm` (5 min) and tags `[companyMembership(companyId), userMemberships(userId)]`. Existing mutation paths already bust those tags, so no audit-log changes are needed.
- Modify: `apps/api/src/common/guards/active-company.guard.ts` - also wrap the `lookupLastActiveCompanyId` profile lookup in `cacheService.getOrSet` (TTL `TTL_SECONDS.warm`, tag `userMemberships(userId)`) so the fallback path doesn't add a second per-request Postgres hit on requests that omit the header (server-rendered pages on cold loads).
- Modify: `apps/api/src/modules/profiles/profiles.repository.ts` - when `setActiveCompany` writes a new `lastActiveCompanyId`, bust `userMemberships(userId)` so the cached profile-lookup matches the new pointer.
- Modify: `apps/api/src/common/guards/active-company.guard.ts` - when the auto-heal branch persists a sole-membership pointer, also bust `userMemberships(userId)` for symmetry.
- Modify: `apps/api/src/modules/applications/applications.repository.ts` - replace the four sequential SELECTs in `companyStats` with one query using PG `WITH` (CTEs): one CTE per scalar so the planner can parallelize. Behavior identical; one roundtrip instead of four.

**Tests:**

- New: `apps/web/components/layout/company-switch-overlay.test.tsx` - render with `isSwitching=false` returns null; with `isSwitching=true, pendingCompanyName="Foo"` renders the overlay with `role="status"` and the company name in the caption; spinner has `aria-label="Loading"`.
- Modify: `apps/web/contexts/active-company-context.test.tsx` (create if absent) - test that `switchCompany` keeps `isSwitching=true` until the transition settles; that detail-page redirects skip the redundant refresh; that PATCH and refresh fire concurrently (mock both, assert both started before either resolved).
- New: `apps/api/src/common/guards/active-company.guard.spec.ts` - extend (or add) coverage for: cache hit on `findActiveMembership` short-circuits the DB call; cache miss triggers DB then SET; `companyMembership` tag bust evicts the entry; profile-lookup cache hit short-circuits the DB call.
- New: `apps/api/src/modules/applications/applications.repository.spec.ts` - extend (or add) coverage for `companyStats` returning identical numbers as the previous four-query implementation across the four range filters.

### Out of scope

- Multi-tenant data scoping itself - already correct, covered by Phase 2c work; not touching it.
- Admin or candidate portals - neither has a company switcher.
- Profile-edit screens beyond `setActiveCompany` - only that one write needs the new bust call.
- Mobile drawer / smaller breakpoints - `CompanySwitcher` is hidden in the drawer; only the desktop sidebar surfaces it. The overlay is rendered globally so the drawer flow inherits the loading state for free, but no drawer-specific UI changes are part of this spec.
- Switching the "active range" on the dashboard (`Last 7 days` selector) - independent surface, has its own loading state via TanStack Query.
- Scoring of `companyAnalytics` is already cached as a single Redis entry under `dashboard:company:{id}:analytics`; the per-roundtrip optimization there is "free" once `companyStats` consolidates because the analytics endpoint reuses `companyStats` for its `kpis` field.
- Removing `queryClient.clear()` - keeping it as a safety net; it's instant and protects against subtle leaks of cached pages from the previous tenant.
- "Switching back to a previously-visited company within TTL feels instant" is a _consequence_ of the existing dashboard cache (`TTL_SECONDS.hot = 60s`), not a goal of this spec - we measure improvement against cold switches.
- The `parsing` / `done` resume parsing card and any onboarding flow.
- Analytics chart visualizations - the dashboard pipeline-snapshot section is unaffected.
- Internationalization of the new caption - `Switching to {name}…` matches the codebase's English-only baseline.

## Architecture

### Data flow (after the change)

**User clicks a non-active company in the dropdown:**

1. `CompanySwitcher` calls `ctx.switchCompany(targetCompanyId)`. The dropdown closes (DropdownMenu's default behavior on item click).
2. `ActiveCompanyProvider`:
   - Sets `isSwitching = true` and `pendingCompanyName = "Test Company"` (looked up from `memberships` by id).
   - Calls `setActiveCompanyId(targetCompanyId)` synchronously - the next outgoing fetch already carries the new `X-Active-Company-Id` header.
   - **Concurrently** kicks off `setActiveCompanyOnServer(targetCompanyId)` (fire-and-forget at the React level, but `await`ed inside the transition for error handling).
   - Calls `queryClient.clear()` - instant, drops cached previous-tenant data.
   - If the current pathname is a detail page (`/recruiter/<section>/<id>`), runs `router.push(sectionIndex)` inside the transition and **skips `router.refresh()`** - the push already triggers a fresh SSR pass.
   - Otherwise, runs `router.refresh()` inside the transition.
3. `<CompanySwitchOverlay />` (rendered in the recruiter layout) reads `isSwitching` from the context and mounts a fixed overlay with the centered card.
4. React's `useTransition` keeps `isPending = true` until the new SSR render is committed and React paints the new tree.
5. Once the transition settles, `ActiveCompanyProvider` resets `isSwitching = false` and `pendingCompanyName = null` in a `useEffect` watching `isPending`. The overlay unmounts.
6. If `setActiveCompanyOnServer` rejected, the catch arm rolls `setActiveCompanyId` back to the prior value, sets `isSwitching = false` immediately, and the existing `toastApiError` path surfaces the error. The transition is canceled by the rollback render.

**User hovers a non-active company row in the dropdown (no click):**

1. `CompanySwitcher` schedules a `setTimeout(prefetch, 100)`.
2. If the user moves off the row before 100 ms, the timer is cleared - no fetch.
3. Otherwise, `prefetchDashboardForCompany(companyId)` issues three parallel `GET`s to `/api/v1/applications/recruiter-stats?range=7d`, `/api/v1/applications/recruiter-analytics`, `/api/v1/applications/recent?limit=6`, each carrying `X-Active-Company-Id: {companyId}`. Each request goes through `ActiveCompanyGuard`, which now consults the membership cache (cache hit on the second hover for the same target). On a cache miss for the _dashboard_ keys, the loader runs and SETs Redis under tag `dashboard:company:{companyId}`.
4. The fetches' results are discarded (we don't hydrate TanStack Query - the actual click flow does that). The only purpose is Redis warming.
5. AbortController is captured. If the dropdown closes before the prefetch completes, the in-flight requests are aborted (the API still gets the request and may complete the cache write - fine).

**`ActiveCompanyGuard.canActivate` (after the change):**

1. Public / no-user / admin / candidate / `@SkipActiveCompany()` short-circuits - unchanged.
2. Resolve `companyId` from header → cached profile lookup → auto-heal sole-membership.
3. Membership verification:
   ```ts
   const membership = await this.cacheService.getOrSet({
     key: `membership:${user.id}:${companyId}`,
     ttlSeconds: TTL_SECONDS.warm,
     tags: [TAGS.companyMembership(companyId), TAGS.userMemberships(user.id)],
     telemetryName: "guard:membership",
     load: () =>
       this.companyMembersRepo.findActiveMembership(user.id, companyId),
   });
   ```
   Cache key includes both `userId` and `companyId` so two users in the same company get separate entries (their roles can differ; we cache the full row including role).
4. Existing 403/role checks run unchanged on the cached row.

**`ApplicationsRepository.companyStats` (after the change):**

```sql
WITH
  active_jobs AS (
    SELECT COUNT(*)::int AS c
    FROM jobs
    WHERE company_id = $1 AND status = 'published'
  ),
  apps_stats AS (
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'applied')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'interview')::int AS interview,
      COUNT(*) FILTER (WHERE status = 'offer')::int AS offered,
      COUNT(*) FILTER (WHERE status = 'hired')::int AS hired
    FROM applications a
    INNER JOIN jobs j ON j.id = a.job_id
    WHERE j.company_id = $1
      AND ($2::timestamptz IS NULL OR a.applied_at >= $2)
  ),
  avg_score AS (
    SELECT AVG(ms.overall_score)::float AS avg_score
    FROM match_scores ms
    INNER JOIN jobs j ON j.id = ms.job_id
    WHERE j.company_id = $1
  ),
  bias_flags AS (
    SELECT COUNT(*)::int AS c
    FROM bias_flags bf
    INNER JOIN jobs j ON j.id = bf.job_id
    WHERE j.company_id = $1 AND bf.status = 'flagged'
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
FROM active_jobs, apps_stats, avg_score, bias_flags;
```

Drizzle's `db.execute(sql\`...\`)`is the path; the result is a single row. The current four`db.select(...)`blocks become one`db.execute` + a typed cast. The same shape (`{ activeJobs, totalApplications, totalApps, pendingReviews, pendingReview, inInterview, offered, hired, avgMatchScore, biasFlags }`) is returned - no caller change.

### Component contracts

#### `ActiveCompanyContextValue` (after)

```ts
interface ActiveCompanyContextValue {
  activeCompanyId: string | null;
  activeMembership: Membership | null;
  memberships: Membership[];
  isLoading: boolean;
  /** True from the moment switchCompany is called until the SSR render settles. */
  isSwitching: boolean;
  /** The display name of the company being switched TO. Null when not switching. */
  pendingCompanyName: string | null;
  switchCompany: (companyId: string) => Promise<void>;
  /** Fire warming GETs to the three dashboard endpoints for the target company. */
  prefetchCompanyDashboard: (companyId: string) => void;
}
```

The provider:

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

const switchCompany = useCallback(
  async (companyId: string) => {
    if (companyId === activeCompanyId) return;
    const target = memberships.find((m) => m.companyId === companyId);

    setPendingCompanyName(target?.companyName ?? null);
    setIsSwitching(true);

    // Synchronous singleton update - next fetch already carries the new header.
    setActiveCompanyId(companyId);

    // Concurrent: PATCH + UI transition. The PATCH only matters for SSR pages
    // and the guard's profile-lookup fallback; client requests already use
    // the localStorage singleton via the X-Active-Company-Id header.
    const patchPromise = setActiveCompanyOnServer(companyId).catch((err) => {
      // Roll back local state.
      setActiveCompanyId(initialActiveCompanyId ?? null);
      setIsSwitching(false);
      setPendingCompanyName(null);
      throw err;
    });

    // Drop cached previous-tenant data.
    queryClient.clear();

    startTransition(() => {
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        const detailMatch = path.match(/^(\/recruiter\/[^/]+)\/[^/]+/);
        if (detailMatch?.[1]) {
          router.push(detailMatch[1]); // push triggers SSR; refresh would duplicate
          return;
        }
      }
      router.refresh();
    });

    // Surface PATCH errors AFTER the transition has been started so the
    // overlay reflects the rollback.
    await patchPromise;
  },
  [activeCompanyId, memberships, initialActiveCompanyId, queryClient, router],
);

const prefetchCompanyDashboard = useCallback((companyId: string) => {
  void prefetchDashboardForCompany(companyId);
}, []);
```

#### `<CompanySwitchOverlay />`

```tsx
"use client";
import { useActiveCompany } from "@/contexts/active-company-context";

export function CompanySwitchOverlay() {
  const ctx = useActiveCompany();
  if (!ctx?.isSwitching) return null;

  const name = ctx.pendingCompanyName ?? "company";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[60] flex items-center justify-center
                 bg-[rgba(255,255,255,0.72)] backdrop-blur-sm"
    >
      <div
        className="flex min-w-[260px] flex-col items-center gap-4
                   rounded-[var(--radius-xl)] border border-[var(--color-hairline)]
                   bg-[var(--color-canvas)] px-8 py-6 shadow-[0_4px_12px_rgba(0,0,0,0.04)]"
      >
        <Spinner aria-label="Loading" />
        <p className="text-center text-[var(--color-body)]">
          Switching to{" "}
          <span className="font-semibold text-[var(--color-ink)]">{name}</span>…
        </p>
      </div>
    </div>
  );
}
```

`<Spinner />` is a small inline component:

```tsx
function Spinner({ "aria-label": label }: { "aria-label": string }) {
  return (
    <div aria-label={label} role="img" className="relative h-10 w-10">
      <div className="absolute inset-0 rounded-full border-[3px] border-[var(--color-primary-soft)]" />
      <div
        className="absolute inset-0 rounded-full border-[3px] border-transparent
                   border-t-[var(--color-primary)] animate-spin"
        style={{ animationDuration: "0.8s" }}
      />
    </div>
  );
}
```

This uses Tailwind's existing `animate-spin` keyframe (no new keyframes needed) with a custom 800 ms duration to match the design-system "Score Ring fill 800ms ease-out" cadence. The 3px ring weight echoes the Score Ring without being a Score Ring (it isn't an evaluation surface; it's a process indicator).

#### `CompanySwitcher` (rewire)

- Remove the local `useState<boolean>(switching)`.
- Read `{ isSwitching, switchCompany, prefetchCompanyDashboard }` from the context.
- The trigger button still uses `disabled={isSwitching}`.
- Each `DropdownMenuItem` for a non-active company gains:
  ```tsx
  <DropdownMenuItem
    key={m.companyId}
    onClick={() => void handleSelect(m.companyId)}
    onMouseEnter={() => schedulePrefetch(m.companyId)}
    onMouseLeave={() => cancelPrefetch()}
    onFocus={() => schedulePrefetch(m.companyId)}
    onBlur={() => cancelPrefetch()}
    ...
  >
  ```
- `schedulePrefetch` / `cancelPrefetch` are local refs that wrap a `setTimeout(..., 100)` around `prefetchCompanyDashboard(companyId)`. The 100 ms gate avoids triggering on a fast scroll past the row.
- The active row gets no prefetch handlers (already in cache by definition).

#### `prefetchDashboardForCompany`

```ts
// apps/web/lib/dashboard-prefetch.ts
import { getAccessToken } from "@aurahire/shared";

const ENDPOINTS = [
  "/api/v1/applications/recruiter-stats?range=7d",
  "/api/v1/applications/recruiter-analytics",
  "/api/v1/applications/recent?limit=6",
] as const;

export function prefetchDashboardForCompany(companyId: string): void {
  const token = getAccessToken();
  if (!token) return;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) return;

  for (const path of ENDPOINTS) {
    void fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Active-Company-Id": companyId,
      },
      // Best-effort warmer; we don't await, don't read the body, don't
      // surface errors. The API populates Redis as a side-effect.
      keepalive: true,
    }).catch(() => {});
  }
}
```

We don't bother with TanStack Query's `prefetchQuery` here because (a) the data is cleared on switch anyway via `queryClient.clear()`, and (b) the goal is server-side cache warming, not client-side data delivery. Fire-and-forget GETs are the right primitive.

### Edge cases

- **Switch to currently-active company:** `switchCompany` early-returns. Overlay never mounts.
- **PATCH fails after singleton write:** caught arm rolls back `setActiveCompanyId` and clears `isSwitching`. Existing toast surfaces the error. No SSR refresh runs (the throw is awaited _after_ `startTransition`, and the catch arm runs first).
- **Network is slow but not failed:** Overlay stays up. `useTransition` keeps `isPending = true` until SSR completes. There is no upper bound - that matches user expectation ("the page is loading; let it load").
- **User clicks another company while one switch is in flight:** The first row's `disabled={isSwitching}` is on the _trigger button_, not on dropdown items. The dropdown is closed during a switch (DropdownMenu closes on item click), so a second click is structurally impossible until the first settles. If the user reopens the dropdown after `useTransition` flips back, normal flow resumes.
- **User hovers many rows quickly:** Each hover schedules its own 100 ms timer; previous timers are canceled by `onMouseLeave`. The fastest user can trigger at most one prefetch per ~100 ms, which the API rate-limit comfortably handles.
- **Hover prefetch fires for a company the user then never switches to:** Wasted work, but bounded - three GETs per company hovered. Each populates Redis for `TTL_SECONDS.hot = 60s`. After 60s the entries expire. No staleness risk.
- **Membership cache hit but row was deleted between SET and GET (race):** `findActiveMembership` filters `status='active'`. A delete bumps the row's status to `'left'` (or removes it) and the mutation calls `cacheService.bustTags([companyMembership(...)])`. The bust runs _after_ the DB write (existing pattern in `companies.service.ts`); a request that lands between bust and the next read will repopulate. No correctness loss.
- **Membership row's role changes between SET and GET:** Same path - the `update` call in `CompanyMembersRepository` is followed by a `bustTags` in the calling service. Stale roles cannot leak past a bust.
- **`companyStats` CTE returns no rows for a brand-new company with zero jobs:** All four CTEs return one row each (COUNT/AVG over empty sets is 0/null). The single SELECT joining all four still returns one row. Behavior identical to current four-query implementation.
- **Detail-page redirect on switch but the old detail id happens to be valid in the new tenant:** Vanishingly rare (UUIDs), but: even if true, redirecting to the section index is still safer than silently showing a different company's resource at the same URL. The user can re-navigate.
- **`router.refresh()` runs while on a Next.js error boundary route:** `useTransition` handles this - `isPending` flips back when the new tree renders, even if it's the same error route. Overlay clears.
- **Profile-lookup cache hit after the user updated `lastActiveCompanyId` from a different tab:** `setActiveCompany` (in `profiles.repository.ts`) busts `userMemberships(userId)` after writing. Tab B sees the bust on its next request; cache reads from Redis for any user pull the fresh value.

### Error handling

- Frontend overlay never throws; it's purely presentational.
- `prefetchDashboardForCompany` catches errors and discards them. A failed prefetch must not break the click flow that follows.
- `setActiveCompanyOnServer` throwing is surfaced via the existing `toastApiError` path in `CompanySwitcher.handleSelect` - but `handleSelect` no longer manages `switching` itself. The provider's catch arm is responsible for resetting `isSwitching` on failure; the toast still shows.
- Backend `cacheService.getOrSet` already has fail-open behavior (Redis errors fall through to the loader). The guard inherits that - a Redis outage degrades us to current behavior, never blocks requests.
- The CTE `companyStats` query is wrapped in the same try/catch as before (it's one `db.execute` call). On error, the existing `cacheService.getOrSet` loader bubble-up path applies; the dashboard already handles per-section failures via `Promise.allSettled` in the page-level prefetch.

## Performance budget

Targets we're committing to (measured against the cold-switch path on a developer laptop, single user, no real Redis warmth):

| Metric                                                                  | Before                                                                                   | After (target)                                                                                                      |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Time-to-first-paint of new dashboard data                               | ~800-1200 ms perceived freeze                                                            | ~300-500 ms with overlay (perceived as deliberate)                                                                  |
| Postgres queries during a dashboard cold load                           | 4 (stats) + 3 (top jobs) + 1 (status breakdown) + 1 (recent) + 3 × guard membership = 12 | 1 (stats CTE) + 3 (top jobs) + 1 (status breakdown) + 1 (recent) + 0 (guard cache hit on 2nd+ call within 5min) = 6 |
| Postgres queries during a warm switch (Redis hit on dashboard keys)     | 3 × guard = 3                                                                            | 0 (guard cache hit on 2nd+ call)                                                                                    |
| Round-trips on a switch click before `router.refresh()` returns control | 1 (PATCH) sequential                                                                     | 0 sequential (PATCH parallelized with refresh)                                                                      |

The "perceived freeze becomes a deliberate transition" is the user-visible win even on the slow path. The query reductions are the measurable win on the backend side.

## Testing

### Unit / component (frontend)

- `company-switch-overlay.test.tsx`:
  - `isSwitching=false` returns `null`.
  - `isSwitching=true, pendingCompanyName="Test Company"` renders the overlay; assert `getByRole("status")` and that the caption contains both `"Switching to"` and `"Test Company"`.
  - Spinner has `aria-label="Loading"`.
- `active-company-context.test.tsx`:
  - `switchCompany(targetId)` sets `isSwitching = true` synchronously after the call.
  - Mocks `setActiveCompanyOnServer` and a `router.refresh` spy; asserts both fire concurrently (the mock for PATCH is held open via a `Deferred`; assert refresh was called _before_ PATCH resolves).
  - Detail-page pathname (`/recruiter/jobs/abc`) triggers `router.push("/recruiter/jobs")` and skips `router.refresh`.
  - PATCH rejection rolls back the singleton and clears `isSwitching` immediately.
  - Hovering a row (calling `prefetchCompanyDashboard`) fires three fetches with the correct `X-Active-Company-Id` header.
- `company-switcher.test.tsx` (extend existing if present, else new):
  - Hovering a non-active row schedules a prefetch; leaving within 100 ms cancels it; staying past 100 ms triggers the prefetch.
  - The active row has no `onMouseEnter` prefetch wiring.

### Unit / repository (backend)

- `applications.repository.spec.ts`:
  - `companyStats(companyId, "all")` for a seeded fixture returns the same numbers as a hand-rolled four-query equivalent.
  - Every range filter (`"7d"`, `"30d"`, `"90d"`, `"all"`) honors `applied_at` correctly.
  - Empty company (no jobs, no applications, no scores, no bias flags) returns all-zero / null-coerced-to-0.
- `active-company.guard.spec.ts`:
  - Cache hit path: `cacheService.getOrSet` is called with the right key; `companyMembersRepo.findActiveMembership` is NOT called.
  - Cache miss path: loader runs once; result cached.
  - Profile-lookup cache: the same coverage for the no-header path.

### Integration

- Manual: Log in as a recruiter with two memberships. Click switch from A → B. Verify the overlay appears centered with `Switching to B…` and disappears after the new dashboard renders. Verify the AVG MATCH SCORE / ACTIVE JOBS numbers update to B's data.
- Manual: Same flow on a `/recruiter/jobs/{id}` detail page. Verify URL changes to `/recruiter/jobs` AND data is for B.
- Manual: Open dropdown, hover a non-active row, watch the network panel - three requests fire ~100 ms after hover stabilizes; immediately moving off the row cancels them.
- Manual: Trigger a Redis outage in dev (`docker compose -f docker-compose.dev.yml stop redis`). Switch companies - overlay still appears, dashboard still renders (slower; cache fails open per existing behavior).

### Regression checks

- All existing recruiter-portal e2e flows (job create, application status change, shortlist add) must pass; bus paths for `companyMembership` / `userMemberships` are unchanged at the calling-service layer, only consumed at the guard layer.
- Admin and candidate portals must not render the overlay (guarded by the `useActiveCompany() === null` check at the layout level - admin/candidate trees aren't wrapped by the provider).

## Migration / rollout

Single PR per phase. No feature flags.

- Phase 1 (UX): overlay + lifted state + `useTransition` + concurrent PATCH + skip-refresh-on-detail-redirect. Reviewable as one frontend change.
- Phase 2 (membership cache): one-file change in the guard plus the `setActiveCompany` bust addition. Backwards-compatible - falls open on Redis miss to existing behavior.
- Phase 3 (hover prefetch): tiny client-side addition. Independently revertable.
- Phase 4 (`companyStats` CTE): one repository method rewritten. Behavior identical; covered by unit tests against a real Postgres fixture.

If a regression appears in any phase, revert that PR; no data cleanup required.

## Out of scope (explicit)

- No schema migrations.
- No new API endpoints.
- No DTO changes.
- No AI prompt or scoring config changes.
- No realtime / websocket changes.
- No mobile drawer rework.
- No analytics chart changes.
- No admin / candidate portal changes.
- No removal of the existing `queryClient.clear()` safety net.
