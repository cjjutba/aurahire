# Onboarding Resume Preview — Always-on Original / Parsed Text Toggle

**Date:** 2026-05-08
**Owner:** UX polish, candidate onboarding (resume preview pane)
**Status:** approved (option B — always-on toggle, drop the conditional `canToggle` gate, both views keep highlights)

## Problem

`apps/web/components/onboarding/resume-preview/resume-preview-pane.tsx` is the right-pane preview shown on `/onboarding/candidate/personal` and `/onboarding/candidate/review`. It already supports two render modes:

1. **PDF** — PDF.js rasterizes the canonical PDF and overlays field-tied highlight rectangles on the text layer.
2. **Text** — `LinearizedResumeView` renders the parsed `rawText` with inline `<mark>` highlights.

The toggle between them is gated by `canToggle = hasPdf && hasText && pdfStatus !== "failed"` (line 123). When any of those conditions is false, the toggle is hidden and the pane renders whichever mode auto-routing picked. In practice that produces a single visible view with no obvious way to flip — the user reads it as "the only view available," even though the other rendering exists in code and would work if the toggle were exposed.

This is in contrast to `/candidate/resume` (post-onboarding) which always shows a 2-tab toggle (`Parsed Fields` / `PDF View`) regardless of state. Users describe the onboarding preview as "stuck" on whichever mode auto-routing chose, while the candidate resume page feels controllable. The asymmetry is the user-visible bug.

A secondary issue: the existing tab labels (`PDF`, `Text`) don't carry the user's mental model. Users think of the rendered document as "the original" and of the linearized text as "the parsed/extracted" view. Renaming during this change clarifies both tabs without adding behavior.

## Goal

Bring the onboarding resume preview to feature parity with the candidate resume page's toggle ergonomics, while preserving onboarding's evidence-first model (highlights on both views):

- The toggle is **always visible** when at least one mode is renderable.
- Each tab handles its own unavailable state with a graceful empty-state and a one-click jump to the other tab.
- Tab labels read as **Original** (the rendered document — PDF for both PDF and DOCX uploads, since DOCX uploads expose a canonical PDF derivative) and **Parsed Text** (the linearized text view).
- Highlight behavior on both tabs is unchanged — same field IDs, same active-category fade, same hover pulse.
- Default tab on first render uses today's auto-routing (prefer Original when PDF rendered; otherwise Parsed Text). User override sticks.

This is presentation-only — no backend, no data-flow, no schema, no new dependencies. Only the preview pane component changes.

## Scope

**In scope:**

- Edit `apps/web/components/onboarding/resume-preview/resume-preview-pane.tsx`:
  - Drop the `canToggle` conditional; render the toggle whenever the pane has data to show.
  - Rename the tab labels (`PDF` → `Original`, `Text` → `Parsed Text`).
  - Disable the tab button for any mode whose source is genuinely unavailable.
  - Replace the silent fallback with an explicit empty state inside each tab when that tab's content can't render, and surface a "View [other tab]" affordance.
  - Keep the existing image-only banner; show it only on the Original tab.
  - Keep the existing header right-side actions (`Replace resume`, `Open` external link).

**Out of scope:**

- The `/candidate/resume` page (`_resume-client.tsx`). It stays as-is — its 2-tab Parsed Fields / PDF View pattern is correct for that surface.
- Any change to `pdf-renderer.tsx`, `highlight-overlay.tsx`, `linearized-resume-view.tsx`, `derive-highlights.ts`, `find-text-spans.ts`, or `highlight-context.tsx`.
- Any change to `personal/_client.tsx`, `review/_client.tsx`, `personal/_data.ts`, or `review/_data.ts` — the props passed to `ResumePreviewPane` are already correct.
- Backend changes (no new fields on `LatestParsedResume`).
- Mobile sheet (`components/onboarding/mobile/resume-sheet.tsx`) — it forwards children, so it inherits the change for free.
- Adding a structured-cards "Parsed Fields" tab to onboarding (rejected as Option A; would not show highlights and duplicates the form).

## Design

### Component contract

`ResumePreviewPane` keeps its existing props shape:

```ts
interface Props {
  signedPdfUrl: string | null;
  parsed: ParsedResumeV2 | null;
  rawText: string | null;
  activeCategories: readonly HighlightCategory[];
  className?: string;
}
```

No new props are required. All four are already produced by `_data.ts` for both the `personal` and `review` steps.

### Tab availability

Two derived booleans drive both the tab disabled-states and the empty-state copy:

| Source                | Available when                          |
| --------------------- | --------------------------------------- |
| `originalAvailable`   | `hasPdf && pdfStatus !== "failed"`      |
| `parsedTextAvailable` | `hasText` (i.e. `rawText` is non-empty) |

Both are computed alongside the existing `hasPdf` / `hasText`. `pdfStatus === "image-only"` still counts as `originalAvailable === true` — the document renders, even though highlights can't pin to specific spans on it. The image-only banner explains this.

### State matrix

**Original tab:**

| Condition                             | Render                                                                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pdfStatus === "loading"`             | "Loading preview…" — same loading box used today                                                                                                                                      |
| `pdfStatus === "rendered"`            | PDF + `HighlightOverlay` (existing)                                                                                                                                                   |
| `pdfStatus === "image-only"`          | PDF + small banner: _"This PDF appears to be image-only — highlights aren't available on the document. Switch to **Parsed Text** for highlighted content."_ (existing copy, retained) |
| `pdfStatus === "failed"` or `!hasPdf` | Empty state: _"We couldn't render the original document."_ + button "View Parsed Text" (sets `userMode = "text"`). Disabled if Parsed Text also unavailable.                          |

**Parsed Text tab:**

| Condition  | Render                                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hasText`  | `LinearizedResumeView` (existing)                                                                                                                        |
| `!hasText` | Empty state: _"Parsed text isn't available for this resume."_ + button "View Original" (sets `userMode = "pdf"`). Disabled if Original also unavailable. |

**Both unavailable:** existing "No resume preview available." takes precedence — the pane never enters this state with neither source.

### Default tab on first render

Existing `effectiveMode` auto-routing is preserved for the _initial_ selected tab:

1. `userMode` set → user's pick wins.
2. Otherwise prefer `pdf` when `pdfStatus === "rendered"`.
3. Image-only PDF → `text` if available, else `pdf`.
4. Failed / missing PDF → `text` if available, else show empty pane.

The change is structural: instead of conditionally rendering the toggle, always render it; let the user pick freely. `userMode` already exists and persists per-render; no new state.

### Header layout

Today's header (`mb-3 flex items-center justify-between gap-3`):

- Left: **toggle** (when `canToggle`) or label "Your resume" (otherwise).
- Right: `Replace resume` link + `Open` external link.

After change:

- Left: **toggle**, always rendered when at least one tab is available; the "Your resume" label is removed.
- Right: unchanged.

The toggle pill uses the existing `ViewToggleButton` component; only the labels change. Disabled state on a tab button is `cursor-not-allowed` + `opacity-40` + a `title` tooltip explaining why ("PDF couldn't be loaded" / "Parsed text isn't available").

### Empty-state component

A small inline component, defined inside the pane file (not a new shared file):

```tsx
function PreviewEmptyState({
  icon,
  message,
  ctaLabel,
  onCta,
  ctaDisabled,
}: {
  icon: React.ReactNode;
  message: string;
  ctaLabel: string;
  onCta: () => void;
  ctaDisabled: boolean;
}) {
  /* ... */
}
```

Visual: same surface tokens as the loading box (`rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5`), centered icon + text + a small text-button styled with `{colors.primary}`. Disabled CTA renders the message without the button.

### Highlight behavior (unchanged)

The `HighlightOverlay` mounts only when `effectiveMode === "pdf"` and pages are ready (today's behavior). The PDF renderer remains mounted-but-hidden when the user is on Parsed Text (today's `display: none` trick), so flipping back to Original is instant.

`LinearizedResumeView` continues to render `<mark>` spans for each highlight whose `source` substring is found in `rawText`. Click on a highlight calls `focusField(fieldRef)` from `useHighlightContext()` — the form field on the left scrolls into view and focuses, identical to today.

### DOCX uploads

The candidate may upload a `.docx`. Today, `_data.ts` already calls `/api/v1/resumes/{id}/download-url` which returns a `signedPdfUrl` referencing the **canonical PDF derivative** the backend generates from the DOCX. So:

- The Original tab renders the _canonical PDF_ (not the raw DOCX). PDF.js can read it, highlights work, identical UX to a PDF upload.
- If the canonical-PDF derivative is missing for any reason, `signedPdfUrl` is null, `originalAvailable` is false, and the user sees the empty state with "View Parsed Text."

No DOCX-specific code path is added — this is the same pipeline the pane uses today. The user's request "highlights on PDF/DOCX original" is satisfied by exposing the always-on toggle: when the underlying canonical PDF renders, highlights appear; when it doesn't, the empty state directs them to Parsed Text.

## Visual reference

Tab toggle (existing component, only labels change):

```
┌───────────────────────────────┐  ┌───────────────────────────────┐
│  ⓘ Original  │  ✏ Parsed Text │  │  ⓘ Original  │  ✏ Parsed Text │
│  ────────────                 │  │              │  ────────────  │
└───────────────────────────────┘  └───────────────────────────────┘
       Original selected                     Parsed Text selected
```

Empty state inside Original tab when PDF failed:

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│             📄                                       │
│      We couldn't render the original document.       │
│                                                      │
│            [ View Parsed Text → ]                    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## Failure modes

| Failure                                                   | User-visible result                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| PDF.js worker fails to load                               | Original tab shows empty state. Parsed Text tab works. Toggle still visible.    |
| PDF is image-only                                         | Original tab renders PDF + image-only banner. Parsed Text tab shows highlights. |
| Backend returns no `signedPdfUrl`                         | Original tab disabled with tooltip. Parsed Text tab default.                    |
| Backend returns empty `rawText`                           | Parsed Text tab disabled. Original tab default.                                 |
| Both empty                                                | Pane shows "No resume preview available." (unchanged)                           |
| User on Original, then switches to Parsed Text, then back | Instant — PDF.js stays mounted under `display: none`.                           |

## Testing

**Existing automated tests stay green:**

- `derive-highlights.test.ts` — highlight derivation logic (untouched).
- `find-text-spans.test.ts` — text-layer span search (untouched).

**Manual verification (the human runs):**

1. Upload a normal text-PDF → toggle visible, Original is default, both tabs render highlights.
2. Upload an image-only PDF → toggle visible, Original shows banner, Parsed Text is highlighted.
3. Upload a DOCX → backend's canonical PDF appears in Original; both tabs work.
4. Force `signedPdfUrl` to null (simulate broken backend) → Original tab disabled, empty state with CTA to Parsed Text.
5. Force `rawText` to empty (simulate parse mid-flight) → Parsed Text tab disabled, empty state with CTA to Original.
6. Hover a form field on the left → highlights pulse on whichever tab is active. Switch tabs → highlights remain pulsing on the new tab.
7. Click a highlight → corresponding form field receives focus. Works on both tabs.
8. Mobile sheet (`<resume-sheet>`) → toggle is reachable, both states render correctly inside the sheet.

## Rollout

- Single component edit in a single PR. No feature flag, no migration, no env change.
- `/candidate/resume` is intentionally untouched — the asymmetry is by design (post-onboarding context vs. onboarding evidence-first context).

## Out-of-scope follow-ups

These are real but not part of this change:

- Adding a structured-cards "Parsed Fields" tab to onboarding (Option A from brainstorming). Rejected because it can't host highlights and duplicates the form below it.
- Supporting native DOCX preview (no PDF derivative). The current canonical-PDF pipeline is sufficient for sprint scope.
- Highlights on the post-onboarding `/candidate/resume` page. The pages serve different purposes (evidence vs. management); not unifying them is an explicit design choice.
