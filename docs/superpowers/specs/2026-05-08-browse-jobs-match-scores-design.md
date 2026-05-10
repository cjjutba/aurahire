# Browse Jobs — Surface Precomputed Match Scores on Candidate Job Cards

**Date:** 2026-05-08
**Owner:** UX consistency, candidate Browse Jobs page
**Status:** approved (option A — surface existing precomputed previews; no new AI calls; no backend changes)

## Problem

The candidate dashboard's "Recommended for You" section (`apps/web/app/(candidate)/candidate/_dashboard-client.tsx`, `RecommendedJobCard` at lines 813–887) renders each job with a match band chip, a thin colored progress bar, and a numeric score in JetBrains Mono.

The candidate Browse Jobs page (`/candidate/jobs`) renders the same underlying jobs through `apps/web/components/jobs/job-card.tsx` with **no score information at all** and a stale subtitle: `"match scoring arrives in a future slice"` (`_jobs-list-client.tsx:71`). That copy is a leftover from the original 2.2 plan; match scoring has long since shipped — `GET /api/v1/scoring/match-previews` already serves up to 25 precomputed previews per candidate, ordered by score.

The user-visible bug: the dashboard knows that "Engineering Manager — Frontend Platform" is a 76 / 100 Strong Match, but the Browse Jobs page renders the same card with no signal at all. The candidate has to navigate into the job detail page to learn what the dashboard already knows.

## Goal

Surface the precomputed match preview (band + score + progress bar) directly on each `JobCard` shown in the candidate Browse Jobs grid, mirroring the dashboard's visual language and reusing its color-band logic. No new AI spend, no backend changes, no new endpoints.

This is presentation-only and additive — the score region is opt-in via prop. Today only the candidate Browse Jobs grid imports `JobCard`, but keeping the prop optional preserves headroom if recruiter or admin surfaces ever adopt the component.

## Scope

**In scope:**

- Edit `apps/web/app/(candidate)/candidate/jobs/_jobs-list-client.tsx`:
  - Call `useMyMatchPreviewsQuery` alongside the existing `useCandidateJobsQuery`.
  - Build a `Map<jobId, MatchPreviewListItem>` once per render.
  - Pass the matched preview down to `<JobCard>` via a new optional prop.
  - Replace the stale `"match scoring arrives in a future slice"` subtitle (see Subtitle copy below).
- Edit `apps/web/components/jobs/job-card.tsx`:
  - Accept a new optional `matchPreview?: { overallScore: number; band: "strong" | "partial" | "limited" }` prop.
  - When the prop is present, render a compact score row (chip + bar + numeric score) above the existing footer divider.
  - When the prop is absent, the card renders exactly as it does today (no layout shift, no placeholder).
- Pass `previews.isLoading` through so cards can render a thin shimmer in the score region while the previews list resolves on first paint.

**Out of scope:**

- Any backend change. The `match-previews` GET endpoint, the precompute queue, the per-job on-view recompute path, and the daily AI cap all stay exactly as they are.
- Any change to other pages. Today only the candidate Browse Jobs path imports `JobCard`; the dashboard's "Recommended for You" uses its own internal `RecommendedJobCard`.
- "Best match" sort option. Adding it correctly would require backend support (the `match-previews` list is capped at 25 and is independent of the `jobs` list pagination) — sorting only the visible page client-side would lie about pagination ordering. Defer.
- "Strong match only" filter. Same reason — needs backend.
- The job detail page (`/candidate/jobs/[id]`) — its existing `_match-preview-client.tsx` already handles per-job preview rendering and on-view compute; not touched here.

## Design

### Data flow

```
_jobs-list-client.tsx (client component)
  ├── useCandidateJobsQuery(params)        → rows = jobs for current page
  ├── useMyMatchPreviewsQuery()            → previews (up to 25, ordered by score)
  └── const previewsByJobId = new Map(previews.data?.data?.map(p => [p.jobId, p]))
       └─→ for each row:
            <JobCard
              matchPreview={previewsByJobId.get(row.id)}
              matchPreviewLoading={previews.isLoading}
              ...
            />
```

Both queries already exist. `useMyMatchPreviewsQuery` returns `MatchPreviewListItem[]` with `jobId`, `overallScore`, and `band`. No new hook, no new types.

The previews query is independent of the jobs query — they fire in parallel on mount. The `JobCard` rows render as soon as `useCandidateJobsQuery` resolves; the score regions on cards that have a preview hydrate when `useMyMatchPreviewsQuery` resolves (typically first, since it's a single 25-row query against an indexed table).

### `JobCard` score region

New optional prop:

```ts
interface JobCardProps {
  // ...existing props...
  matchPreview?: {
    overallScore: number; // 0–100
    band: "strong" | "partial" | "limited";
  };
  matchPreviewLoading?: boolean; // render shimmer in score row only
}
```

Render position: a new compact row inserted **between the meta-chips row and the footer-divider** at `job-card.tsx:88` (i.e. directly above the `border-t` footer with location and salary). The card stays a single Tailwind flex column; no other layout changes.

Score row markup mirrors `RecommendedJobCard` (`_dashboard-client.tsx:869–883`):

```tsx
{
  matchPreview && (
    <div className="flex items-center gap-3">
      <MatchBandChip band={matchPreview.band} />
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-[var(--radius-pill)]"
        style={{ backgroundColor: trackColor(matchPreview.overallScore) }}
      >
        <div
          className="h-full rounded-[var(--radius-pill)]"
          style={{
            width: `${matchPreview.overallScore}%`,
            backgroundColor: fillColor(matchPreview.overallScore),
          }}
        />
      </div>
      <span className="font-mono text-xs text-[var(--color-ink)]">
        {matchPreview.overallScore}
        <span className="text-[var(--color-muted)]"> / 100</span>
      </span>
    </div>
  );
}
```

The two `…Color` helpers are the same band-to-CSS-var mapping the dashboard uses (`>= 0.7` → score-high; `>= 0.4` → score-mid; else score-low). Extract them once at the top of `job-card.tsx`; do not import from `_dashboard-client.tsx` (that file is intentionally a client-only sibling).

When `matchPreview` is absent and `matchPreviewLoading` is true, render a thin pill-shaped skeleton bar in place of the row so the card height doesn't shift when previews land:

```tsx
{
  !matchPreview && matchPreviewLoading && (
    <div className="h-1.5 w-full animate-pulse rounded-[var(--radius-pill)] bg-[var(--color-surface-soft)]" />
  );
}
```

When neither `matchPreview` nor `matchPreviewLoading` is true, the row is omitted entirely — same height as today.

### Subtitle copy on Browse Jobs

Replace the stale subtitle at `_jobs-list-client.tsx:71` with three branches:

| Condition                                                    | Subtitle                                      |
| ------------------------------------------------------------ | --------------------------------------------- |
| `previews.isLoading` (first render)                          | `"19 jobs"`                                   |
| Has at least one preview (`previews.data?.data?.length > 0`) | `"19 jobs · auto-scored against your resume"` |
| Otherwise (loaded with zero previews, or query error)        | `"19 jobs"` (silent)                          |

We deliberately do **not** add a "no resume → upload your resume" upgrade nudge in this slice. Detecting "no resume" reliably from this component requires either a second query (profile score) or a backend signal on the previews response — both out of proportion for a copy nudge, and the dashboard's existing `FirstRunWelcomeCard` already covers that path.

### `JobCard` consumers

Today only `apps/web/app/(candidate)/candidate/jobs/_jobs-list-client.tsx` imports `JobCard` (verified via `grep -n "JobCard" apps/web` at spec time). The dashboard's "Recommended for You" uses an in-file `RecommendedJobCard` and is not affected.

The new props are optional, so any future consumer that doesn't pass `matchPreview` gets identical behavior to today.

### Testing

**Unit (Vitest, jsdom — colocated next to `job-card.tsx`):**

- `JobCard renders match score row when matchPreview is present` — assert `MatchBandChip` text "Strong Match" and `76` are in the DOM, and the inline `style.width` on the fill bar is `76%`.
- `JobCard omits score row when matchPreview is absent and not loading` — assert no `MatchBandChip` and no `font-mono` score number.
- `JobCard renders skeleton when matchPreviewLoading and no matchPreview` — assert a `.animate-pulse` element is present in the score region.

E2E coverage for the candidate Browse Jobs grid does not exist today (only onboarding + proactive-system specs are wired). Adding one for this slice would require seeding `match_score_previews` fixtures from scratch — disproportionate for a presentation-only change. Defer to a future candidate-portal e2e pass.

### Performance

- One additional query (`useMyMatchPreviewsQuery`) per page load. It hits a single REST endpoint that returns at most 25 rows from an indexed query — overhead is negligible relative to the existing jobs list query.
- The Map build is O(previews.length) per render, capped at 25 entries. No memoization needed.
- No layout shift: the score region's vertical space is reserved by the loading shimmer when previews are still resolving.

### Accessibility

- The score row is decorative-supplementary to the card's existing semantics. The card remains a single `<Link>` element; the score row is rendered inside that link as plain text/visuals.
- The `MatchBandChip` already includes accessible text ("Strong Match", etc.) — no additional ARIA needed.
- The progress bar is a presentation visual paired with the numeric score immediately to its right; screen readers announce `"Strong Match 76 / 100"` as part of the link's text content.

## Migration / Rollout

- Pure additive frontend change. No DB migration, no API change, no env var.
- One commit on `dev`. No feature flag — the only "off" state is precomputed previews being absent, which falls back to today's behavior gracefully.
- No data backfill needed; precomputed previews already exist in production for any candidate who has parsed a resume since slice 2.6 shipped.

## Risks & non-risks

- **Risk:** A future `JobCard` consumer accidentally passes a stale `matchPreview` from a different role's data. **Mitigation:** prop is optional and named explicitly; only the candidate Browse Jobs path wires it.
- **Risk:** Match preview list endpoint returns more than 25 rows in the future. **Non-risk:** the Map build doesn't care about list length; a larger response simply hydrates more cards.
- **Non-risk:** Visual jitter as previews load — the loading shimmer reserves the row height.
- **Non-risk:** Cost regression — no new AI calls. The existing precompute queue is the only source of preview data this surface reads.
