"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, FileText, FileType2, RotateCcw } from "lucide-react";
import { PdfRenderer } from "./pdf-renderer";
import { HighlightOverlay, type PositionedHighlight } from "./highlight-overlay";
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
 *   • Original     — PDF.js-rendered canonical PDF with field-tied highlight
 *                    overlays. For DOCX uploads the backend exposes a canonical
 *                    PDF derivative, so DOCX renders here too.
 *   • Parsed Text  — linearized rawText with inline highlights.
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
    if (displayedMode !== "pdf" || pdfStatus !== "rendered" || pages.length === 0) {
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
          This PDF appears to be image-only — highlights aren&apos;t available
          on the document. Switch to <strong>Parsed Text</strong> for the
          highlighted content.
        </p>
      )}

      {/*
        PDF renderer. Mounted whenever a URL exists, even when Parsed Text is
        showing — this keeps the canvas + text layer warm so toggling back to
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
