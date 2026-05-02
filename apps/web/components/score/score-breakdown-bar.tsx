"use client";

interface ComponentSegment {
  name: string;
  label: string;
  score: number;
  max: number;
  weight: number;
  href?: string;
}

interface ScoreBreakdownBarProps {
  components: ComponentSegment[];
  compact?: boolean;
  className?: string;
}

function bandColor(ratio: number): { fill: string; track: string } {
  if (ratio >= 0.7) {
    return { fill: "var(--color-score-high)", track: "var(--color-score-high-soft)" };
  }
  if (ratio >= 0.4) {
    return { fill: "var(--color-score-mid)", track: "var(--color-score-mid-soft)" };
  }
  return { fill: "var(--color-score-low)", track: "var(--color-score-low-soft)" };
}

export function ScoreBreakdownBar({
  components,
  compact,
  className,
}: ScoreBreakdownBarProps) {
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0) || 1;

  return (
    <div className={className}>
      {!compact && (
        <div className="mb-2 flex" style={{ gap: "2px" }}>
          {components.map((c) => {
            const widthPct = (c.weight / totalWeight) * 100;
            return (
              <div
                key={c.name}
                style={{ flexBasis: `${widthPct}%` }}
                className="text-xs"
              >
                <div className="font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  {c.label}
                </div>
                <div className="font-mono text-[var(--color-ink)]">
                  {c.score} / {c.max}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        className="flex overflow-hidden rounded-[var(--radius-pill)]"
        style={{ height: compact ? "8px" : "24px", gap: "2px" }}
      >
        {components.map((c) => {
          const ratio = c.max > 0 ? c.score / c.max : 0;
          const widthPct = (c.weight / totalWeight) * 100;
          const colors = bandColor(ratio);
          const filledPct = ratio * 100;

          const segment = (
            <div
              style={{ flexBasis: `${widthPct}%`, backgroundColor: colors.track }}
              className="relative w-full overflow-hidden first:rounded-l-[var(--radius-pill)] last:rounded-r-[var(--radius-pill)]"
            >
              <div
                style={{
                  width: `${filledPct}%`,
                  backgroundColor: colors.fill,
                  transition: "width 800ms ease-out",
                }}
                className="h-full"
              />
            </div>
          );

          return c.href ? (
            <a
              key={c.name}
              href={c.href}
              className="flex first:rounded-l-[var(--radius-pill)] last:rounded-r-[var(--radius-pill)]"
              style={{ flexBasis: `${widthPct}%` }}
            >
              {segment}
            </a>
          ) : (
            <div
              key={c.name}
              className="flex"
              style={{ flexBasis: `${widthPct}%` }}
            >
              {segment}
            </div>
          );
        })}
      </div>
    </div>
  );
}
