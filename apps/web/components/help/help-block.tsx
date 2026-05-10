import {
  CircleCheck,
  Info,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import type { HelpBlock } from "./help-types";

const CALLOUT_STYLES: Record<
  Extract<HelpBlock, { kind: "callout" }>["tone"],
  {
    border: string;
    bg: string;
    iconText: string;
    titleText: string;
    Icon: ComponentType<{ className?: string }>;
  }
> = {
  info: {
    border: "border-[var(--color-primary-soft)]",
    bg: "bg-[var(--color-primary-soft)]/40",
    iconText: "text-[var(--color-primary)]",
    titleText: "text-[var(--color-ink)]",
    Icon: Info,
  },
  ai: {
    border: "border-[var(--color-primary-soft)]",
    bg: "bg-[var(--color-primary-soft)]/40",
    iconText: "text-[var(--color-primary)]",
    titleText: "text-[var(--color-ink)]",
    Icon: Sparkles,
  },
  warning: {
    border: "border-[var(--color-score-mid-soft)]",
    bg: "bg-[var(--color-score-mid-soft)]/60",
    iconText: "text-[var(--color-score-mid)]",
    titleText: "text-[var(--color-ink)]",
    Icon: TriangleAlert,
  },
  danger: {
    border: "border-[var(--color-score-low-soft)]",
    bg: "bg-[var(--color-score-low-soft)]/60",
    iconText: "text-[var(--color-score-low)]",
    titleText: "text-[var(--color-ink)]",
    Icon: ShieldAlert,
  },
  success: {
    border: "border-[var(--color-score-high-soft)]",
    bg: "bg-[var(--color-score-high-soft)]/60",
    iconText: "text-[var(--color-score-high)]",
    titleText: "text-[var(--color-ink)]",
    Icon: CircleCheck,
  },
};

export function HelpBlockRenderer({ block }: { block: HelpBlock }) {
  switch (block.kind) {
    case "paragraph":
      return (
        <p className="text-[15px] leading-7 text-[var(--color-body)]">
          {block.text}
        </p>
      );

    case "list":
      if (block.ordered) {
        return (
          <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-7 text-[var(--color-body)] marker:text-[var(--color-muted)]">
            {block.items.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ol>
        );
      }
      return (
        <ul className="list-disc space-y-2 pl-5 text-[15px] leading-7 text-[var(--color-body)] marker:text-[var(--color-muted)]">
          {block.items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      );

    case "steps":
      return (
        <ol className="space-y-3">
          {block.items.map((step, idx) => (
            <li
              key={idx}
              className="flex gap-4 rounded-[var(--radius-md)] border border-[var(--color-hairline-soft)] bg-[var(--color-canvas)] p-4"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] font-mono text-xs font-semibold text-[var(--color-primary)]">
                {idx + 1}
              </span>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[var(--color-ink)]">
                  {step.title}
                </div>
                <p className="text-sm leading-6 text-[var(--color-body)]">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      );

    case "fields":
      return (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-hairline-soft)]">
          <dl className="divide-y divide-[var(--color-hairline-soft)]">
            {block.entries.map((entry, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 gap-1 bg-[var(--color-canvas)] p-4 sm:grid-cols-[200px_1fr] sm:gap-4"
              >
                <dt className="text-sm font-semibold text-[var(--color-ink)]">
                  {entry.label}
                </dt>
                <dd className="text-sm leading-6 text-[var(--color-body)]">
                  {entry.description}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      );

    case "definitions":
      return (
        <dl className="space-y-3">
          {block.entries.map((entry, idx) => (
            <div key={idx}>
              <dt className="text-sm font-semibold text-[var(--color-ink)]">
                {entry.term}
              </dt>
              <dd className="mt-0.5 text-sm leading-6 text-[var(--color-body)]">
                {entry.definition}
              </dd>
            </div>
          ))}
        </dl>
      );

    case "callout": {
      const styles = CALLOUT_STYLES[block.tone];
      const Icon = styles.Icon;
      return (
        <aside
          className={cn(
            "flex gap-3 rounded-[var(--radius-md)] border p-4",
            styles.border,
            styles.bg,
          )}
        >
          <Icon
            className={cn("mt-0.5 h-4 w-4 shrink-0", styles.iconText)}
            aria-hidden
          />
          <div className="space-y-1">
            <div className={cn("text-sm font-semibold", styles.titleText)}>
              {block.title}
            </div>
            <p className="text-sm leading-6 text-[var(--color-body)]">
              {block.body}
            </p>
          </div>
        </aside>
      );
    }

    case "quote":
      return (
        <blockquote className="rounded-[var(--radius-md)] border-l-4 border-[var(--color-primary)] bg-[var(--color-surface-soft)] p-4">
          <p className="text-sm italic leading-6 text-[var(--color-body)]">
            &ldquo;{block.text}&rdquo;
          </p>
          {block.cite && (
            <cite className="mt-2 block text-[11px] font-semibold uppercase not-italic tracking-wider text-[var(--color-muted)]">
              {block.cite}
            </cite>
          )}
        </blockquote>
      );

    case "kbd":
      return (
        <ul className="space-y-2">
          {block.entries.map((entry, idx) => (
            <li
              key={idx}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-hairline-soft)] bg-[var(--color-canvas)] px-4 py-2"
            >
              <span className="text-sm text-[var(--color-body)]">
                {entry.description}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {entry.keys.map((key, kidx) => (
                  <kbd
                    key={kidx}
                    className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-[var(--radius-xs)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-1.5 font-mono text-[11px] font-semibold text-[var(--color-ink)] shadow-[0_1px_0_0_var(--color-hairline)]"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      );

    case "matrix":
      return (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-hairline-soft)]">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[var(--color-surface-soft)]">
              <tr>
                {block.head.map((h, idx) => (
                  <th
                    key={idx}
                    scope="col"
                    className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-hairline-soft)] bg-[var(--color-canvas)]">
              {block.rows.map((row, ridx) => (
                <tr key={ridx}>
                  {row.map((cell, cidx) => (
                    <td
                      key={cidx}
                      className={cn(
                        "px-4 py-3 align-top text-[var(--color-body)]",
                        cidx === 0 && "font-medium text-[var(--color-ink)]",
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}
