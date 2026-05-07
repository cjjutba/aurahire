"use client";

import { useMemo } from "react";
import { useHighlightContext } from "./highlight-context";
import type { Highlight, HighlightCategory } from "./derive-highlights";

interface Props {
  rawText: string;
  highlights: Highlight[];
  activeCategories: readonly HighlightCategory[];
}

/**
 * Fallback for image-only PDFs / failed PDF.js loads / DOCX without a canonical PDF.
 * Renders rawText as styled HTML with substring-based highlights.
 */
export function LinearizedResumeView({ rawText, highlights, activeCategories }: Props) {
  const { focusField, hoveredFieldId } = useHighlightContext();

  const segments = useMemo(() => buildSegments(rawText, highlights), [rawText, highlights]);

  return (
    <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5 text-xs leading-6 text-[var(--color-body)]">
      <div className="whitespace-pre-wrap">
        {segments.map((seg, i) =>
          seg.highlight ? (
            <mark
              key={i}
              data-field-ref={seg.highlight.fieldRef}
              onClick={() => focusField(seg.highlight!.fieldRef)}
              style={{
                backgroundColor: "var(--color-primary-soft)",
                color: "var(--color-primary)",
                opacity: activeCategories.includes(seg.highlight.category) ? 1 : 0.3,
                outline:
                  hoveredFieldId === seg.highlight.fieldRef
                    ? "2px solid var(--color-primary)"
                    : undefined,
                cursor: "pointer",
                padding: "0 2px",
                borderRadius: "3px",
              }}
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </div>
    </div>
  );
}

interface Segment {
  text: string;
  highlight?: Highlight;
}

function buildSegments(rawText: string, highlights: Highlight[]): Segment[] {
  const matches: Array<{ start: number; end: number; highlight: Highlight }> = [];
  for (const h of highlights) {
    const idx = rawText.toLowerCase().indexOf(h.source.toLowerCase());
    if (idx >= 0) matches.push({ start: idx, end: idx + h.source.length, highlight: h });
  }
  matches.sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start < cursor) continue; // overlapping, skip
    if (m.start > cursor) segments.push({ text: rawText.slice(cursor, m.start) });
    segments.push({ text: rawText.slice(m.start, m.end), highlight: m.highlight });
    cursor = m.end;
  }
  if (cursor < rawText.length) segments.push({ text: rawText.slice(cursor) });
  return segments;
}
