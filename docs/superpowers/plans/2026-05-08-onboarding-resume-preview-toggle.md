# Onboarding Resume Preview - Always-on Original / Parsed Text Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the onboarding resume preview pane to feature parity with `/candidate/resume` toggle ergonomics: always show a 2-tab toggle (`Original` / `Parsed Text`), let either tab render its own empty state with a one-click jump to the other tab, and keep highlights working on both tabs.

**Architecture:** Single-file change to `apps/web/components/onboarding/resume-preview/resume-preview-pane.tsx`. Replace the conditional `canToggle` gate with always-on tab rendering, add per-tab empty states via a small inline `PreviewEmptyState` helper, and extend `ViewToggleButton` to support a disabled state with a tooltip. Auto-routing logic for the default tab is preserved; `userMode` override behavior is preserved; `HighlightOverlay` and `LinearizedResumeView` are untouched.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 + brand CSS variables (`var(--color-*)`, `var(--radius-*)`), `lucide-react` (already a dep), `pdfjs-dist` (already a dep). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-08-onboarding-resume-preview-toggle-design.md` is authoritative for behavior, tokens, and out-of-scope decisions. When in doubt, defer to that spec.

---

## File Structure

### Modified file

- `apps/web/components/onboarding/resume-preview/resume-preview-pane.tsx` - the only file touched.

### Untouched (intentionally)

- `apps/web/components/onboarding/resume-preview/pdf-renderer.tsx` - PDF.js wrapper, no changes needed.
- `apps/web/components/onboarding/resume-preview/highlight-overlay.tsx` - overlay logic unchanged.
- `apps/web/components/onboarding/resume-preview/linearized-resume-view.tsx` - text-fallback view unchanged.
- `apps/web/components/onboarding/resume-preview/highlight-context.tsx` - context unchanged.
- `apps/web/components/onboarding/resume-preview/derive-highlights.ts` - highlight derivation unchanged.
- `apps/web/components/onboarding/resume-preview/find-text-spans.ts` - text-span search unchanged.
- `apps/web/app/onboarding/candidate/personal/_client.tsx` - already passes the right props.
- `apps/web/app/onboarding/candidate/review/_client.tsx` - already passes the right props.
- `apps/web/components/onboarding/mobile/resume-sheet.tsx` - forwards children, inherits the change.
- `apps/web/app/(candidate)/candidate/resume/_resume-client.tsx` - `/candidate/resume` is intentionally untouched.

### No new files

The `PreviewEmptyState` helper is local to `resume-preview-pane.tsx` (single consumer; YAGNI). No new hook, no new util.

---

## Conventions used in every step

- **Brand tokens only:** `var(--color-primary)`, `var(--color-on-primary)`, `var(--color-primary-soft)`, `var(--color-ink)`, `var(--color-body)`, `var(--color-muted)`, `var(--color-canvas)`, `var(--color-hairline)`. No raw hex.
- **Radius tokens:** `var(--radius-pill)` for buttons. The existing `rounded-lg` (16 px) on the empty/loading containers stays as-is.
- **No new imports:** all needed icons (`ExternalLink`, `FileText`, `FileType2`, `RotateCcw`) already imported. No need to import anything new from `lucide-react`.
- **Strict TS:** no `any`, no `as` casts beyond what already exists.
- **Styling pattern:** continue using array `.join(" ")` for conditional className composition (the file already uses this in `ViewToggleButton`).

---

## Task 1: Replace ResumePreviewPane with always-on toggle + per-tab empty states

**Files:**

- Modify: `apps/web/components/onboarding/resume-preview/resume-preview-pane.tsx`

**What:** Rewrites the component so the toggle is always visible whenever any preview source exists; each tab renders either its content or an empty-state with a one-click jump to the other tab; tab buttons disable when their source is unavailable; existing highlight + warm-PDF behavior is preserved.

- [ ] **Step 1: Confirm current file state**

Run:

```bash
wc -l apps/web/components/onboarding/resume-preview/resume-preview-pane.tsx
```

Expected output: `267 apps/web/components/onboarding/resume-preview/resume-preview-pane.tsx` (or close to it - confirms you're working against the same starting point as the plan).

Read lines 1-60 to verify the imports and prop shape match what you're about to replace:

```bash
sed -n '1,60p' apps/web/components/onboarding/resume-preview/resume-preview-pane.tsx
```

The first 12 lines should import from `./pdf-renderer`, `./highlight-overlay`, `./linearized-resume-view`, `./find-text-spans`, `./derive-highlights`, and `@/app/onboarding/candidate/_steps`. The `Props` interface should have `signedPdfUrl`, `parsed`, `rawText`, `activeCategories`, `className`. If any of these differ, stop and reconcile with the spec before continuing.

- [ ] **Step 2: Replace the entire file with the new implementation**

Write `apps/web/components/onboarding/resume-preview/resume-preview-pane.tsx` with this exact content:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, FileText, FileType2, RotateCcw } from "lucide-react";
import { PdfRenderer } from "./pdf-renderer";
import {
  HighlightOverlay,
  type PositionedHighlight,
} from "./highlight-overlay";
import { LinearizedResumeView } from "./linearized-resume-view";
import { findTextSpans, type TextLayerItem } from "./find-text-spans";
import { deriveHighlights, type HighlightCategory } from "./derive-highlights";
import type { ParsedResumeV2 } from "@/app/onboarding/candidate/_steps";

interface Props {
  signedPdfUrl: string | null;
  parsed: ParsedResumeV2 | null;
  rawText: string | null;
  activeCategories: readonly HighlightCategory[];
  className?: string;
}

type PdfStatus = "loading" | "rendered" | "image-only" | "failed";
type ViewMode = "pdf" | "text";

const IMAGE_ONLY_PDF_THRESHOLD = 50;

/**
 * Right-pane resume preview shown on `/onboarding/candidate/personal` and
 * `/onboarding/candidate/review`. Two tabs:
 *
 *   • Original     - PDF.js-rendered canonical PDF with field-tied highlight
 *                    overlays. For DOCX uploads the backend exposes a canonical
 *                    PDF derivative, so DOCX renders here too.
 *   • Parsed Text  - linearized rawText with inline highlights.
 *
 * The toggle is always visible when at least one source is available; each
 * tab handles its own empty state and offers a one-click jump to the other
 * tab when its content can't render. Highlight behavior (active categories,
 * hover pulse, click-to-focus-field) is identical on both tabs.
 */
export function ResumePreviewPane({
  signedPdfUrl,
  parsed,
  rawText,
  activeCategories,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pageContainers, setPageContainers] = useState<HTMLElement[]>([]);
  const [pages, setPages] = useState<TextLayerItem[][]>([]);

  const hasPdf = !!signedPdfUrl;
  const hasText = !!rawText && rawText.trim().length > 0;

  const [pdfStatus, setPdfStatus] = useState<PdfStatus>(
    hasPdf ? "loading" : "failed",
  );
  // null = let auto-routing decide; "pdf" | "text" = explicit user override.
  const [userMode, setUserMode] = useState<ViewMode | null>(null);

  const highlights = useMemo(() => deriveHighlights(parsed), [parsed]);

  const onTextLayer = useCallback((pgs: TextLayerItem[][]) => {
    const totalChars = pgs.flat().reduce((sum, it) => sum + it.str.length, 0);
    setPages(pgs);
    setPdfStatus(
      totalChars < IMAGE_ONLY_PDF_THRESHOLD ? "image-only" : "rendered",
    );
  }, []);

  const onLoadError = useCallback((err: Error) => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console -- diagnostic for client-side PDF render failures
      console.warn("[resume-preview] PDF load failed:", err);
    }
    setPdfStatus("failed");
  }, []);

  // Per-tab availability. Used both to disable tab buttons and to decide
  // whether each tab renders content or an empty state.
  const originalAvailable = hasPdf && pdfStatus !== "failed";
  const parsedTextAvailable = hasText;
  const anyAvailable = originalAvailable || parsedTextAvailable;

  // Default tab when the user hasn't explicitly picked. Auto-flips as
  // pdfStatus transitions (loading → rendered → image-only/failed). Once
  // userMode is set, this whole block is bypassed.
  const displayedMode: ViewMode = useMemo(() => {
    if (userMode) return userMode;
    if (pdfStatus === "rendered") return "pdf";
    if (pdfStatus === "loading") return hasPdf ? "pdf" : "text";
    if (pdfStatus === "image-only") return parsedTextAvailable ? "text" : "pdf";
    // failed
    return parsedTextAvailable ? "text" : "pdf";
  }, [userMode, pdfStatus, hasPdf, parsedTextAvailable]);

  // The PDF container shows only when we're on Original AND the PDF actually
  // rendered (or rendered as image-only). For loading/failed states we
  // surface a placeholder *instead of* the hidden container.
  const showPdfDocument =
    displayedMode === "pdf" &&
    (pdfStatus === "rendered" || pdfStatus === "image-only");

  // Compute highlight rects whenever Original is shown AND the PDF rendered.
  const positioned: PositionedHighlight[] = useMemo(() => {
    if (
      displayedMode !== "pdf" ||
      pdfStatus !== "rendered" ||
      pages.length === 0
    ) {
      return [];
    }
    const out: PositionedHighlight[] = [];
    for (let p = 0; p < pages.length; p++) {
      for (const h of highlights) {
        const rects = findTextSpans(pages[p]!, h.source);
        if (rects) out.push({ ...h, pageIndex: p, rects });
      }
    }
    return out;
  }, [displayedMode, pdfStatus, pages, highlights]);

  // Re-collect page containers whenever Original becomes the rendered tab.
  useEffect(() => {
    if (!showPdfDocument) return;
    if (!containerRef.current) return;
    const nodes = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(":scope > div"),
    );
    setPageContainers(nodes);
  }, [showPdfDocument]);

  return (
    <div className={className}>
      {/* Header: always-on toggle (when any source exists) + side actions. */}
      <div className="mb-3 flex items-center justify-between gap-3">
        {anyAvailable ? (
          <div
            role="tablist"
            aria-label="Resume view mode"
            className="inline-flex rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-0.5"
          >
            <ViewToggleButton
              icon={<FileType2 className="h-3.5 w-3.5" aria-hidden />}
              label="Original"
              selected={displayedMode === "pdf"}
              disabled={!originalAvailable}
              disabledReason="Original document couldn't be loaded."
              onClick={() => setUserMode("pdf")}
            />
            <ViewToggleButton
              icon={<FileText className="h-3.5 w-3.5" aria-hidden />}
              label="Parsed Text"
              selected={displayedMode === "text"}
              disabled={!parsedTextAvailable}
              disabledReason="Parsed text isn't available for this resume."
              onClick={() => setUserMode("text")}
            />
          </div>
        ) : (
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">
            Your resume
          </span>
        )}
        <div className="flex items-center gap-3">
          <Link
            href="/onboarding/candidate?replace=1"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Replace resume
          </Link>
          {hasPdf && signedPdfUrl && (
            <a
              href={signedPdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
              aria-label="Open original PDF in a new tab"
            >
              Open
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </div>
      </div>

      {/* No source available at all. */}
      {!anyAvailable && (
        <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5 text-sm text-[var(--color-muted)]">
          No resume preview available.
        </div>
      )}

      {/* Original tab content (when selected). The PDF document itself is
          rendered separately below (kept mounted to stay warm). */}
      {anyAvailable && displayedMode === "pdf" && (
        <>
          {pdfStatus === "loading" && hasPdf && (
            <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5 text-sm text-[var(--color-muted)]">
              Loading preview…
            </div>
          )}
          {(pdfStatus === "failed" || !hasPdf) && (
            <PreviewEmptyState
              message="We couldn't render the original document."
              ctaLabel="View Parsed Text"
              onCta={() => setUserMode("text")}
              ctaDisabled={!parsedTextAvailable}
            />
          )}
        </>
      )}

      {/* Parsed Text tab content (when selected). */}
      {anyAvailable && displayedMode === "text" && (
        <>
          {hasText ? (
            <LinearizedResumeView
              rawText={rawText!}
              highlights={highlights}
              activeCategories={activeCategories}
            />
          ) : (
            <PreviewEmptyState
              message="Parsed text isn't available for this resume."
              ctaLabel="View Original"
              onCta={() => setUserMode("pdf")}
              ctaDisabled={!originalAvailable}
            />
          )}
        </>
      )}

      {/* Image-only banner (Original tab, image-only PDFs only). */}
      {displayedMode === "pdf" && pdfStatus === "image-only" && (
        <p className="mt-3 rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-xs text-[var(--color-muted)]">
          This PDF appears to be image-only - highlights aren&apos;t available
          on the document. Switch to <strong>Parsed Text</strong> for the
          highlighted content.
        </p>
      )}

      {/*
        PDF renderer. Mounted whenever a URL exists, even when Parsed Text is
        showing - this keeps the canvas + text layer warm so toggling back to
        Original is instant. Hidden via display:none when not visible.
      */}
      {hasPdf && (
        <div
          ref={containerRef}
          className={showPdfDocument ? "block" : "hidden"}
        >
          <PdfRenderer
            url={signedPdfUrl!}
            onTextLayer={onTextLayer}
            onLoadError={onLoadError}
          />
        </div>
      )}

      {showPdfDocument &&
        pdfStatus === "rendered" &&
        pageContainers.length > 0 &&
        positioned.length > 0 && (
          <HighlightOverlay
            highlights={positioned}
            activeCategories={activeCategories}
            pageContainers={pageContainers}
          />
        )}
    </div>
  );
}

function PreviewEmptyState({
  message,
  ctaLabel,
  onCta,
  ctaDisabled,
}: {
  message: string;
  ctaLabel: string;
  onCta: () => void;
  ctaDisabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-8 text-center">
      <FileText className="h-6 w-6 text-[var(--color-muted)]" aria-hidden />
      <p className="text-sm text-[var(--color-body)]">{message}</p>
      {!ctaDisabled && (
        <button
          type="button"
          onClick={onCta}
          className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)] hover:text-[var(--color-on-primary)]"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

function ViewToggleButton({
  icon,
  label,
  selected,
  disabled,
  disabledReason,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-disabled={disabled}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition-colors",
        disabled
          ? "cursor-not-allowed text-[var(--color-muted)] opacity-40"
          : selected
            ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
            : "text-[var(--color-body)] hover:text-[var(--color-ink)]",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:

```bash
pnpm --filter @aurahire/web type-check
```

Expected: exits 0 with no errors. If you see "Cannot find module" errors for `./pdf-renderer`, `./highlight-overlay`, etc., you mistyped one of the relative imports - re-check Step 2's import block byte-for-byte. If you see "Property '...' does not exist on type 'Props'" errors, you broke the consumer prop contract - `signedPdfUrl`, `parsed`, `rawText`, `activeCategories`, `className` must all stay.

- [ ] **Step 4: Verify ESLint passes**

Run:

```bash
pnpm --filter @aurahire/web lint
```

Expected: exits 0. Common failures and fixes:

- `react/no-unescaped-entities` on the apostrophe in "aren't" → already handled by `aren&apos;t` in the image-only banner.
- `@typescript-eslint/no-unused-vars` on an import → remove the unused import (don't suppress).
- `react-hooks/exhaustive-deps` warning on `useEffect` or `useMemo` → add the missing dep, do not suppress.

- [ ] **Step 5: Verify existing unit tests still pass**

Run:

```bash
pnpm --filter @aurahire/web test -- --run resume-preview
```

Expected: both `find-text-spans.test.ts` and `derive-highlights.test.ts` pass. The component itself has no tests in the repo - that's intentional per the spec (the change is conditional render + copy; the underlying highlight math is unchanged and remains covered by the helper tests).

If a test fails: stop. Do not "fix the test" - diagnose whether the change unintentionally touched derived data. Revert the file and reconcile with the spec.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/onboarding/resume-preview/resume-preview-pane.tsx
git commit -m "$(cat <<'EOF'
feat(onboarding): always-on Original/Parsed Text toggle on resume preview

Drop the canToggle gate and render both tabs unconditionally when any
preview source exists. Each tab handles its own empty state with a
one-click jump to the other tab; tab buttons disable when their source
is unavailable. Rename labels (PDF → Original, Text → Parsed Text) to
match the user mental model. Highlight behavior on both tabs unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds, hooks (if any) pass.

---

## Task 2: Manual verification handoff

**Files:** none - verification only.

**What:** The dev server isn't startable from this session (per CLAUDE.md, the human runs all servers). Hand the change off for manual verification covering each branch of the new state matrix.

- [ ] **Step 1: Ask the human to start the dev stack**

Tell the human:

> Implementation is committed. Please start the dev stack (`pnpm dev` from the repo root, with the docker-compose Mailpit + Redis already running per `docs/main/env-setup.md` Step 5) and walk through the onboarding flow at `http://localhost:3000/onboarding/candidate/personal` (and `/review`). Walk through these scenarios and report what you see.

- [ ] **Step 2: Verification scenarios**

For each scenario the human should report `✅` (matches spec) or describe the deviation:

1. **Normal text-PDF resume.** Upload a standard PDF resume during onboarding.
   - Toggle visible with both tabs enabled.
   - `Original` is the default; PDF renders with blue highlight rectangles on extracted fields.
   - Click `Parsed Text` → linearized text appears with inline highlights.
   - Click `Original` again → instant flip back to PDF (no re-render flash).

2. **Image-only PDF.** Upload a scanned/image-only PDF.
   - Toggle visible.
   - On Original: PDF renders below a small banner: _"This PDF appears to be image-only - highlights aren't available on the document. Switch to Parsed Text for the highlighted content."_
   - On Parsed Text: highlights work as expected.

3. **DOCX upload.** Upload a `.docx` resume.
   - Backend's canonical-PDF derivative appears on Original with highlights overlaid.
   - Parsed Text also works.
   - If the canonical PDF is missing, Original is disabled (greyed) with tooltip; default tab is Parsed Text.

4. **Broken PDF URL.** (Simulate by intercepting `/api/v1/resumes/{id}/download-url` in DevTools to return null `signedPdfUrl`, or by using a known-bad resume.)
   - Toggle visible.
   - Original tab disabled with tooltip "Original document couldn't be loaded."
   - Parsed Text is the default and renders.

5. **Empty rawText.** (Rare - simulate by editing the parsed resume row in DB to have empty `rawText`.)
   - Toggle visible.
   - Parsed Text tab disabled with tooltip.
   - Original tab is the default.

6. **Hover form field on the left.**
   - On Original: corresponding highlight rectangle on the PDF pulses with a primary outline.
   - On Parsed Text: corresponding `<mark>` span pulses identically.

7. **Click a highlight.**
   - On either tab, clicking the highlight scrolls the matching form field into view and focuses it.

8. **Mobile sheet.** Resize to <1024px and open the resume sheet.
   - Toggle is reachable inside the sheet, all states render correctly.

If any scenario fails, the human should attach a screenshot of the deviation and the browser console, then ask for a follow-up patch.

---

## Self-review

This section is my (the planner's) check, run before handing the plan off.

**1. Spec coverage:**

| Spec section                                                                                      | Plan task                                                                             |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| "Drop the `canToggle` conditional"                                                                | Task 1 / Step 2 - `anyAvailable` replaces `canToggle`; toggle renders unconditionally |
| "Rename tab labels"                                                                               | Task 1 / Step 2 - `Original` and `Parsed Text` literal labels                         |
| "Disable tab button when source unavailable"                                                      | Task 1 / Step 2 - `ViewToggleButton` accepts `disabled` + `disabledReason`            |
| "Empty state with CTA to other tab"                                                               | Task 1 / Step 2 - `PreviewEmptyState` helper + per-tab branches                       |
| "Image-only banner only on Original"                                                              | Task 1 / Step 2 - banner gated by `displayedMode === "pdf"`                           |
| "Default tab uses existing auto-routing; userMode wins"                                           | Task 1 / Step 2 - `displayedMode` useMemo preserves the auto-routing chain            |
| "PDF renderer stays mounted to keep state warm"                                                   | Task 1 / Step 2 - container kept under `display:none` via `showPdfDocument` flag      |
| "Header right-side actions unchanged"                                                             | Task 1 / Step 2 - `Replace resume` Link + `Open` external link preserved              |
| "DOCX uses canonical-PDF derivative; no DOCX-specific code"                                       | Task 1 / Step 2 - same `signedPdfUrl` path; no branch added                           |
| "Existing unit tests stay green"                                                                  | Task 1 / Step 5                                                                       |
| "Manual verification scenarios"                                                                   | Task 2 / Step 2                                                                       |
| Out-of-scope - `/candidate/resume`, structured-cards tab, native DOCX, post-onboarding highlights | "Untouched (intentionally)" + "No new files"                                          |

**2. Placeholder scan:** Plan contains complete code for the file rewrite (no "fill in"), exact commands for typecheck/lint/test/commit (no "run the appropriate tests"), exact failure-mode hints in Steps 3-5. No "TBD," no "similar to," no "handle edge cases" without showing how.

**3. Type consistency:** `ViewMode` (line in code: `type ViewMode = "pdf" | "text"`) is used identically by `userMode`, `displayedMode`, and `setUserMode`. `PdfStatus` literals are used consistently in `useState<PdfStatus>`, `setPdfStatus(...)`, and the `displayedMode` switch. `PreviewEmptyState`'s prop names (`message`, `ctaLabel`, `onCta`, `ctaDisabled`) match all four call sites. `ViewToggleButton`'s new props (`disabled`, `disabledReason`) match both call sites.
