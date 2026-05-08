import {
  CircleCheck,
  Info,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import type { LegalBlock } from "./legal-types";

const CALLOUT_STYLES: Record<
  Extract<LegalBlock, { kind: "callout" }>["tone"],
  {
    border: string;
    bg: string;
    iconText: string;
    Icon: ComponentType<{ className?: string }>;
  }
> = {
  info: {
    border: "border-[var(--color-primary-soft)]",
    bg: "bg-[var(--color-primary-soft)]/40",
    iconText: "text-[var(--color-primary)]",
    Icon: Info,
  },
  ai: {
    border: "border-[var(--color-primary-soft)]",
    bg: "bg-[var(--color-primary-soft)]/40",
    iconText: "text-[var(--color-primary)]",
    Icon: Sparkles,
  },
  warning: {
    border: "border-[var(--color-score-mid-soft)]",
    bg: "bg-[var(--color-score-mid-soft)]/60",
    iconText: "text-[var(--color-score-mid)]",
    Icon: TriangleAlert,
  },
  success: {
    border: "border-[var(--color-score-high-soft)]",
    bg: "bg-[var(--color-score-high-soft)]/60",
    iconText: "text-[var(--color-score-high)]",
    Icon: CircleCheck,
  },
};

export function LegalBlockRenderer({ block }: { block: LegalBlock }) {
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
            <div className="text-sm font-semibold text-[var(--color-ink)]">
              {block.title}
            </div>
            <p className="text-sm leading-6 text-[var(--color-body)]">
              {block.body}
            </p>
          </div>
        </aside>
      );
    }
  }
}
