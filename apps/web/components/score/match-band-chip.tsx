type ScoreBand = "strong" | "partial" | "limited";

interface MatchBandChipProps {
  band: ScoreBand;
  label?: string;
  className?: string;
}

const BAND_VARIANTS: Record<ScoreBand, { label: string; bg: string; text: string }> = {
  strong: {
    label: "Strong Match",
    bg: "var(--color-score-high-soft)",
    text: "var(--color-score-high)",
  },
  partial: {
    label: "Partial Match",
    bg: "var(--color-score-mid-soft)",
    text: "var(--color-score-mid)",
  },
  limited: {
    label: "Limited Match",
    bg: "var(--color-score-low-soft)",
    text: "var(--color-score-low)",
  },
};

export function MatchBandChip({ band, label, className }: MatchBandChipProps) {
  const variant = BAND_VARIANTS[band];
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[var(--radius-pill)] px-3 py-1 text-xs font-semibold uppercase tracking-wider ${className ?? ""}`}
      style={{ backgroundColor: variant.bg, color: variant.text }}
    >
      {label ?? variant.label}
    </span>
  );
}
