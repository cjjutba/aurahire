import { Quote } from "lucide-react";

type Relevance = "positive" | "negative" | "neutral";

interface EvidenceCalloutProps {
  excerpt: string;
  source: string;
  relevance: Relevance;
  contributionPoints?: number | null;
  className?: string;
}

const RELEVANCE_VARIANTS: Record<
  Relevance,
  { borderColor: string; iconColor: string; label: string }
> = {
  positive: {
    borderColor: "var(--color-score-high)",
    iconColor: "var(--color-score-high)",
    label: "Helped",
  },
  neutral: {
    borderColor: "var(--color-muted)",
    iconColor: "var(--color-muted)",
    label: "Neutral",
  },
  negative: {
    borderColor: "var(--color-score-low)",
    iconColor: "var(--color-score-low)",
    label: "Hurt",
  },
};

export function EvidenceCallout({
  excerpt,
  source,
  relevance,
  contributionPoints,
  className,
}: EvidenceCalloutProps) {
  const variant = RELEVANCE_VARIANTS[relevance];
  return (
    <article
      className={`rounded-[var(--radius-lg)] border-l-4 bg-[var(--color-surface-soft)] p-4 ${className ?? ""}`}
      style={{ borderLeftColor: variant.borderColor }}
    >
      <header className="mb-2 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          <Quote className="h-3.5 w-3.5" style={{ color: variant.iconColor }} />
          Evidence from resume
        </div>
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: variant.iconColor }}
        >
          {variant.label}
        </span>
      </header>
      {source && (
        <p className="mb-2 text-xs italic text-[var(--color-muted)]">{source}</p>
      )}
      <blockquote className="text-sm italic text-[var(--color-body)] break-words">
        &ldquo;{excerpt}&rdquo;
      </blockquote>
      {typeof contributionPoints === "number" && contributionPoints !== 0 && (
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          Contributes {contributionPoints > 0 ? "+" : ""}
          <span className="font-mono">{contributionPoints}</span> points
        </p>
      )}
    </article>
  );
}
