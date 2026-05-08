# Onboarding Auto-Score + Buttonless Match Compute

**Date:** 2026-05-08
**Owner:** Candidate scoring + onboarding flow
**Status:** approved (B + auto-on-view + rate-limit fallback)

## Problem

The candidate journey has three avoidable points of friction tied to scoring:

1. **The dashboard's "Compute my score" button is redundant.** Onboarding (`/onboarding/candidate/*`) collects everything Profile Score needs — parsed default resume + personal info + preferences. The candidate clicks "Complete setup" on the preferences step, lands on `/candidate`, and is greeted by a card saying *"Compute your AI-powered profile score to see how strong your resume looks."* with a "Compute my score" button (`apps/web/app/(candidate)/candidate/_components/profile-score-card-client.tsx:84-99`). The work to compute it is one synchronous OpenAI call. Asking the candidate to ask for it is theatre.

2. **Recommendations appear empty on first dashboard arrival.** A BullMQ processor (`apps/api/src/modules/scoring/processors/match-preview-precompute.processor.ts`) already scores the top-N published jobs against a candidate's parsed default resume, writing rows into `match_score_previews` with `source = system`. The dashboard's `RecommendedForYouSection` (`apps/web/app/(candidate)/candidate/_dashboard-client.tsx:669-757`) reads from that table. The redirect from onboarding to `/candidate` happens before the precompute job finishes, so the section often renders empty for ~10–30 seconds with no explanation. This is a *timing* problem, not a missing feature.

3. **The "See my match" button on the job detail page is a UX dead-weight when a preview already exists.** `POST /api/v1/scoring/match-preview/:jobId` is idempotent — if a row exists for `(candidateId, jobId, resumeId)`, the endpoint returns the cache without an AI call. But `_match-preview-client.tsx:225-231` renders a "See my match" button regardless. The candidate clicks, waits, sees the cached result. The waiting is fake; the button is fake.

The pattern across all three: the system already does the AI work proactively, but the UI makes the candidate ask for it. That contradicts the thesis story ("transparent, explainable AI that works for the candidate"). It feels like *AI with manual switches* instead of *AI that's already on*.

## Goal

Make the candidate experience **buttonless for scoring**, end-to-end:

- At the end of onboarding, the candidate sees a brief *"AI is analyzing your profile…"* screen that finishes Profile Score inline (~3–5 s) and lets the first batch of match recommendations stream in (≤10 s wall clock).
- On the dashboard, Profile Score and recommendations are present on first paint, with shimmer slots for any recommendations still streaming.
- On a job detail page, scores render automatically — cached if a preview exists, computed on-mount if not (rate-limited; on cap-exceeded, the candidate is pointed to the apply path which always scores).
- Resume changes and preferences edits trigger transparent re-computation with shimmer + banner copy, never a manual recompute prompt.

The end-state mental model: **the candidate never sees a "compute" button anywhere in the candidate portal.** They see scores, shimmers, retry buttons (on AI failure), or a banner pointing to the apply path (on daily-cap exceeded). No manual compute trigger anywhere.

This reinforces the thesis story: explainable AI that pre-computes for the candidate rather than waiting to be asked. Every score still shows its work (Score Ring + Breakdown Bar + Evidence Callout); the only thing removed is the *trigger button*.

## Scope

**In scope:**

Backend (`apps/api`)
- Extend `PATCH /candidate-profiles/me/complete-onboarding` to compute Profile Score inline, enqueue match-preview precompute, and return the score in the response.
- New `ScoringService.computeMatchPreviewOnView(candidateId, jobId)` wrapping the existing preview compute with a per-candidate per-day Redis rate limit. Writes with `source = candidate_view` (new enum value). The existing `POST /api/v1/scoring/match-preview/:jobId` controller is updated to delegate to this new method; the prior code path (which wrote `source = candidate`) is removed since the manual "See my match" button is gone. Existing rows with `source = candidate` remain as historical data; the enum keeps the value for backward read-compatibility.
- Add `match_preview_source = 'candidate_view'` enum value.
- Add `profile_scores.stale_at TIMESTAMPTZ NULL` column + partial index for "current score per candidate."
- New realtime emissions on the existing Socket.IO infrastructure: `match-preview.created` and `profile-score.updated`, broadcast to room `candidate:{candidateId}`.
- Default-resume change handler: cancel in-flight BullMQ jobs scoped to the old `resume_id`, mark `profile_scores` stale, enqueue Profile Score recompute + match-preview re-precompute.
- Preferences-edit handler: mark `profile_scores` stale, enqueue Profile Score recompute (no match-preview action — preferences don't affect per-job scoring).
- Server-side guard `enqueueProfileScoreIfMissing` invoked on candidate-portal entry to backfill legacy candidates who completed onboarding before this change.

Frontend (`apps/web`)
- New page `app/onboarding/candidate/analyzing/page.tsx` — the "AI is analyzing your profile" screen with a state machine that waits on the API response then on Socket.IO events.
- Preferences final step (`/onboarding/candidate/preferences`) redirects to `/onboarding/candidate/analyzing` instead of `/candidate`.
- Remove the "Compute my score" button from `profile-score-card-client.tsx`. Render the latest score directly. When `stale_at IS NOT NULL` *and* no recompute is in flight, show a small "Recompute" affordance. When a recompute is in flight (after resume change, preferences edit, or manual click), overlay `AiShimmer` on the existing score number until the `profile-score.updated` event arrives.
- Remove the "See my match" button from `_match-preview-client.tsx`. Auto-compute on mount when no cached preview. Render `AiShimmer` during compute. On `429 DAILY_AI_LIMIT`, show a banner instead of a button — *"Daily AI compute limit reached. Apply to score this match as part of your application."* with a link to the apply page. No manual compute trigger remains in the UI.
- Dashboard `RecommendedForYouSection`: render shimmer slots while `previews.length < 5`; subscribe to `match-preview.created` events to fill them in. Graceful empty state on precompute failure.
- New shared hook `useCandidateRealtime()` in `apps/web/lib/realtime/` wrapping the Socket.IO subscription to `candidate:{id}` and exposing typed event streams.

Shared (`packages/shared`)
- Update `MatchPreviewSourceEnum` Zod to include `candidate_view`.
- New Zod schemas in `packages/shared/realtime/candidate-events.ts` for `match-preview.created` and `profile-score.updated` payloads — single source of truth for emitter and subscriber.

Database
- One migration: enum extension + `profile_scores.stale_at` + partial index.
- Drizzle schema mirror in `packages/db/`.

**Out of scope:**

- Recruiter-side changes. The match-preview-to-match-score promotion path on apply (`scoring.service.ts:381-409`) is unchanged; recruiter ranking continues to read `match_scores.overallScore` keyed to the `(candidate, job, resumeId)` they applied with. Resume changes after apply do not retroactively rescore submitted applications.
- Search/list-page auto-compute (the most aggressive option C from brainstorming). Cards in search results render the match-band chip only when a cached preview exists; they never trigger compute.
- New scoring algorithm. The AI call, prompt, schema, and weights are unchanged.
- Bias detection / job description checking. Out of this slice.
- Candidate "dismiss this recommendation" affordance. Possible follow-up but not required for this slice.
- Animation / motion design beyond the existing `AiShimmer` and Score Ring fill timings already specified in `DESIGN.md`.

## Architecture

### The three computations

| Computation | Storage | Source values | Triggered by |
|---|---|---|---|
| Profile Score | `profile_scores` | (single concept) | End of onboarding (blocking, ~3–5 s); default-resume change; preferences edit; legacy backfill guard |
| Top-N match precompute | `match_score_previews` | `system` | Resume parse complete (existing trigger, kept); default-resume change (new) |
| On-view match compute | `match_score_previews` | `candidate_view` (new) | First open of a non-recommended job's detail page; rate-limited |

Three distinct triggers, three distinct write paths, one shared output table for match scoring (`match_score_previews`) plus the dedicated `profile_scores` table.

### Trigger model — onboarding completion

```
User clicks "Complete setup" on /onboarding/candidate/preferences
        │
        │ router.push("/onboarding/candidate/analyzing")
        ▼
[/onboarding/candidate/analyzing] mounts
        │
        │ kicks off PATCH /candidate-profiles/me/complete-onboarding
        ▼
Backend transaction:
  • UPDATE candidate_profiles SET profile_completed = true   (always succeeds first)
  • Enqueue MatchPreviewPrecomputeJob (BullMQ, async)
  • Attempt: ScoringService.computeProfileScore(candidate, defaultResume, prefs)
        ◦ Synchronous OpenAI call (gpt-4o-mini)
        ◦ Writes profile_scores row with prompt_version, model_used, latency_ms, redacted_fields
        ◦ Writes audit_logs entry
        ◦ Emits "profile-score.updated" event with reason = "onboarding"
  • Respond 200:
      { profileCompleted: true,
        profileScore: <DTO> | null,
        precomputeJobId: <bullmq-id>,
        errors?: { profileScore?: "transient" | "missing_resume" } }
        │
        ▼
[/onboarding/candidate/analyzing] receives response
        │
        ├── profileScore != null → state: profileScoreReady
        │      │ open Socket.IO subscription to candidate:{id}
        │      ▼
        │   state: streamingPreviews
        │      │ count "match-preview.created" events received
        │      │ when count ≥ 5  OR  10 s wall-clock elapsed since profileScoreReady
        │      ▼
        │   router.push("/candidate")
        │
        └── profileScore == null → state: profileScoreDegraded
               │ wait 2 s (let user read "Still working on it…")
               ▼
               router.push("/candidate?profileScoreRetry=1")
                  └ dashboard renders Profile Score card with shimmer + retry banner
```

Wall-clock cap on streaming: **10 s after `profileScoreReady`**. Worst-case ceiling for the analyzing screen: ~5 s (Profile Score) + 10 s (preview wait) + 2 s (degraded path, only on AI failure) ≈ **17 s**, with the typical happy path at ~10–12 s.

### Steady-state flows

**Job detail page mount** (`apps/web/app/(candidate)/candidate/jobs/[id]/page.tsx`):
1. SSR: fetch job + `GET /scoring/match-preview/:jobId` (cache read; returns null if no row exists for `(candidate, job, defaultResumeId)`).
2. If preview exists in response → render Score Ring inline; done.
3. If no preview → client-side `useEffect` on mount fires `POST /scoring/match-preview/:jobId`.
   - UI: `AiShimmer` with caption *"Computing your match for this role…"*
   - On success → render Score Ring.
   - On `429 DAILY_AI_LIMIT` → render banner *"Daily AI compute limit reached. Apply to score this match as part of your application."* with a CTA link to `/candidate/jobs/[id]/apply`. No manual compute button.
   - On `500` → inline error: *"Couldn't compute your match. [Try again]"* (a retry on AI failure is allowed; the cap doesn't apply because the previous attempt didn't produce a row).
   - On `422 MISSING_RESUME` → *"Upload a resume to see your match"* + link to `/candidate/profile/resumes`.

**Default-resume change** (`PATCH /resumes/:id/set-default`):
1. Backend transaction:
   - Update default flag on resumes.
   - Look up in-flight BullMQ jobs by `data.resumeId = OLD_RESUME_ID`; remove them.
   - `UPDATE profile_scores SET stale_at = NOW() WHERE candidate_id = ? AND stale_at IS NULL`.
   - Enqueue `ProfileScoreRecomputeJob(newResumeId)` and `MatchPreviewPrecomputeJob(newResumeId)`.
2. Frontend dashboard:
   - Optimistic banner: *"Refreshing your scores with your new resume…"*
   - Profile Score card: shimmer over the existing number until `profile-score.updated` event arrives.
   - Recommendations section: existing previews stay visible (still useful as a fallback view) until new `system`-source previews arrive — at which point the section transitions. Old previews tied to the prior `resume_id` are not deleted, just no longer queried.

**Preferences edit** (`PATCH /candidate-profiles/preferences`):
1. Backend: update preferences row, mark `profile_scores.stale_at = NOW()`, enqueue `ProfileScoreRecomputeJob(currentDefaultResumeId)`. No match-preview action.
2. Frontend: shimmer over Profile Score card with caption *"Updating with your new preferences…"*. On `profile-score.updated` event → render new score.

### State machine — `/onboarding/candidate/analyzing`

States, transitions, and visible copy:

| State | Visible copy / UI | Transition out |
|---|---|---|
| `mounting` | brief skeleton | on mount → `computingProfileScore` |
| `computingProfileScore` | `AiShimmer` + *"Computing your Profile Score…"* | API response: profileScore present → `profileScoreReady`; profileScore null → `profileScoreDegraded`; network error → `error` |
| `error` | inline error + *"Try again"* button | click retry → `computingProfileScore` |
| `profileScoreDegraded` | *"We're still working on your score — taking you to your dashboard now."* | 2 s elapsed → `redirecting` (with `?profileScoreRetry=1` query) |
| `profileScoreReady` | Score Ring renders + *"✓ Profile Score ready. Finding your top matches…"* | open Socket.IO subscription → `streamingPreviews` |
| `streamingPreviews` | counter: *"N of 5 matches ready"*; visualized as filling-pip indicator | counter ≥ 5 OR 10 s elapsed → `redirecting` |
| `redirecting` | brief fade | `router.push('/candidate')` |

The state machine is implemented as a `useReducer` in the client component, not a state library. Single file, ~200 lines, easy to read.

### API contract — `PATCH /candidate-profiles/me/complete-onboarding`

Existing endpoint, additive change to the response shape. Old clients (none in production yet, but treating this as the contract anyway) ignore the new fields.

```ts
// Request: empty body (unchanged)

// Response 200:
{
  profileCompleted: true,
  profileScore: {
    overallScore: number,            // 0..100
    band: "strong" | "partial" | "limited",
    components: ScoreComponentDto[], // existing shape from ScoringService
    promptVersion: string,
    computedAt: string,              // ISO
  } | null,                          // null on AI failure
  precomputeJobId: string,
  errors?: {
    profileScore?: "transient" | "missing_resume",
    // "transient": OpenAI/network error. retry job enqueued.
    // "missing_resume": no parsed default resume found. should be impossible
    //   under normal flow (onboarding gates this) but defended for safety.
    // Profile Score is exempt from the on-view daily cap, so "rate_limited"
    // cannot occur on this endpoint.
  }
}

// Response 5xx: only on database errors. AI failure does NOT return 5xx.
```

The endpoint flips `profile_completed = true` **first**, then attempts the BullMQ enqueue, then attempts the inline Profile Score compute. Profile Score compute is attempted inline but does not gate the success of the endpoint — an OpenAI outage cannot trap a candidate in onboarding limbo. BullMQ enqueue is not transactional with Postgres; if the enqueue fails, the server-side `enqueueProfileScoreIfMissing` / precompute-missing guard re-enqueues on the next candidate-portal visit.

### Realtime event contract

Two new server-emitted events. Both scoped to Socket.IO room `candidate:{candidateId}`. The room is joined by the existing realtime hook on any candidate-portal page and explicitly on the analyzing page.

```ts
// emitted by ScoringService whenever a match_score_previews row is inserted
event: "match-preview.created"
payload: {
  candidateId: string,
  jobId: string,
  resumeId: string,
  source: "system" | "candidate_view",   // not "candidate" — that's user-initiated, separate path
  overallScore: number,
  band: "strong" | "partial" | "limited",
  createdAt: string,                      // ISO
}

// emitted by ScoringService on Profile Score compute (success or recompute)
event: "profile-score.updated"
payload: {
  candidateId: string,
  resumeId: string,
  overallScore: number,
  band: "strong" | "partial" | "limited",
  reason: "onboarding" | "resume_change" | "preferences_change" | "manual_recompute",
  updatedAt: string,
}
```

Both payloads have Zod schemas in `packages/shared/realtime/candidate-events.ts`; the API emitter validates outgoing payloads against the schema, and the web subscriber parses incoming payloads through the same schema.

The analyzing page subscribes only to `match-preview.created`. The dashboard subscribes to both — `match-preview.created` fills shimmer slots in the recommendations section, and `profile-score.updated` swaps the Profile Score card content.

## Rate limiting (cost guard)

**What's capped:** only `source = candidate_view` computes (the on-view path).

**What's exempt:** precompute (server-initiated, naturally bounded at top-25), Profile Score (one per onboarding + change events), apply-path compute (the thesis promise: every application gets a score).

**Mechanism:** Redis counter, keyed `scoring:onview:{candidateId}:{YYYY-MM-DD}` (UTC date). `INCR` + `EXPIRE 90000` (25 hours, room for clock skew). Read on every on-view request; reject *before* the OpenAI call when the count exceeds the cap.

```ts
// apps/api/src/modules/scoring/scoring.service.ts (new method)
async computeMatchPreviewOnView(candidateId: string, jobId: string): Promise<MatchPreviewDto> {
  const cap = await this.scoringConfigService.getOnViewDailyCap(); // default 100
  const today = new Date().toISOString().slice(0, 10);
  const key = `scoring:onview:${candidateId}:${today}`;

  const count = await this.redis.incr(key);
  if (count === 1) await this.redis.expire(key, 90_000);
  if (count > cap) {
    throw new TooManyRequestsException({ code: 'DAILY_AI_LIMIT', cap });
  }

  return this.computeMatchPreviewInternal(candidateId, jobId, 'candidate_view');
}
```

**Default cap: 100 / candidate / day.** Configurable in `scoring_config` (`onview_daily_cap`). At gpt-4o-mini pricing the worst-case per-candidate spend is bounded at ~$0.05 / day.

**On 429 from this endpoint:** the job detail page renders a banner with copy *"Daily AI compute limit reached. Apply to score this match as part of your application."* and a CTA link to the apply page. There is **no manual compute button** — including such a button would let curious browsing bypass the cap (defeating its purpose). The apply path is the cap-exempt escape hatch.

This means the candidate portal has *zero* manual compute buttons in steady state. Manual recompute survives only in the Profile Score card when `stale_at IS NOT NULL` (where the score is known to be inaccurate and a deliberate refresh is the right action).

## Database migration

One Drizzle migration with three changes:

```sql
-- 1. Extend the source enum
ALTER TYPE match_preview_source ADD VALUE IF NOT EXISTS 'candidate_view' AFTER 'system';

-- 2. Add staleness signal to profile_scores
ALTER TABLE profile_scores
  ADD COLUMN stale_at TIMESTAMPTZ NULL;

-- 3. Partial index for cheap "current score per candidate" lookup
CREATE INDEX idx_profile_scores_candidate_current
  ON profile_scores (candidate_id, computed_at DESC)
  WHERE stale_at IS NULL;
```

Mirror the schema in `packages/db/schema/scoring.ts`. No data backfill required for existing rows — `stale_at = NULL` is the correct default for every existing row.

A second additive change to `scoring_config` (existing JSON document):
```jsonc
{
  // ...existing keys...
  "onview_daily_cap": 100,
  "precompute_top_n": 25,
  "analyzing_screen_wallclock_ms": 10000
}
```

## Error handling matrix

| Trigger | API behavior | UI behavior |
|---|---|---|
| Profile Score AI fails during onboarding | `200` with `profileScore: null`, `errors.profileScore: "transient"`. Profile Score retry job enqueued (BullMQ, 3 attempts, exponential backoff). | Analyzing page → `profileScoreDegraded` for 2 s → redirect to `/candidate?profileScoreRetry=1`. Dashboard score card shows shimmer; resolves when retry succeeds and `profile-score.updated` arrives. |
| Profile Score retry exhausts (3 attempts) | Audit log written; `profile_scores` row remains absent. | Dashboard score card transitions from shimmer to inline error: *"We couldn't compute your score. [Try again]"* — manual retry only. |
| `complete-onboarding` PATCH itself errors (DB / network) | `5xx` | Analyzing page shows error with *"Try again"* button. No auto-redirect; candidate isn't trapped. |
| Match precompute job fails (3 retries) | Audit log written. | Dashboard recommendations section shows graceful empty state with retry button: *"We're still finding the right matches for you. [Retry] or [Browse all jobs]."* |
| On-view compute AI failure | `5xx` | Job detail page: shimmer → inline error: *"Couldn't compute your match. [Try again]"* |
| On-view compute hits daily cap | `429 DAILY_AI_LIMIT` | Banner: *"Daily AI compute limit reached. Apply to score this match as part of your application."* with CTA link to apply. **No manual compute button** — would bypass the cap. |
| Default resume missing when on-view requested | `422 MISSING_RESUME` | Job detail page: *"Upload a resume to see your match"* — links to `/candidate/profile/resumes`. |
| Socket.IO disconnects during analyzing | n/a (client-side) | 10 s wall clock fires anyway; redirect to dashboard. Dashboard reconnects on its own and pulls state from React Query refetch on focus. |
| Candidate already has `profile_completed = true` but no `profile_scores` row (legacy state) | First candidate-portal page load triggers a server-side `enqueueProfileScoreIfMissing` guard. Idempotent — if a row exists or a job is already queued, no-op. | Transparent to the candidate. Score card shows shimmer until the job lands. |

## Testing strategy

**Backend (Jest + supertest)**
- `CandidateProfilesService.completeOnboarding`:
  - Happy path: returns extended response with score; `profile_completed` flipped; precompute job enqueued; `audit_logs` entry written; `profile-score.updated` realtime event emitted.
  - AI failure path: returns 200 with `profileScore: null`; `profile_completed` still flipped; retry job enqueued.
  - DB error path: returns 5xx; no partial state.
- `ScoringService.computeMatchPreviewOnView`:
  - Below cap: writes row with `source = candidate_view`, increments Redis counter, emits `match-preview.created`.
  - At cap: throws `TooManyRequestsException` before the OpenAI call.
  - Cache hit: returns existing preview without incrementing or calling AI.
- Default-resume-change handler:
  - Cancels in-flight BullMQ jobs scoped to the old `resume_id`.
  - Marks existing `profile_scores` rows `stale_at`.
  - Enqueues new Profile Score + precompute jobs.
- Realtime emitters: assert event payload shape against the shared Zod schema.

**Frontend (Vitest + React Testing Library)**
- `/onboarding/candidate/analyzing` — render each state of the state machine (`mounting` / `computingProfileScore` / `profileScoreReady` / `streamingPreviews` / `profileScoreDegraded` / `error` / `redirecting`). Mock the API response and Socket.IO event stream.
- `profile-score-card-client.tsx` — render with `stale_at = null` (no recompute affordance) vs. `stale_at != null` (recompute visible).
- `_match-preview-client.tsx` (job detail) — render cached, uncached (auto-compute fires), rate-limited (`429`, asserts the apply-path banner appears and no manual compute button is rendered), error (`500`), and missing-resume (`422`) states.
- `_dashboard-client.tsx` (`RecommendedForYouSection`) — shimmer slots before events arrive, fill in as `match-preview.created` events stream in, graceful empty state on precompute failure.

**E2E (Playwright)**
- Full onboarding → analyzing → dashboard with both Profile Score and ≥5 recommendations rendered. Validates the full timing chain end-to-end.
- Onboarding with mocked AI failure → degraded path → dashboard with retry banner.
- Job detail navigation: a recommended job (cached) renders score without click; a non-recommended job triggers on-view compute and renders score after shimmer.
- Rate-limit smoke: synthetic test that rapidly opens 101 distinct job details → 101st renders the apply-path banner (and *no* compute button).

## Rollout plan

Two PRs to keep review tractable.

**PR 1 — Backend foundation** (no user-visible change yet)
1. DB migration (enum extension + `stale_at` + partial index).
2. Drizzle schema mirror in `packages/db/`.
3. Extend `complete-onboarding` response (additive — old clients ignore new fields).
4. New `ScoringService.computeMatchPreviewOnView` + Redis cap + `TooManyRequestsException` mapping to `429 DAILY_AI_LIMIT`.
5. New realtime emitters for `match-preview.created` and `profile-score.updated`.
6. Default-resume-change handler: cancel-old / enqueue-new.
7. Preferences-edit handler: mark stale + enqueue Profile Score recompute.
8. Server-side guard `enqueueProfileScoreIfMissing` invoked on candidate-portal entry.
9. Backend tests.

**PR 2 — Frontend cutover** (user-visible)
1. New `/onboarding/candidate/analyzing` page + state machine.
2. Preferences final step redirects to `/onboarding/candidate/analyzing` instead of `/candidate`.
3. Remove "Compute my score" button from `profile-score-card-client.tsx`. Render score directly with `stale_at`-driven recompute affordance.
4. Remove "See my match" button from `_match-preview-client.tsx`. Auto-compute on mount. Manual button only on `429`.
5. Dashboard `RecommendedForYouSection`: shimmer slots + Socket.IO subscription.
6. New `useCandidateRealtime()` hook in `apps/web/lib/realtime/`.
7. Frontend + E2E tests.

**Post-deploy verification:**
- Run a one-shot report: count candidates with `profile_completed = true AND no current profile_scores row`. Should be a small known number from before this change.
- Manually batch-enqueue Profile Score compute for those (the server-side guard catches them as they log in, but a backfill avoids first-load shimmer for active users).
- Watch `audit_logs` for AI failure rate during the first 48 h. If it spikes above ~2 %, investigate before further changes.

## Recruiter-side invariant (no work needed — confirming)

When a candidate applies, the existing match-preview-to-match-score promotion path (`scoring.service.ts:381-409`) is unchanged. Recruiter ranking pulls from `match_scores.overallScore` keyed to the `(candidate, job, resumeId)` they applied with. If the candidate later changes their default resume, the application's score stays pinned to the resume they actually submitted — which is the correct invariant. Recruiter-side requires zero modifications under this design.

## Open follow-ups (not blocking this slice)

- **Reverse precompute on job publish.** When a recruiter publishes a new job, score it against the top-N active candidate profiles. Helps recruiter-side ranking light up faster and gives candidates whose dashboards are open a fresh recommendation. Adds complexity around defining "active candidate profile" — defer.
- **Dismiss-recommendation affordance.** Candidate "Not interested" on a recommended job. Either a `dismissed_at` column on `match_score_previews` or a separate `recommendation_dismissals` table. Defer; not load-bearing for the thesis.
- **Search-results card auto-compute** (option C from brainstorming). Highest AI spend; cards in lists currently render the match-band chip only when a cached preview exists. Defer.
- **Manual Profile Score recompute affordance when not stale.** Currently the recompute button only appears on `stale_at IS NOT NULL`. If candidates request a "force refresh" without changing inputs, add a daily-rate-limited button. Defer until requested.
