"use client";

import { useEffect } from "react";
import { useHighlightContext } from "./highlight-context";
import type { Highlight, HighlightCategory } from "./derive-highlights";
import type { Rect } from "./find-text-spans";

export interface PositionedHighlight extends Highlight {
  pageIndex: number;
  rects: Rect[];
}

interface Props {
  highlights: PositionedHighlight[];
  activeCategories: readonly HighlightCategory[];
  /** Page-wrapper DOM nodes (one per page) so we can append rect divs. */
  pageContainers: HTMLElement[];
}

/**
 * Renders absolute-positioned div overlays on top of the PDF.js text layer,
 * one per matched highlight rect. Out-of-set categories fade to opacity 0.15.
 * Hovered highlight gets a pulse animation.
 */
export function HighlightOverlay({ highlights, activeCategories, pageContainers }: Props) {
  const { hoveredFieldId, focusField } = useHighlightContext();

  useEffect(() => {
    // Clean previous overlays.
    pageContainers.forEach((c) => {
      c.querySelectorAll("[data-highlight]").forEach((n) => n.remove());
    });

    const cleanup: Array<() => void> = [];

    for (const h of highlights) {
      const container = pageContainers[h.pageIndex];
      if (!container) continue;
      const isActive = activeCategories.includes(h.category);
      const isHovered = hoveredFieldId === h.fieldRef;

      for (const r of h.rects) {
        const div = document.createElement("div");
        div.dataset.highlight = h.id;
        div.dataset.fieldRef = h.fieldRef;
        div.style.position = "absolute";
        div.style.left = `${r.x}px`;
        div.style.top = `${r.y}px`;
        div.style.width = `${r.width}px`;
        div.style.height = `${r.height}px`;
        div.style.borderRadius = "3px";
        div.style.pointerEvents = "auto";
        div.style.cursor = "pointer";
        div.style.transition = "opacity 200ms ease, background-color 200ms ease";
        div.style.opacity = isActive ? "1" : "0.15";
        div.style.backgroundColor = "var(--color-primary-soft)";
        div.style.mixBlendMode = "multiply";
        if (isHovered) {
          div.style.outline = "2px solid var(--color-primary)";
          div.style.animation = "highlight-pulse 600ms ease-out";
        }
        const onClick = () => focusField(h.fieldRef);
        div.addEventListener("click", onClick);
        cleanup.push(() => div.removeEventListener("click", onClick));
        container.appendChild(div);
      }
    }

    return () => {
      cleanup.forEach((fn) => fn());
    };
  }, [highlights, activeCategories, hoveredFieldId, pageContainers, focusField]);

  return null;
}
