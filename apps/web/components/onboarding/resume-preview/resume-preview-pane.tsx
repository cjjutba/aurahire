"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, FileText, FileType2, RotateCcw } from "lucide-react";
import { PdfRenderer } from "./pdf-renderer";
import { LinearizedResumeView } from "./linearized-resume-view";
import type { TextLayerItem } from "./find-text-spans";
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
 *   • Parsed Text  — linearized rawText with inline highlights tied to
 *                    parsed fields. This is the default tab; it's where
 *                    candidates verify what we extracted.
 *   • Original     — PDF.js-rendered canonical PDF with NO overlay
 *                    rectangles. For DOCX uploads the backend exposes a
 *                    canonical PDF derivative, so DOCX renders here too.
 *
 * The toggle is always visible when at least one source is available; each
 * tab handles its own empty state and offers a one-click jump to the other
 * tab when its content can't render. Highlights only appear on the Parsed
 * Text view — text-layer matching against the PDF was unreliable, so the
 * Original tab is intentionally clean.
 */
export function ResumePreviewPane({
  signedPdfUrl,
  parsed,
  rawText,
  activeCategories,
  className,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);

  // Measure the always-visible pane root so the (sometimes-hidden) PDF
  // container has a width to size against — clientWidth on `display:none`
  // descendants reports 0.
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const measure = () => {
      const w = node.clientWidth;
      if (w > 0) setAvailableWidth((prev) => (prev !== w ? w : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

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
    setPdfStatus(
      totalChars < IMAGE_ONLY_PDF_THRESHOLD ? "image-only" : "rendered",
    );
  }, []);

  const onLoadError = useCallback((err: Error) => {
    if (typeof window !== "undefined") {
      // Surface the underlying PDF.js failure so we can diagnose URL/CORS/worker
      // issues from the browser console without needing a remote logger.
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

  // Default tab when the user hasn't explicitly picked: prefer Parsed Text
  // whenever it's available, falling back to the Original PDF only when
  // parsed text is missing. Once userMode is set, this whole block is
  // bypassed. Parsed Text leads because it's the highlighted, structured
  // view of what we extracted — that's the artifact the candidate cares
  // about reviewing during onboarding.
  const displayedMode: ViewMode = useMemo(() => {
    if (userMode) return userMode;
    if (parsedTextAvailable) return "text";
    return "pdf";
  }, [userMode, parsedTextAvailable]);

  // The PDF container shows only when we're on Original AND the PDF actually
  // rendered (or rendered as image-only). For loading/failed states we
  // surface a placeholder *instead of* the hidden container.
  const showPdfDocument =
    displayedMode === "pdf" &&
    (pdfStatus === "rendered" || pdfStatus === "image-only");

  // Original tab now renders the raw PDF only — no overlay rectangles.
  // Highlights live exclusively on the Parsed Text view, where matching
  // is done against the linearized text and is accurate. Attempting to
  // map highlights onto PDF.js text-layer coordinates produced false
  // positives (the wrong spans got boxed), so the Original is intentionally
  // left clean.

  return (
    <div ref={rootRef} className={className}>
      {/* Header: always-on toggle (when any source exists) + side actions. */}
      <div className="mb-3 flex items-center justify-between gap-3">
        {anyAvailable ? (
          <div
            role="tablist"
            aria-label="Resume view mode"
            className="inline-flex rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-0.5"
          >
            <ViewToggleButton
              icon={<FileText className="h-3.5 w-3.5" aria-hidden />}
              label="Parsed Text"
              selected={displayedMode === "text"}
              disabled={!parsedTextAvailable}
              disabledReason="Parsed text isn't available for this resume."
              onClick={() => setUserMode("text")}
            />
            <ViewToggleButton
              icon={<FileType2 className="h-3.5 w-3.5" aria-hidden />}
              label="Original"
              selected={displayedMode === "pdf"}
              disabled={!originalAvailable}
              disabledReason="Original document couldn't be loaded."
              onClick={() => setUserMode("pdf")}
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
          This PDF appears to be image-only. Switch to{" "}
          <strong>Parsed Text</strong> for searchable, highlighted content.
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
            availableWidth={availableWidth}
            onTextLayer={onTextLayer}
            onLoadError={onLoadError}
          />
        </div>
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
      title={disabled ? disabledReason : undefined}
      onClick={disabled ? undefined : onClick}
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
