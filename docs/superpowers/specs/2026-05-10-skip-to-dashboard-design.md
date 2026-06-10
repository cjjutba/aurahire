# Skip to Dashboard from `/onboarding/candidate/analyzing`

**Date:** 2026-05-10
**Owner:** UX polish, candidate onboarding (analyzing screen → candidate dashboard)
**Status:** approved (option B for skip timing - visible after Profile Score is ready; option B for surfacing - inline-only on affected widgets; option A for auto-redirect - keep the existing 10s cap; option A for failure mode - shimmer-then-error after 30s)

## Problem

`apps/web/app/onboarding/candidate/analyzing/_analyzing-client.tsx` blocks the candidate on a "Computing your Profile Score…" card while two things happen behind the scenes:

1. A synchronous `PATCH /api/v1/candidate-profiles/me/complete-onboarding` (typically 2-5s) flips `profileCompleted = true` and returns the freshly computed Profile Score.
2. Up to five match-preview jobs stream in via Supabase Realtime over the next few seconds, ticking a "N of 5 matches ready" counter.

After both phases - or after a 10-second wall-clock cap - the page auto-redirects to `/candidate`. Today the candidate has no way to leave early. On a slow connection, on a thesis-defense demo, or just for a power user who wants to start browsing jobs immediately, the wait is dead time. The scoring infrastructure is already async-friendly (BullMQ recompute queue, Supabase Realtime fan-out, dashboard widgets that already render from `null` via `AiShimmer`), so the wait is a UX wrapper around work that's already non-blocking.

## Goal

Add an explicit "Skip to dashboard" affordance on `/analyzing` that lets the candidate proceed to `/candidate` while match previews continue computing in the background. Preserve the existing safety net (10s auto-redirect cap), the existing realtime updates, and the explainable-scoring story (the score reveal still happens - on the dashboard instead of on `/analyzing`).

This is **frontend UX + one audit event only** - no backend scoring changes, no DB schema changes, no new API endpoints. Backend infrastructure already supports the flow.

## Scope

**In scope:**

- Add a tertiary text link `Skip to dashboard →` directly under the loading card on `apps/web/app/onboarding/candidate/analyzing/_analyzing-client.tsx`.
- Gate the link's visibility to the `profileScoreReady`, `streamingPreviews`, and `profileScoreDegraded` reducer states; hidden during `computingProfileScore`, `error`, `validationError`, `redirecting`.
- On click: dispatch the existing `REDIRECT` reducer action and call `router.replace("/candidate")` (not `push` - keeps the analyzing page out of history).
- Fire one audit event `user.onboarding.skipped_analyzing` with payload `{ score_ready: boolean, previews_ready: 0..5 }` via the existing audit service. Surfaces in audit logs for thesis-defense data ("how often candidates skip, at what point").
- Update `apps/web/app/(candidate)/candidate/_components/profile-score-card-client.tsx` (and its mirror on `/candidate/profile`) so that when `profileScore == null` it shows `AiShimmer` for ≤30s and then transitions to a calm error card with copy `We couldn't compute your score yet` + `[Try again]` button wired to the existing `POST /api/v1/scoring/profile/compute` endpoint.
- Update the Top Matches widget on `/candidate` to render a small `· N of 5 ready` inline counter next to its title while previews stream in. Counter ticks on each `match-preview.created` realtime event. Disappears when N == 5 or after 30s without progress. Empty slots render shimmer placeholder cards at full match-card height so the layout doesn't reflow when matches land.
- Add a 30s "matches stalled" caption: `Some matches couldn't be loaded - browse all jobs →` linking to `/candidate/jobs`. Stalled is defined as no `match-preview.created` event for 30s while N < 5.
- Add a layout-level guard at `apps/web/app/onboarding/candidate/layout.tsx` (or wherever the onboarding layout lives) that redirects to `/candidate` when the authenticated user already has `profileCompleted = true`. Mirror of the existing guard that gates `/candidate` behind `profileCompleted`.

**Out of scope:**

- Any change to the `complete-onboarding` PATCH lifecycle, scoring service, or BullMQ job shape. Backend stays as-is.
- Any change to the existing 10s `ANALYZING_SCREEN_WALLCLOCK_MS` auto-redirect cap. It remains the safety net for users who don't skip.
- A persistent banner or top-of-dashboard alert announcing the pending state. Inline-only on widgets - explicitly chosen during brainstorming for editorial calm and to avoid duplicate notification surfaces.
- A toast on completion ("your matches are ready"). Same reason - inline-only.
- A cross-page sidebar/header indicator that match previews are still streaming. The realtime hook stays subscribed at the layout level; widgets reflect state when the user is viewing them. No global indicator.
- Recruiter or admin portal changes. The recruiter pipeline's per-application match score backfills naturally when scoring lands; nothing to surface there.
- Shortening, removing, or making adaptive the 10s auto-redirect cap.
- Gating the Apply button or any other candidate action behind "score ready." Applications are independent of Profile Score - apply works during the pending window.
- New endpoints. The "Try again" button reuses the existing rate-limited `POST /scoring/profile/compute`.
- Schema changes. `profile_scores.status` and `staleAt` are already sufficient for all surfaces this design touches.

## Design

### Anatomy of `/onboarding/candidate/analyzing` after the change

```
┌─────────────────────────────────────────────┐
│              AuraHire                        │
│                                              │
│   ┌─────────────────────────────────────┐    │
│   │ ✦ Computing your Profile Score…     │    │
│   │ ┌─────────────────────────────────┐ │    │
│   │ │       (shimmer placeholder)     │ │    │
│   │ └─────────────────────────────────┘ │    │
│   └─────────────────────────────────────┘    │
│                                              │
│         Skip to dashboard →                  │  ← new, conditional
│                                              │
└─────────────────────────────────────────────┘
```

The skip link sits below the card. It uses `button-tertiary-text` (transparent background, `{colors.body}` text, no pill, no border) at `{typography.button}` weight, with the right-arrow glyph. Hover darkens text by ~8% per the unspecified-but-conventional hover rule.

### State machine integration

The existing reducer in `_analyzing-client.tsx` already has these `kind` values:

- `computingProfileScore` - initial state, `complete-onboarding` PATCH in flight
- `profileScoreReady` - score landed, before any preview events
- `streamingPreviews` - first `match-preview.created` event has fired
- `profileScoreDegraded` - `complete-onboarding` returned with `errors.profileScore = "transient"`
- `error` - unrecoverable (network, validation enforcement)
- `validationError` - onboarding step incomplete
- `redirecting` - `REDIRECT` dispatched, navigation in flight

Skip link visibility, by state:

| State                   | Skip visible?       | Reason                                                                                                           |
| ----------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `computingProfileScore` | No                  | `complete-onboarding` not yet returned; skipping risks a navigation that beats the `profileCompleted=true` write |
| `profileScoreReady`     | Yes (200ms fade-in) | Score is in DB, all writes committed                                                                             |
| `streamingPreviews`     | Yes                 | Typical state where users would skip                                                                             |
| `profileScoreDegraded`  | Yes                 | Let the user escape the loading screen; degraded path on the dashboard handles missing score                     |
| `error`                 | No                  | Has its own remediation surface                                                                                  |
| `validationError`       | No                  | User must fix onboarding step first                                                                              |
| `redirecting`           | No                  | Already navigating                                                                                               |

### Click handler

```ts
function onSkipClick() {
  audit.fire("user.onboarding.skipped_analyzing", {
    score_ready:
      state.kind !== "computingProfileScore" &&
      state.kind !== "profileScoreDegraded",
    previews_ready:
      state.kind === "streamingPreviews" ? state.previewsReady : 0,
  });
  dispatch({ type: "REDIRECT" });
  router.replace("/candidate");
}
```

`router.replace` is intentional: removing `/analyzing` from history means a back-button press from `/candidate` doesn't land on a now-stale loading screen. The onboarding-tree layout guard (added by this design) handles the case where the user navigates back further into `/onboarding/candidate/preferences` etc.

### Dashboard pending states (`/candidate`)

**Profile Score card** - `apps/web/app/(candidate)/candidate/_components/profile-score-card-client.tsx`:

- `profileScore != null` → render `ScoreRing` + `MatchBandChip`. Existing behavior, unchanged.
- `profileScore == null` and `<30s since dashboard mount` → `AiShimmer` with caption `Computing your Profile Score…`. Existing behavior.
- `profileScore == null` and `≥30s since dashboard mount` → swap to error card:
  - Headline: `We couldn't compute your score yet`
  - Body: `This usually self-resolves within a minute. You can also try again now.`
  - CTA: `[Try again]` pill, calls existing `POST /api/v1/scoring/profile/compute`. Button is rate-limited at 1/min server-side; client respects 429 by disabling for the remainder.

The 30s threshold is a single client-side constant (`PROFILE_SCORE_PENDING_TIMEOUT_MS = 30_000`). The card listens to `profile-score.updated` realtime events and resets the timer on each event arrival; success transitions out of pending naturally.

**Top Matches widget** - same dashboard:

- Subscribed to `match-preview.created` realtime events through the existing `useCandidateRealtime()` hook.
- Header markup: `Top Matches` + (when `previewCount < 5` and not stalled) ` · N of 5 ready` in `{typography.caption}` `{colors.muted}`.
- Visible match cards render normally.
- Empty slots (positions `previewCount + 1` through `5`) render `AiShimmer` placeholder cards sized identical to a real match card so layout is stable.
- After 30s of no new `match-preview.created` events with `previewCount < 5`: freeze the counter, swap caption to `Some matches couldn't be loaded - browse all jobs →` (links to `/candidate/jobs`), and remove remaining shimmer placeholders.
- After `previewCount == 5`: counter disappears, header reverts to plain `Top Matches`.

**`/candidate/profile` Profile Score widget** - same component as the dashboard. Both surfaces share the pending/error states.

**No other widgets change.** Applications, interviews, profile completeness, recent activity, and so on do not depend on Profile Score and are rendered as today.

### Cross-page navigation behavior

If the candidate skips to `/candidate`, then navigates to `/candidate/jobs` while previews are still streaming:

- The realtime hook stays subscribed at the candidate-portal layout level (existing pattern).
- Match previews land in the database via the backend queue; no UI surfaces them on `/candidate/jobs` because the listing renders match scores on-click via the per-job match-preview endpoint, not from the precompute set.
- When the candidate returns to `/candidate`, the Top Matches widget re-renders from the latest DB state - whatever has landed by that point.
- No header/sidebar pip, no global toast, no "matches ready" notification. Deliberate inline-only choice.

### Failure mode reference

| Failure                                               | What user sees                                                                                                   | What backend does                                                                             |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Profile Score AI errored during `complete-onboarding` | Dashboard shimmer for ≤30s → error card with `[Try again]`                                                       | Auto-enqueues recompute job (existing `ProfileScoreQueueService` behavior)                    |
| Profile Score recompute also fails                    | Stays in error card; `[Try again]` button visible (rate-limited)                                                 | Logs to audit; no further auto-retry beyond the first enqueue                                 |
| < 5 match previews ever land                          | Top Matches widget freezes counter at N, shows `Some matches couldn't be loaded` caption with browse-all link    | Logs partial completion; existing match-preview-on-view endpoint can still fill specific jobs |
| Realtime channel drops while user on dashboard        | TanStack Query refetches `profileScore.me()` and `matchPreviews()` on window focus and on a 30s polling fallback | No backend change; this is existing client config                                             |
| User skips during `computingProfileScore`             | Cannot - link not visible during that state                                                                      | n/a                                                                                           |

### Audit event payload

```ts
// apps/api/src/audit/audit.types.ts - add to UserActions union
"user.onboarding.skipped_analyzing": {
  score_ready: boolean;       // was Profile Score landed before skip?
  previews_ready: 0 | 1 | 2 | 3 | 4 | 5;  // how many match previews had streamed in
};
```

The frontend fires this through the existing audit-event surface (whatever the established candidate-portal audit-fire pattern is - likely a thin client wrapper that POSTs to a backend audit endpoint). Server-side the audit service writes the event row; reuses existing infrastructure end to end.

### Onboarding-tree layout guard

`apps/web/app/onboarding/candidate/layout.tsx` (or equivalent) currently allows access to all onboarding steps regardless of completion state. After this design ships, completed candidates who somehow land back inside `/onboarding/candidate/*` (e.g., via browser back button or stale bookmark) should be redirected forward to `/candidate`.

Implementation: in the layout's server component, read the candidate profile, and if `profileCompleted === true`, call `redirect("/candidate")`. Mirrors the existing guard on `/candidate` that bounces incomplete users back to onboarding.

If the guard already exists in some form, this design simply confirms its presence; if not, adding it is part of this slice.

## Edge cases

| Scenario                                                                       | Behavior                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User refreshes `/analyzing` mid-flow                                           | Page re-mounts; `complete-onboarding` PATCH re-fires (the `useRef` guard resets on a fresh page load). Backend must be idempotent on the PATCH - already is, per the existing `profileCompleted=true` early-return + scoring `staleAt` semantics. Score card re-reads from DB; user proceeds normally.                                                                      |
| User clicks browser back from `/candidate` after skipping                      | `router.replace` removed `/analyzing` from history. Back goes to whatever preceded `/analyzing` (typically `/onboarding/candidate/preferences`). The new onboarding-tree layout guard catches that and redirects forward to `/candidate`.                                                                                                                                   |
| User skips, then closes the tab before previews finish                         | Backend queue continues server-side. Realtime events fire to no listener - no-op. On next session, dashboard reads current DB state.                                                                                                                                                                                                                                        |
| User has Profile Score from a prior session and somehow re-enters `/analyzing` | Layout guard catches it before render and redirects to `/candidate`. The analyzing page never mounts.                                                                                                                                                                                                                                                                       |
| User skips, then immediately tries to apply to a job                           | Applications don't depend on Profile Score. Apply works. The recruiter pipeline's per-application match score backfills when scoring lands; if it lands after the recruiter has already viewed the application, the existing match-on-view fallback computes it on demand.                                                                                                  |
| Two browser tabs open during onboarding                                        | Each tab runs its own state machine; skipping in one doesn't affect the other. Backend `complete-onboarding` is idempotent. Realistically rare - onboarding is single-tab.                                                                                                                                                                                                  |
| Slow connection: score takes longer than 5s                                    | Skip link stays hidden until `complete-onboarding` returns. The existing 10s wall-clock cap from "score ready" still fires the auto-redirect. Same safety net as today.                                                                                                                                                                                                     |
| Profile Score AI degrades AND user skips                                       | Lands on dashboard, sees shimmer for ≤30s, transitions to error card with retry. Calm failure path.                                                                                                                                                                                                                                                                         |
| Realtime hook subscription scope                                               | The hook is currently mounted on `/candidate` (verified). For `/candidate/profile` to share the score card's pending behavior, ensure the hook is also active on that route - either via the candidate-portal layout (preferred) or via the score card client component subscribing on its own. Verify during implementation; treat as a small fix-up if not already wired. |

## Use cases

1. **Power user** wants to start browsing jobs immediately after upload. Skip lets them.
2. **Slow-connection candidate** is losing patience watching the spinner. Skip is the escape valve.
3. **Demo / thesis defense** - committee wants to see the dashboard quickly without waiting through the full match-streaming ceremony. Skip enables that without bypassing scoring (the score still computes, and the explainability click-through is preserved on the dashboard).
4. **Returning candidate** re-running onboarding after profile changes. They've seen the score before; skip avoids the duplicated wait.
5. **QA / dev seeding test data** - skip shortens the manual loop during development and acceptance testing.

## Components touched

| File                                                                                           | Change                                                                                                            |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `apps/web/app/onboarding/candidate/analyzing/_analyzing-client.tsx`                            | Add skip link, click handler, audit event; add visibility gating per reducer state                                |
| `apps/web/app/onboarding/candidate/layout.tsx` (or whichever guards onboarding)                | Add `profileCompleted=true` redirect to `/candidate` (verify if already present)                                  |
| `apps/web/app/(candidate)/candidate/_components/profile-score-card-client.tsx`                 | Add 30s shimmer-then-error transition; wire `[Try again]` to existing recompute endpoint                          |
| `apps/web/app/(candidate)/candidate/_components/top-matches-widget-client.tsx` (or equivalent) | Add inline `N of 5 ready` counter, shimmer placeholders for empty slots, 30s stall detection + browse-all CTA     |
| `apps/web/app/(candidate)/candidate/profile/...` (the profile page's score card mirror)        | Same shimmer-then-error behavior as the dashboard's score card                                                    |
| `apps/api/src/audit/audit.types.ts`                                                            | Add `user.onboarding.skipped_analyzing` event type and payload shape                                              |
| Wherever the candidate-portal audit-fire client wrapper lives                                  | Surface the new event helper if there's typed wrapper sugar; otherwise just call the existing fire-event endpoint |

No backend service or schema changes.

## Out of scope (explicit)

- Banners, toasts, or cross-page indicators announcing the pending state.
- Changing the `complete-onboarding` PATCH lifecycle, scoring service, or queue.
- Modifying the 10s `ANALYZING_SCREEN_WALLCLOCK_MS` auto-redirect cap.
- Recruiter or admin portal changes.
- A "Apply gated until score ready" rule.
- New endpoints - the retry button reuses the existing rate-limited recompute endpoint.
- Schema changes.

## Open assumptions worth verifying during implementation

1. **Backend `complete-onboarding` PATCH is idempotent** on duplicate calls (page refresh, double-mount under React strict mode). Existing code suggests it is, but worth a unit test if not already covered.
2. **Onboarding-tree layout guard for completed users** - verify whether `apps/web/app/onboarding/candidate/layout.tsx` (or the equivalent) already redirects completed candidates forward. If not, add it.
3. **`useCandidateRealtime` subscription scope** - confirm the hook is mounted at a layout level that covers both `/candidate` and `/candidate/profile`. If currently only on the dashboard page, lift it.
4. **30s thresholds (score pending, matches stalled)** - reasonable defaults, not measured. Tunable via constants.
5. **`router.replace` interaction with scroll restoration** - assume default Next.js 16 behavior is fine; spot-check during QA.
