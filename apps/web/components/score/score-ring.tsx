"use client";

import { useEffect, useRef, useState } from "react";

type ScoreBand = "strong" | "partial" | "limited";

interface ScoreRingProps {
  score: number;
  band: ScoreBand;
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

const SIZE_CONFIG: Record<
  NonNullable<ScoreRingProps["size"]>,
  { px: number; stroke: number; fontSize: string; labelSize: string }
> = {
  sm: { px: 80, stroke: 8, fontSize: "1.25rem", labelSize: "0.6rem" },
  md: { px: 120, stroke: 12, fontSize: "1.875rem", labelSize: "0.7rem" },
  lg: { px: 200, stroke: 16, fontSize: "3rem", labelSize: "0.875rem" },
};

const BAND_COLORS: Record<ScoreBand, string> = {
  strong: "var(--color-score-high)",
  partial: "var(--color-score-mid)",
  limited: "var(--color-score-low)",
};

export function ScoreRing({
  score,
  band,
  size = "md",
  label = "of 100",
  className,
}: ScoreRingProps) {
  const config = SIZE_CONFIG[size];
  const radius = (config.px - config.stroke) / 2;
  const center = config.px / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference * (1 - Math.max(0, Math.min(score, 100)) / 100);

  const [offset, setOffset] = useState(circumference);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      requestAnimationFrame(() => {
        setOffset(targetOffset);
      });
      mountedRef.current = true;
    } else {
      setOffset(targetOffset);
    }
  }, [targetOffset]);

  return (
    <div
      className={className}
      role="progressbar"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Score ${score} out of 100`}
      style={{ width: `${config.px}px`, height: `${config.px}px` }}
    >
      <svg width={config.px} height={config.px} viewBox={`0 0 ${config.px} ${config.px}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-primary-soft)"
          strokeWidth={config.stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={BAND_COLORS[band]}
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "center",
            transition: "stroke-dashoffset 800ms ease-out",
          }}
        />
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--color-ink)"
          fontFamily="var(--font-mono)"
          fontSize={config.fontSize}
          fontWeight={500}
        >
          {score}
        </text>
        {size !== "sm" && (
          <text
            x={center}
            y={center + (size === "lg" ? 36 : 24)}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--color-muted)"
            fontFamily="var(--font-body)"
            fontSize={config.labelSize}
            fontWeight={500}
            style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
          >
            {label}
          </text>
        )}
      </svg>
    </div>
  );
}
