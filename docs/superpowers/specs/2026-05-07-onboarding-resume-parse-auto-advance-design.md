# Onboarding Resume Parse → Auto-Advance Redesign

**Date:** 2026-05-07
**Owner:** UX polish, candidate onboarding step 1 → step 2 transition
**Status:** approved (option B — auto-advance with done-state flash; option C — replace-via-URL-param; option A — done state inside the parsing card; option A — replace link in preview pane; option A — low-confidence banner on step 2/3)
**Supersedes parts of:** [Resume Parsing Loader Redesign](./2026-05-06-resume-parsing-loader-redesign-design.md) — that spec explicitly deferred "Animating into the success card (handled separately by `ParseSuccessCard`)" as out of scope. This spec resolves that handoff by removing `ParseSuccessCard` entirely.

## Problem

The `ParseSuccessCard` interstitial on `/onboarding/candidate` (rendered when a resume parse completes) is the weakest moment in an otherwise considered onboarding flow:

1. **Redundant relative to Step 2.** Its single job is to confirm "we extracted things" via four count-chips (`3 experiences`, `1 school`, `12 skills`, `1 cert`). The brand's canonical "explainable AI" surface — the `badge-ai-suggested` pattern from `DESIGN.md` — already lives on Step 2 next to the actual prefilled values. The interstitial duplicates a concept Step 2 does better.
2. **Visual discontinuity.** The `ParsingProgressCard` builds anticipation through a four-stage progress arc with `animate-stage-check-pop` checkmarks; that arc is then cut short by a card swap to a flat "We've read your resume" panel with no closure animation on the fourth stage.
3. **Adds a click to the happy path.** The user must read the chips and click `Continue` for every successful parse, even though the next step is a fixed route. There is no decision being made on this screen.
4. **No replace-file affordance.** Once on Step 2 or Step 3, the user has no way to re-upload a different resume short of manual URL navigation back to Step 1 (which silently lands them on the same `ParseSuccessCard` again).
5. **`parse_confidence` signal goes unused.** `ParsedResumeV2.parse_confidence: "high" | "medium" | "low"` is emitted by the parsing prompt and stored on the resume row, but no surface in the UI uses it. A low-confidence parse silently pre-fills Step 2 with potentially garbled values that the AI Suggested badges implicitly endorse.

## Goal

Replace the `ParseSuccessCard` interstitial with a continuous parsing → done arc that auto-advances to Step 2, where the existing `badge-ai-suggested` pattern carries the explanation. Add a deliberate `Replace resume` affordance on the resume preview pane so users on Step 2/3 can swap files. Surface low-confidence parses as a banner above the Step 2 / Step 3 forms.

The redesign is presentation-only and routing-only: no API change, no schema change, no AI prompt change.

## Scope

### In scope

- Delete `apps/web/components/onboarding/candidate/parse-success-card.tsx`.
- Extend `ParsingProgressCard` with a `done` state that:
  - resolves the fourth stage (`Polishing the details`) to its green-check terminal style,
  - replaces the indeterminate sweep bar with a static full-width AuraHire-Blue fill,
  - renders one new `Done · ...` summary line below the four stages with the extracted counts (JetBrains Mono on numbers per design system),
  - holds for ~1500 ms then fires `onAutoAdvance`.
- Rewire `ResumeUploadCard` so its `done` branch renders `ParsingProgressCard` in done-mode (instead of `ParseSuccessCard`) and passes `onAutoAdvance` as a `router.push` to Step 2.
- Add a server-side redirect on `apps/web/app/onboarding/candidate/page.tsx`: if `latestResume.parseStatus === "parsed"` and the URL does **not** carry `?replace=1`, redirect to `/onboarding/candidate/personal` before render.
- Add a `forceIdle` prop on `ResumeUploadCard` so the page can pass it through when `?replace=1` is present, causing the dropzone to render even when a parsed resume exists.
- Add a `Replace resume` text-button to `ResumePreviewPane`, sitting next to the existing PDF/Text segmented toggle, routing to `/onboarding/candidate?replace=1`.
- Add a new `LowConfidenceBanner` component (presentational, takes `confidence: ParseConfidence`, returns `null` for `high`/`medium`).
- Render `<LowConfidenceBanner />` above the form on `apps/web/app/onboarding/candidate/personal/_client.tsx` and `apps/web/app/onboarding/candidate/review/_client.tsx`.
- Update existing tests for `ParsingProgressCard` (if any) to cover the new `done` state. Add a unit test for `LowConfidenceBanner`.

### Out of scope

- Backend changes: no new endpoints, no DTO changes, no schema migrations.
- AI prompt changes: `parse_confidence` calibration stays as-is.
- Mobile-specific replace flow — the existing `ResumeSheet` wraps `ResumePreviewPane`, so the new link is inherited automatically.
- Animation polish beyond `animate-stage-check-pop` (already shipped) plus a simple opacity fade-in for the new `Done · ...` summary line.
- Recruiter onboarding (separate flow, no parsed resume).
- Step 3 review-step copy or layout changes beyond inserting the banner above the existing layout.
- Stale-parse recovery (`ResumeStaleRecoveryCard`) — unchanged.
- Failed-parse path — unchanged (still stays on Step 1 with retry/skip buttons).
- Skip-fill-manually path — unchanged (still routes to Step 2 with no parsed data and no badges).
- Backend medium-confidence handling — explicitly excluded; only `low` triggers the banner.

## Architecture

### Component delta

| File                                                                    | Change                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/components/onboarding/candidate/parse-success-card.tsx`       | **Delete.**                                                                                                                                                                                                                                                                 |
| `apps/web/components/onboarding/candidate/parsing-progress-card.tsx`    | **Extend.** New `parseStatus` + `parsed` + `onAutoAdvance` props; new `done` visual branch.                                                                                                                                                                                 |
| `apps/web/components/onboarding/candidate/resume-upload-card.tsx`       | **Rewire.** `done` branch renders `ParsingProgressCard` with done-mode + auto-advance callback. New `forceIdle` prop. Drops `ParseSuccessCard` import.                                                                                                                      |
| `apps/web/app/onboarding/candidate/page.tsx`                            | **Redirect on parsed.** Reads `searchParams.replace`; if `latestResume.parseStatus === "parsed"` and `searchParams.replace !== "1"`, calls `redirect("/onboarding/candidate/personal")`. Otherwise passes `forceIdle={searchParams.replace === "1"}` to `ResumeUploadCard`. |
| `apps/web/components/onboarding/resume-preview/resume-preview-pane.tsx` | **Add `Replace resume` link** in the existing top-bar row alongside the PDF/Text segmented toggle. Routes to `/onboarding/candidate?replace=1`.                                                                                                                             |
| `apps/web/components/onboarding/candidate/low-confidence-banner.tsx`    | **New file.** Presentational.                                                                                                                                                                                                                                               |
| `apps/web/app/onboarding/candidate/personal/_client.tsx`                | **Wire.** Render `<LowConfidenceBanner confidence={latestResume?.parsed?.parse_confidence ?? null} />` above `<CandidatePersonalInfoForm />`.                                                                                                                               |
| `apps/web/app/onboarding/candidate/review/_client.tsx`                  | **Wire.** Same banner above `<ReviewStep />`.                                                                                                                                                                                                                               |

No other files change. No `packages/shared/`, no `apps/api/`, no `packages/db/`.

### Component contracts

#### `ParsingProgressCard`

```ts
interface ParsingProgressCardProps {
  file: { name: string; size: number; type: string } | null;
  parseStatus: "parsing" | "done";
  /** Required when parseStatus === "done"; ignored otherwise. */
  parsed: ParsedResumeV2 | null;
  /** Fired exactly once, ~1500 ms after entering "done". */
  onAutoAdvance?: () => void;
}
```

**`parsing` state:** identical to current behavior. Indeterminate sweep bar; four stages with the existing `STAGES` time curve; stage 4 (`Polishing the details`) pulses on AuraHire Blue indefinitely.

**`done` state, on entry:**

1. Stage 4 transitions from `active → done`. The existing `StageRow` component already renders `animate-stage-check-pop` when its `state` prop becomes `"done"`. The internal `activeIdx` state is force-set to `STAGES.length` (i.e. past the last index) via a `useEffect` watching `parseStatus`, which makes all four stages compute as `state === "done"`.
2. The indeterminate sweep bar (currently `<div className="animate-indeterminate-sweep h-full w-1/3 ..." />` inside a `h-[2px]` track) is replaced by a static `100%`-wide bar in `var(--color-primary)`: `<div className="h-full w-full bg-[var(--color-primary)]" />`. Track height stays 2 px.
3. A new line renders below the stage list, after a one-time 200 ms opacity fade-in:
   - High/medium confidence: `Done · {N} {experience|experiences}, {N} {school|schools}, {N} {skill|skills}, {N} {cert|certs} extracted` — counts in JetBrains Mono via `font-mono tabular-nums`. Order matches existing `ParseSuccessCard` chip order (experience → schools → skills → certs) so users moving from old to new flow see consistent terminology.
   - Low confidence: same counts, plus suffix ` · Some fields may need review` rendered in `var(--color-score-mid)`.
   - Empty categories are omitted from the line (no `0 certs` noise). If every category is zero (degenerate empty parse), the whole summary line is suppressed and the suffix `Some fields may need review` is shown alone on low confidence.
4. The card's caption above (currently `"Hang tight — this usually takes 5–15 seconds."` rendered by `ResumeUploadCard`) becomes `"Routing to your details..."` during done. Caption rendering moves into `ParsingProgressCard` so it swaps with state. `ResumeUploadCard` no longer renders this `<p>` tag.
5. `useEffect` on `parseStatus === "done"` schedules `setTimeout(onAutoAdvance, 1500)`; cleanup clears the timer on unmount or status change. The effect runs at most once per `parseStatus` transition.

#### `LowConfidenceBanner`

```ts
interface LowConfidenceBannerProps {
  confidence: ParsedResumeV2["parse_confidence"] | null;
}
```

Returns `null` unless `confidence === "low"`. Otherwise renders an amber-bordered card:

- 1px left border in `var(--color-score-mid)`, 4px wide accent.
- Background `var(--color-score-mid-soft)`.
- Lucide `AlertTriangle` icon, `var(--color-score-mid)`.
- Headline (title-sm): `Heads up — low-confidence parse`.
- Body (body-sm): `The AI wasn't sure about parts of this resume. Double-check every prefilled field before continuing.`
- Geometry: `rounded-xl`, padding 16px, single-row flex on desktop, stacked on mobile.

#### `ResumeUploadCard` (rewire)

```ts
interface ResumeUploadCardProps {
  latestResume: LatestParsedResume | null;
  accessToken: string;
  /** When true, ignore an existing parsed resume and render the dropzone. Used for the replace flow. */
  forceIdle?: boolean;
}
```

- Initial stage logic respects `forceIdle`: if `forceIdle === true`, initial `stage` is `"idle"` and initial `resume` is `null` regardless of `latestResume.parseStatus`. (The previous parsed row still exists server-side and is superseded by the new upload via existing backend behavior.)
- The `stage === "done"` branch renders:
  ```tsx
  <ParsingProgressCard
    file={activeFile}
    parseStatus="done"
    parsed={resume.parsed}
    onAutoAdvance={() => router.push("/onboarding/candidate/personal")}
  />
  ```
- Removes the `ParseSuccessCard` import entirely.
- The `Hang tight` caption is removed from this file (now lives inside `ParsingProgressCard`).

#### `apps/web/app/onboarding/candidate/page.tsx`

```ts
export default async function Step1Page({
  searchParams,
}: {
  searchParams: Promise<{ replace?: string }>;
}) {
  const { replace } = await searchParams;
  const me = await fetchCandidateProfileMe();
  if (me.profileCompleted) redirect("/candidate");

  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const latestResume = await fetchLatestParsedResume();

  // Auto-advance returning users with a parsed resume on file, unless they
  // explicitly want to replace it.
  if (latestResume?.parseStatus === "parsed" && replace !== "1") {
    redirect("/onboarding/candidate/personal");
  }

  return (
    <OnboardingShell ...>
      <ResumeUploadCard
        latestResume={latestResume}
        accessToken={session.access_token}
        forceIdle={replace === "1"}
      />
    </OnboardingShell>
  );
}
```

Note: Next.js 16 App Router `searchParams` is a Promise; the `await` shape above matches the project's existing usage.

#### `ResumePreviewPane` (add link)

The component already renders a top-bar row with a PDF/Text segmented toggle. Add:

```tsx
<Link
  href="/onboarding/candidate?replace=1"
  className="text-xs text-[var(--color-muted)] underline-offset-4 transition-colors hover:text-[var(--color-ink)] hover:underline"
>
  Replace resume
</Link>
```

Sibling of the segmented toggle, right-aligned via the existing flex row.

### Data flow

**Happy path (new candidate):**

1. User uploads PDF.
2. `ResumeUploadCard` POSTs to `/api/v1/resumes/upload`, transitions stage `idle → uploading`.
3. `ParsingProgressCard` renders in `parsing` mode, runs its time-curve animation.
4. POST resolves with `parseStatus: "parsed"` and `parsedData`.
5. `ResumeUploadCard` updates state to `stage: "done"`, passes `parsed` data into the same `ParsingProgressCard` with `parseStatus="done"`.
6. Card animates the fourth stage to done, swaps the sweep bar for a solid fill, fades in the `Done · ...` line.
7. After 1500 ms, `router.push("/onboarding/candidate/personal")` fires.
8. Step 2 renders with prefilled values + AI Suggested badges. If `parse_confidence === "low"`, the banner appears above the form.

**Returning user (already parsed):**

1. User navigates to `/onboarding/candidate`.
2. Server redirect short-circuits to `/onboarding/candidate/personal` before render.

**Replace flow (Step 2 or Step 3):**

1. User clicks `Replace resume` in `ResumePreviewPane`.
2. Browser routes to `/onboarding/candidate?replace=1`.
3. Server skips the redirect (URL param present), renders the upload screen with `forceIdle={true}`.
4. `ResumeUploadCard` ignores the existing parsed resume and shows the dropzone.
5. User uploads a new file → parsing → done → auto-advance back to Step 2 with new data.
6. Old parsed-resume row is superseded by the new one (existing backend behavior, unchanged).

**Failed parse:** Unchanged. `ResumeUploadCard` stays at `stage: "failed"` with retry/skip buttons.

**Stale parse:** Unchanged. `ResumeStaleRecoveryCard` still renders when `latestResume.parseStatus === "parsing"` on initial load and current local stage isn't `"uploading"`.

**Skip "fill manually":** Unchanged. Routes to Step 2 with no parsed data; AI Suggested badges and `LowConfidenceBanner` both render nothing.

### Edge cases

- **`?replace=1` with no existing parsed resume:** `forceIdle` is irrelevant — the dropzone would render anyway. No-op.
- **User on `?replace=1` clicks Step 1 in the wizard nav (which routes back to `/onboarding/candidate`):** Server redirect kicks in (parsed resume still exists), they land on Step 2. This is correct — they navigated away from the replace flow.
- **`parse_confidence` is `null` or undefined:** `LowConfidenceBanner` returns `null`. (The type allows for legacy resume rows from before the v2 schema.)
- **User reaches Step 2 with a low-confidence parse, then edits all suggested fields:** Banner stays — the parse confidence isn't reduced by edits. This is acceptable; the banner is about the parse itself, not the user's progress.
- **Auto-advance fires while user is rapidly clicking elsewhere:** `router.push` is idempotent; multiple invocations are harmless.
- **User refreshes during the 1500 ms hold:** Server redirect on next load takes them to Step 2 directly. They lose the "done flash" but land in the right place.

### Error handling

- If `router.push` fails (network blip, etc.), Next.js's own error boundary handles it. The done state remains visible — user can manually click anywhere or refresh.
- If the upload POST fails, `ResumeUploadCard` already handles via `stage: "failed"`. No new failure mode introduced.
- If `ParsingProgressCard` is unmounted before its 1500 ms timer fires (e.g. user navigates away via the browser back button), the cleanup function clears the timeout. No leaked timers.

## Testing

### Unit tests

- **`ParsingProgressCard.test.tsx`:**
  - With `parseStatus="parsing"`: existing behavior preserved.
  - With `parseStatus="done"` and `parsed` populated: stage 4 renders as `done` (green check), summary line `Done · ...` matches the populated counts, `onAutoAdvance` is called exactly once after 1500 ms (use `jest.useFakeTimers()` + `act` + `jest.advanceTimersByTime(1500)`).
  - With `parseStatus="done"` and `parsed.parse_confidence === "low"`: summary line includes the `Some fields may need review` suffix.
  - Empty categories (e.g. zero certifications): omitted from the summary line (no `0 certs`).
- **`LowConfidenceBanner.test.tsx`:**
  - Returns `null` for `high`, `medium`, `null`, `undefined`.
  - Renders banner with correct copy for `low`.

### Integration tests

- **Step 1 page redirect:**
  - Mock `fetchLatestParsedResume` to return `parseStatus: "parsed"`. With no `replace` query param, assert server redirect to `/onboarding/candidate/personal`.
  - Same input + `?replace=1`: assert dropzone renders.

### E2E (manual or scripted)

- Upload a known-good PDF. Verify: parsing card runs, all four stages green, summary line appears, ~1.5 s later URL is `/onboarding/candidate/personal`.
- On Step 2, click `Replace resume` in the preview pane → URL becomes `?replace=1` → dropzone renders → upload different PDF → auto-advance back to Step 2 with new prefilled values.
- Use a known low-confidence resume fixture; verify banner appears on Step 2 and Step 3.

## Out of scope (explicit)

- No backend confidence calibration.
- No new toast/notification surfaces.
- No animation polish beyond what's described above.
- No recruiter-onboarding changes.
- No mobile-only flows beyond what falls out of `ResumeSheet` wrapping `ResumePreviewPane`.

## Migration / rollout

Single PR. No feature flag — the change is presentation-only and backward-compatible with all existing parsed resume rows. The replace flow uses an additive URL param; old links with no param continue to work exactly as before (returning users now redirect, which was the intended behavior anyway).

If a regression appears, revert the PR; no data cleanup required.
