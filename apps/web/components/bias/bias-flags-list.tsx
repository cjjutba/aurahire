import { BiasFlagChip, type BiasFlagChipFlag } from "./bias-flag-chip";

interface Props {
  flags: BiasFlagChipFlag[];
  title?: string;
  scanning?: boolean;
  onFlagSelect?: (flag: BiasFlagChipFlag) => void;
}

export function BiasFlagsList({ flags, title, scanning, onFlagSelect }: Props) {
  if (scanning && flags.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--color-score-mid)]" />
        Scanning for biased language...
      </div>
    );
  }

  if (flags.length === 0) return null;

  // When the bucket contains only LOW-severity flags we render the surface in
  // a calm, neutral palette to signal "informational" rather than "alert".
  // The amber/scoring palette is reserved for buckets that include MEDIUM or
  // HIGH flags, since those are the ones that actually gate publish.
  const hasGating = flags.some(
    (f) => f.severity === "medium" || f.severity === "high",
  );

  const headerText =
    title ??
    `${flags.length} potential bias flag${flags.length === 1 ? "" : "s"}`;

  const containerClass = hasGating
    ? "space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-score-mid-soft)] bg-[var(--color-score-mid-soft)] p-4"
    : "space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-4";

  const headerClass = hasGating
    ? "text-sm font-semibold text-[var(--color-score-mid)]"
    : "text-sm font-semibold text-[var(--color-body)]";

  return (
    <div className={containerClass}>
      <h4 className={headerClass}>{headerText}</h4>
      <div className="flex flex-wrap gap-2">
        {flags.map((flag, i) => (
          <BiasFlagChip
            key={flag.id ?? `${flag.term}-${i}`}
            flag={flag}
            onSelect={onFlagSelect ? () => onFlagSelect(flag) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
