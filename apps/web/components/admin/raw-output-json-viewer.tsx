"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import { toastSuccess } from "@/lib/toast";

interface Props {
  value: unknown;
  title?: string;
  defaultOpen?: boolean;
}

export function RawOutputJsonViewer({
  value,
  title = "Raw AI Output",
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const json = JSON.stringify(value, null, 2);

  function copy() {
    void navigator.clipboard.writeText(json);
    toastSuccess("Copied JSON");
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {title}
        </span>
        {open && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              copy();
            }}
            className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-1 text-xs text-[var(--color-body)] hover:bg-[var(--color-surface-strong)]"
          >
            <Copy className="h-3 w-3" /> Copy
          </button>
        )}
      </button>
      {open && (
        <pre className="max-h-96 overflow-auto rounded-b-[var(--radius-lg)] bg-[var(--color-surface-dark)] p-4 font-mono text-xs leading-relaxed text-[var(--color-on-dark)]">
          {json}
        </pre>
      )}
    </section>
  );
}
