"use client";

interface Props {
  current: number;
  target: number;
}

export function SumIndicator({ current, target }: Props) {
  const diff = current - target;
  const ok = diff === 0;
  const tone = ok
    ? "text-[var(--color-score-high)]"
    : Math.abs(diff) <= 5
      ? "text-[var(--color-score-mid)]"
      : "text-[var(--color-status-danger)]";

  const message = ok
    ? `${current} / ${target} ✓`
    : diff > 0
      ? `${current} / ${target} (${diff} over)`
      : `${current} / ${target} (${Math.abs(diff)} short)`;

  return (
    <span className={`font-mono text-sm font-semibold ${tone}`}>{message}</span>
  );
}
