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
type EffectiveMode = ViewMode | "loading" | "empty";

const IMAGE_ONLY_PDF_THRESHOLD = 50;

/**
 * Right-pane resume preview. Renders the *actual uploaded PDF* by default,
 * with parsed-data highlight overlays placed over the PDF.js text layer.
 * Falls back to a linearized text view when:
 *   - the signed PDF URL is missing,
 *   - PDF.js fails to load the document, or
 *   - the document is image-only (no extractable text layer).
 *
 * Users can flip between PDF and Text manually via the segmented toggle.
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
    // Surface the underlying PDF.js failure so we can diagnose URL/CORS/worker
    // issues from the browser console without needing a remote logger.
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console -- diagnostic for client-side PDF render failures
      console.warn("[resume-preview] PDF load failed:", err);
    }
    setPdfStatus("failed");
  }, []);

  const effectiveMode: EffectiveMode = useMemo(() => {
    if (!hasPdf && !hasText) return "empty";

    if (userMode === "text") {
      return hasText ? "text" : "empty";
    }
    if (userMode === "pdf") {
      if (!hasPdf) return hasText ? "text" : "empty";
      if (pdfStatus === "loading") return "loading";
      if (pdfStatus === "failed") return hasText ? "text" : "empty";
      return "pdf";
    }

    // Auto: prefer PDF, fall back to text on failure / image-only.
    if (!hasPdf) return hasText ? "text" : "empty";
    if (pdfStatus === "loading") return "loading";
    if (pdfStatus === "rendered") return "pdf";
    if (pdfStatus === "image-only") {
      return hasText ? "text" : "pdf";
    }
    return hasText ? "text" : "empty";
  }, [hasPdf, hasText, userMode, pdfStatus]);

  // Compute highlight rects whenever PDF view is active and pages are ready.
  const positioned: PositionedHighlight[] = useMemo(() => {
    if (effectiveMode !== "pdf" || pages.length === 0) return [];
    const out: PositionedHighlight[] = [];
    for (let p = 0; p < pages.length; p++) {
      for (const h of highlights) {
        const rects = findTextSpans(pages[p]!, h.source);
        if (rects) out.push({ ...h, pageIndex: p, rects });
      }
    }
    return out;
  }, [effectiveMode, pages, highlights]);

  // Re-collect page containers whenever PDF view becomes active.
  useEffect(() => {
    if (effectiveMode !== "pdf") return;
    if (!containerRef.current) return;
    const nodes = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(":scope > div"),
    );
    setPageContainers(nodes);
  }, [effectiveMode]);

  const canToggle = hasPdf && hasText && pdfStatus !== "failed";
  const displayedMode: ViewMode =
    userMode ?? (effectiveMode === "pdf" ? "pdf" : "text");
  const showImageOnlyHint =
    effectiveMode === "pdf" && pdfStatus === "image-only";

  return (
    <div className={className}>
      {/* Header row: toggle (when both modes usable) or label, plus replace + open affordances. */}
      <div className="mb-3 flex items-center justify-between gap-3">
        {canToggle ? (
          <div
            role="tablist"
            aria-label="Resume view mode"
            className="inline-flex rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-0.5"
          >
            <ViewToggleButton
              icon={<FileType2 className="h-3.5 w-3.5" aria-hidden />}
              label="PDF"
              selected={displayedMode === "pdf"}
              onClick={() => setUserMode("pdf")}
            />
            <ViewToggleButton
              icon={<FileText className="h-3.5 w-3.5" aria-hidden />}
              label="Text"
              selected={displayedMode === "text"}
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

      {effectiveMode === "loading" && (
        <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5 text-sm text-[var(--color-muted)]">
          Loading preview…
        </div>
      )}

      {effectiveMode === "empty" && (
        <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5 text-sm text-[var(--color-muted)]">
          No resume preview available.
        </div>
      )}

      {effectiveMode === "text" && hasText && (
        <LinearizedResumeView
          rawText={rawText!}
          highlights={highlights}
          activeCategories={activeCategories}
        />
      )}

      {/*
        Mount the PDF renderer whenever a URL exists, even when text view is
        showing — this keeps the canvas + text layer warm so toggling back to
        PDF is instant. Hidden via display:none, not unmounted.
      */}
      {hasPdf && (
        <div
          ref={containerRef}
          className={effectiveMode === "pdf" ? "block" : "hidden"}
        >
          <PdfRenderer
            url={signedPdfUrl!}
            onTextLayer={onTextLayer}
            onLoadError={onLoadError}
          />
        </div>
      )}

      {showImageOnlyHint && (
        <p className="mt-3 rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-xs text-[var(--color-muted)]">
          This PDF appears to be image-only — highlights aren&apos;t available
          on the document. Switch to <strong>Text</strong> for the parsed
          content.
        </p>
      )}

      {effectiveMode === "pdf" &&
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

function ViewToggleButton({
  icon,
  label,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition-colors",
        selected
          ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
          : "text-[var(--color-body)] hover:text-[var(--color-ink)]",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}
