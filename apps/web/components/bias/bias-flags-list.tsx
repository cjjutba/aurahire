import { BiasFlagChip, type BiasFlagChipFlag } from "./bias-flag-chip";

interface Props {
  flags: BiasFlagChipFlag[];
  title?: string;
  scanning?: boolean;
}

export function BiasFlagsList({ flags, title, scanning }: Props) {
  if (scanning && flags.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--color-score-mid)]" />
        Scanning for biased language...
      </div>
    );
  }

  if (flags.length === 0) return null;

  const headerText =
    title ??
    `${flags.length} potential bias flag${flags.length === 1 ? "" : "s"}`;

  return (
    <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-score-mid-soft)] bg-[var(--color-score-mid-soft)] p-4">
      <h4 className="text-sm font-semibold text-[var(--color-score-mid)]">
        {headerText}
      </h4>
      <div className="flex flex-wrap gap-2">
        {flags.map((flag, i) => (
          <BiasFlagChip key={flag.id ?? `${flag.term}-${i}`} flag={flag} />
        ))}
      </div>
    </div>
  );
}
