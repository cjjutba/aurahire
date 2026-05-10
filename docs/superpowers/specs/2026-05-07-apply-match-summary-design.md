# Apply Page — Surface Existing Match Preview, Stop Misleading "Computing" Shimmer

**Date:** 2026-05-07
**Owner:** Candidate apply flow
**Status:** approved (option C — surface preview with B-fallback for resume mismatch)

## Problem

When a candidate computes a Match Preview on the job detail page (`/candidate/jobs/[id]`) and then clicks **Apply Now**, the apply submit shows an `AiShimmer` captioned _"Computing your match against this job — analyzing skills, experience, education, and cultural fit..."_. The candidate's reasonable read is that the system is paying for a fresh AI call — exactly the redundancy they were promised wouldn't happen ("Apply now to lock this score in — no recompute required" on the preview card).

The redundancy is **not actually happening**. `apps/api/src/modules/scoring/scoring.service.ts:381-409` runs a **promotion path**: when a `match_score_preview` row exists for the same `(candidate, job, resume)` triple, the service reuses the cached AI result and skips the OpenAI call. The `promotedFromPreviewId` field in the audit log records when this happened.

The redundancy is therefore a **UI-layer lie**: the apply form's submit indicator (`apps/web/app/(candidate)/candidate/jobs/[id]/apply/_apply-form-client.tsx:108-117`) shows AI-computation copy regardless of whether the backend is actually computing. The perceived ~5 s delay during submit is database writes + audit log + email notification + redirect — not AI work.

Two adjacent honesty gaps make this worse:

1. The apply page never _shows_ the candidate that a preview already exists. They see only the resume picker and cover-letter form, so there's no visual signal that applying will simply lock in an already-computed score.
2. If the candidate switches to a non-default resume in the picker, a fresh AI call _will_ run on submit (the promotion path requires resume match) — but nothing in the UI warns them.

## Goal

Make the apply page tell the truth, in both directions:

- When the chosen resume has a preview → render the preview inline as a read-only summary, replace the misleading "Computing your match…" shimmer with a plain "Submitting application…" indicator, and label the submit button so the candidate knows they're locking in the visible score.
- When the chosen resume has no preview (different resume than default, or no preview was computed) → keep the existing `AiShimmer` with honest copy, and warn in the picker that switching resumes will trigger a fresh compute.

Reinforces the explainability thesis: every score is visible to the candidate before they commit to it, no hidden AI work, no "computing" copy that runs when nothing is computing.

This is a frontend-only change. The backend already does the right thing.

## Scope

**In scope:**

- `apps/web/app/(candidate)/candidate/jobs/[id]/apply/page.tsx`
  - Add a 4th parallel server fetch to `GET /api/v1/scoring/match-preview/{jobId}`.
  - Pass the preview (or `null`) and the chosen-resume's preview-match status down to the form client.
- `apps/web/app/(candidate)/candidate/jobs/[id]/apply/_apply-form-client.tsx`
  - Accept `preview: ApplyMatchPreview | null` as a prop.
  - Render a new `<ApplyMatchSummary>` panel above the resume picker when `preview` is non-null.
  - Compute `selectedResumeMatchesPreview = preview?.resumeId === resumeId` and use it to:
    - Drive a banner under the resume picker (locked-in copy vs. fresh-compute warning).
    - Branch the submit indicator: spinner+"Submitting…" on promotion path, current `AiShimmer` on fresh-compute path.
    - Adjust submit button label: "Lock in match & apply" vs. "Submit application".
- New component: `apps/web/components/score/apply-match-summary.tsx`
  - Read-only variant of the job-detail Match Preview card. No Recompute button, no fetch, no internal state beyond which component row is expanded.
  - Reuses `ScoreRing`, `MatchBandChip`, `EvidenceCallout`, and the existing `ComponentRow` markup. Visual parity with the job-detail card is the explicit goal — same component breakdown, same evidence panel, same fairness footnote, just stripped of compute affordances.

**Out of scope:**

- Backend changes. The promotion path already works.
- Changes to the job-detail Match Preview (`_match-preview-client.tsx`) itself.
- Changes to the application detail page (`/candidate/applications/[id]`) — already shows the locked-in score correctly.
- New API endpoints. Reuses existing `GET /api/v1/scoring/match-preview/{jobId}`.
- Database, schema, RLS, or scoring-config changes.

## Behavior

### Apply page on load

The server-side `ApplyPage` performs four parallel fetches (currently three): job recap, resumes, applications-mine, **and the match preview**. The preview fetch is non-fatal: if it fails or returns null, the page renders the no-preview branch.

The preview fetch hits `GET /api/v1/scoring/match-preview/{jobId}`, which calls `ScoringService.getMatchPreviewByJob()` and returns the latest preview for `(candidate, job)` regardless of which resume it was scored against. The DTO already contains `resumeId`, so the client can compare against the picker selection.

### Resume picker behavior

The picker still defaults to the candidate's default resume (existing behavior — `resumes.find((r) => r.isDefault)?.id ?? resumes[0]?.id`). Below the picker:

| Picker selection                           | Preview state     | Banner copy                                                                                                                                                     |
| ------------------------------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resume matches preview's `resumeId`        | Preview present   | _"Apply to lock in this score — no recompute needed."_ (positive, primary-soft background)                                                                      |
| Resume does not match preview's `resumeId` | Preview present   | _"You picked a different resume than the one your match was scored against. We'll compute a fresh match when you submit."_ (warning, score-mid-soft background) |
| Any resume                                 | No preview at all | _"No match preview yet — we'll score your resume against this job when you submit."_ (neutral, surface-soft background)                                         |

### Submit indicator

```
if (preview && selectedResumeMatchesPreview) {
  // Promotion path — backend reuses cached AI result.
  show <Spinner /> + "Submitting application…"
} else {
  // Fresh-compute path — backend runs OpenAI.
  show <AiShimmer caption="Computing your match against this job — analyzing skills, experience, education, and cultural fit..." />
}
```

The submit button copy mirrors this: "Lock in match & apply" on promotion path, "Submit application" on fresh-compute path. The mobile sticky action bar follows the same rule.

### `<ApplyMatchSummary>` panel

Renders only when a preview exists. Content matches the job-detail Match Preview card minus interactive affordances:

- Header: `Match summary` label + `Locked-in on apply` badge (primary-soft).
- Top row: `ScoreRing` (md) + `MatchBandChip` + meta line (`Computed {timestamp} · {latencyMs}ms · {model}`).
- Component breakdown rows (clickable to expand evidence — local state only).
- Evidence panel for active component (collapsed by default, "Show evidence and explanations" toggle).
- Fairness footnote (redacted-fields count + "Score reflects skills + experience match only.").
- **No Recompute button.** The candidate can return to the job detail page to recompute.

When `selectedResumeMatchesPreview === false`, the panel renders dimmed (`opacity-60`) with a small ribbon header: _"This was scored against your default resume. Switching back to it will lock in this score."_ Clicking the ribbon switches the picker back to the preview's resume.

### What never changes

- Cover-letter card, tips, character counter, and validation are untouched.
- `What happens next` right-rail card stays as-is.
- 409 handling (already-applied race) stays as-is.
- The hard block in the page server component (redirect to existing application if one exists) stays as-is.

## Component contracts

### `<ApplyMatchSummary>`

```ts
interface ApplyMatchSummaryProps {
  preview: ApplyMatchPreview;
  /**
   * Whether the resume currently selected in the apply form matches the
   * resume the preview was scored against. Drives the dimmed/ribbon state.
   */
  selectedResumeMatchesPreview: boolean;
  /**
   * Called when the user clicks the "switch back" ribbon. The form client
   * resets the resume picker to the preview's resumeId.
   */
  onSwitchToPreviewResume: () => void;
}

interface ApplyMatchPreview {
  id: string;
  jobId: string;
  resumeId: string;
  overallScore: number;
  band: "strong" | "partial" | "limited";
  components: Array<{
    name: string;
    score: number;
    max: number;
    weight: number;
    explanation: string;
    evidence: Array<{
      excerpt: string;
      source: string;
      relevance: "positive" | "negative" | "neutral";
      contributionPoints: number | null;
    }>;
  }>;
  redactedFields: string[];
  promptVersion: string;
  modelUsed: string;
  latencyMs: number;
  source: "system" | "candidate";
  createdAt: string;
}
```

The shape mirrors `MatchScorePreviewDto` from `apps/api/src/modules/scoring/dto/match-preview-response.dto.ts`. Component is purely presentational; no fetching, no Supabase client, no router.

### Updated `<ApplyFormClient>` props

```ts
interface ApplyFormClientProps {
  jobId: string;
  resumes: ResumeOption[];
  preview: ApplyMatchPreview | null;
}
```

`preview` is fetched server-side and passed down. The client never refetches it — if the candidate wants a fresher score they go back to the job detail page.

## Edge cases

- **No preview, candidate clicks Apply.** No summary card renders; banner says _"No match preview yet — we'll score your resume against this job when you submit."_; submit shows `AiShimmer`. This is the only path where the existing shimmer copy is honest, so it's preserved.
- **Default resume changed since preview was created.** `ScoringService.invalidatePreviewsForResume` (called from the resumes module on default change) deletes stale previews server-side. The apply page's preview fetch returns `null` and the no-preview branch handles it. No client-side staleness logic needed.
- **Candidate switches resumes mid-form.** Banner copy updates; submit indicator and button copy follow the new `selectedResumeMatchesPreview` value. No fetch.
- **Preview row exists but was scored against a non-default resume.** Not possible today — `computeMatchPreview` always uses `findDefaultByCandidateId` (`scoring.service.ts:541`). The summary panel still works because it compares `preview.resumeId` to the picker selection regardless of default status.
- **Server-side preview fetch fails (5xx, network error).** Treat as no-preview. Page still renders. Audit logs on the API side will capture the upstream error.
- **Preview fetch returns 401 (token expiry on the server fetch).** The server component redirects to `/login` already if `getCurrentSession()` returns null; otherwise pass `null` for preview and let the candidate proceed. The submit step re-authenticates via the browser Supabase client, so this doesn't strand the candidate.
- **Race: candidate computed a preview seconds ago, server-fetch caught a stale read.** Backend promotion still kicks in at submit time (it queries the DB directly, not the cache). Worst case the UI shows "no preview" while the backend silently promotes — candidate perceives a slower submit, score is still correct. Acceptable.

## Visual / motion

- Summary panel uses `var(--radius-xl)`, `var(--color-canvas)`, hairline border — matches the job-detail Match Preview card.
- Banner under the resume picker uses the corresponding token-driven background per state (primary-soft / score-mid-soft / surface-soft) and `var(--radius-md)`, 12 px padding.
- Submit transition: instant swap from form → spinner / shimmer. No exit animation. This matches every other submit flow in the app.
- Score Ring fill animation re-uses the existing 800 ms ease-out from `score-ring.tsx`.

No new tokens, no new motion patterns.

## Telemetry

No new audit events. The backend already logs:

- `score.match.preview.computed` when the preview was created (job-detail page).
- `score.match.computed` with `details.promotedFromPreviewId` when apply promotes the preview, or that field as `null` when fresh-compute ran.

The frontend change adds nothing — the existing audit trail already distinguishes the two paths and is the authoritative record for the thesis.

## Acceptance

- Apply page with default resume + existing preview → renders summary panel, primary banner, "Lock in match & apply" button, plain spinner on submit, no `AiShimmer`. Submit completes in roughly the time it takes to write the application + send the email (no AI latency).
- Apply page with non-default resume picked + existing preview against default → summary panel dimmed with ribbon, warning banner, "Submit application" button, `AiShimmer` on submit. Backend audit log shows `promotedFromPreviewId: null` for this submit.
- Apply page with no preview at all → no summary panel, neutral banner, "Submit application" button, `AiShimmer` on submit. Same as today, just with the new banner copy.
- Switching the resume picker between matching and non-matching options updates banner / button copy without any network call.
- The redirect target after successful apply is unchanged (`/candidate/applications/{id}`).
- 409 conflict (already applied, race) → toast + redirect to job detail, unchanged.
- No console errors during the load → render → submit cycle.
- `pnpm tsc --noEmit` clean for `apps/web`.
- `pnpm lint` clean for `apps/web`.

## Out of scope but worth noting

- Surfacing the candidate's full match-preview catalog inside `/candidate/applications/[id]` is already handled by the application detail page and out of scope here.
- A "preview is fresh / preview is stale" timestamp warning (e.g., "computed 3 days ago — recompute?") is _not_ part of this work. Today the backend invalidates on resume change and that's the only freshness signal we have. If we add freshness windows later it lives in a separate spec.
