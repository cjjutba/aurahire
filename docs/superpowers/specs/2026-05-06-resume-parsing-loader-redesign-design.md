# Resume Parsing Loader Redesign

**Date:** 2026-05-06
**Owner:** UX polish, candidate onboarding step 1
**Status:** approved (option A - stepped progress stack)

## Problem

The current loading state on `/onboarding/candidate` (after a candidate uploads a PDF/DOCX resume) is a single 32-px shimmer bar with sparkles + a caption that cycles every 1.5 s on a fixed timer. It has three visible problems:

1. The header copy "Reading your resume…" duplicates the first cycling caption inside the shimmer card - both render simultaneously.
2. Captions cycle on a wall-clock interval, completely disconnected from any real stage. A 4-second parse will never display "Almost done…"; a 14-second parse will display each caption ~2× without progressing.
3. No file context shown - the candidate has no acknowledgement that _their_ file (filename, size, format) is the one being processed.

The component also under-uses the brand: no JetBrains Mono on the file size, no editorial elevation, no use of the "explainable AI shows its work" thesis angle that the rest of the product leans into.

## Goal

Replace `ParsingShimmer` with a stepped progress stack that:

- shows the file being processed (icon + filename + size in JetBrains Mono),
- carries a thin AuraHire-Blue indeterminate progress bar at the top,
- displays four named stages with a pulsing dot → checkmark transition driven by a time curve,
- removes the duplicated header caption,
- feels institutional and calm (matches DESIGN.md tokens - single shadow tier, `{rounded.lg}` card, brand colors only).

The redesign is presentation-only: no API, schema, or backend change.

## Scope

**In scope:**

- New `ParsingProgressCard` component (replaces `ParsingShimmer`).
- Wire `ResumeUploadCard` to pass the uploaded `File` (name, size, type) into the new card.
- Remove the duplicated `<p>Reading your resume…</p>` header above the shimmer.
- Use existing brand tokens; no new color or typography tokens.

**Out of scope:**

- Backend streaming progress (SSE/long-poll). Stages are time-curve estimates client-side. (This is the same fidelity as the current shimmer - the redesign does not regress honesty; if anything it's clearer that the timing is approximate.)
- Animating into the success card (handled separately by `ParseSuccessCard`).
- Stale-parse recovery card (`ResumeStaleRecoveryCard`) - not in this scope.
- Mobile breakpoint changes beyond what falls out of existing layout.

## Design

### Layout

A single card (`{rounded.lg}` 16 px, `bg-canvas`, 1 px hairline border, padding 24 px) containing three vertical sections:

```
┌────────────────────────────────────────────────────────────┐
│  [PDF icon]  resume-2026.pdf                       320 KB  │  ← file chip row
│  ────────────────────────────────────────────────────────  │  ← indeterminate progress bar (2px, primary→primary-soft sweep)
│                                                            │
│  ●  Uploading file                                ✓        │  ← stage row (done = check)
│  ●  Extracting text                              ⟳         │  ← stage row (active = pulsing dot)
│  ○  Identifying experience & skills              ·         │  ← stage row (pending = dim dot)
│  ○  Polishing the details                        ·         │
└────────────────────────────────────────────────────────────┘
```

### File chip row

- Format icon: PDF or DOCX (Lucide `FileText`, color `{colors.body}`, 20 px). Type derived from `file.type` or extension.
- Filename: `{typography.body-md}` (16 px / 400), color `{colors.ink}`, single-line truncate.
- Size: `{typography.number-display}` (JetBrains Mono 18 px / 500), color `{colors.muted}`, right-aligned. Format as `12 KB` / `1.4 MB`.

### Indeterminate progress bar

- Height 2 px, full width, `rounded-full`, track `{colors.surface-strong}`.
- Inner: `bg-gradient-to-r from-transparent via-[var(--color-primary)] to-transparent`, width 33 %, sweeps left → right on a 1.4 s ease-in-out infinite animation. Achieved with a Tailwind keyframes definition (already standard) or inline CSS.

### Stage rows

Four stages (constants):

1. `upload` - "Uploading file" - duration: 800 ms.
2. `extract` - "Extracting text" - duration: 3500 ms.
3. `identify` - "Identifying experience & skills" - duration: 4500 ms.
4. `polish` - "Polishing the details" - open-ended (stays "active" until parent unmounts).

State machine: client-side timer advances `currentStageIndex` based on elapsed time. Each stage is one of `pending` | `active` | `done`. When `active` reaches its duration, it flips to `done` and the next stage becomes `active`. The final stage (`polish`) never auto-completes - it stays active until the parent (`ResumeUploadCard`) unmounts the loader on `parseStatus === "parsed" | "failed"`.

### Stage row visuals

Three states, from left to right: status glyph (16 px, fixed-width column) → label → trailing icon (16 px, fixed-width column).

| State   | Status glyph                                     | Label color           | Trailing icon                                |
| ------- | ------------------------------------------------ | --------------------- | -------------------------------------------- |
| done    | filled circle, `{colors.score-high}` (#10b981)   | `{colors.body}`       | `Check` (Lucide), `{colors.score-high}`      |
| active  | filled circle, `{colors.primary}`, animate-pulse | `{colors.ink}`, 600   | `Loader2` (Lucide), `{colors.primary}`, spin |
| pending | hollow circle, `{colors.hairline}`               | `{colors.muted-soft}` | small middle-dot, `{colors.muted-soft}`      |

Transitions:

- Active → done: 200 ms ease-out - glyph color cross-fades, trailing icon swaps Loader2 → Check with a 150 ms scale 0.8 → 1.0.
- Pending → active: 200 ms ease-out - same fade.

### Removed

- The `<p>Reading your resume…</p>` header and its sub-caption ("This usually takes 5-15 seconds.") in `ResumeUploadCard`. The card itself now communicates this via the file chip + active stage label.

Replace with a single small caption ABOVE the card: "Hang tight - this usually takes 5-15 seconds." in `{typography.body-sm}` `{colors.muted}`. One line, no header.

## Files affected

1. **`apps/web/components/onboarding/candidate/parsing-shimmer.tsx`** - replaced wholesale by a new component. Rename file to `parsing-progress-card.tsx` and update the export to `ParsingProgressCard`. The old default-export name is unused elsewhere except in `resume-upload-card.tsx`.

2. **`apps/web/components/onboarding/candidate/resume-upload-card.tsx`** - three changes inside the `if (stage === "uploading")` branch:
   - Replace the duplicate header pair (`Reading your resume…` + `This usually takes 5-15 seconds.`) with a single caption.
   - Pass the uploaded `File` object (or `{ name, size, type }`) to the new `ParsingProgressCard`. This requires storing the file on `handleFile` invocation - add `const [activeFile, setActiveFile] = useState<File | null>(null)`.
   - Update the import path/name.

3. **`apps/web/app/globals.css`** - add a `@keyframes` block for the indeterminate sweep if Tailwind doesn't already supply one. (Check first; Tailwind v4's default `animate-pulse` won't suffice since we want a left-to-right sweep, not opacity pulse.)

## Component API

```ts
type Stage = "upload" | "extract" | "identify" | "polish";
type StageState = "pending" | "active" | "done";

interface ParsingProgressCardProps {
  file: { name: string; size: number; type: string } | null; // null = generic placeholder
}
```

The card owns its own internal timer and state machine. It does not accept `currentStage` from outside - the time curve is the source of truth. (Future: if we add backend streaming, swap to externally-controlled `currentStage` prop.)

## Testing

- Manual: upload `01-strong-senior-engineer.pdf` (10 KB) and verify file chip displays "01-strong-senior-engineer.pdf" + "10 KB" in JetBrains Mono, four stages animate in sequence, and the card unmounts cleanly on parse success.
- Manual: trigger a parse failure (use a corrupt PDF) and verify the card unmounts to the failure state without leaving stale animations.
- Visual: inspect at 1280 px and 768 px breakpoints; the card stays single-column.
- Type-check: `pnpm --filter web exec tsc --noEmit`.

## Non-goals / explicitly rejected

- **Streaming "discoveries"** (`✓ Detected 8 years experience`) - would require backend SSE. Out of scope.
- **A "% complete" number** - we have no real progress signal from the server. Showing a fake percentage would contradict the thesis. Indeterminate bar is honest.
- **Sound / haptics** - not part of AuraHire's voice.
