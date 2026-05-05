import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandWordmarkSize = "sm" | "md" | "lg";
type BrandWordmarkTone = "ink" | "on-dark";

const SIZE_MAP: Record<
  BrandWordmarkSize,
  { logoPx: number; textClass: string; gapClass: string }
> = {
  sm: {
    logoPx: 18,
    textClass: "text-xs font-semibold tracking-tight",
    gapClass: "gap-1.5",
  },
  md: {
    logoPx: 24,
    textClass: "text-lg font-semibold tracking-tight",
    gapClass: "gap-2",
  },
  lg: {
    logoPx: 32,
    textClass: "text-xl font-semibold tracking-tight",
    gapClass: "gap-2.5",
  },
};

const TONE_CLASS: Record<BrandWordmarkTone, string> = {
  ink: "text-[var(--color-ink)]",
  "on-dark": "text-[var(--color-on-dark)]",
};

interface BrandWordmarkProps {
  size?: BrandWordmarkSize;
  tone?: BrandWordmarkTone;
  priority?: boolean;
  className?: string;
}

export function BrandWordmark({
  size = "md",
  tone = "ink",
  priority = false,
  className,
}: BrandWordmarkProps) {
  const dims = SIZE_MAP[size];

  return (
    <span
      className={cn(
        "inline-flex items-center",
        dims.gapClass,
        TONE_CLASS[tone],
        className,
      )}
    >
      <Image
        src="/brand/aurahire-logo.png"
        alt=""
        aria-hidden
        width={dims.logoPx}
        height={dims.logoPx}
        priority={priority}
        style={{ width: dims.logoPx, height: dims.logoPx }}
        className="shrink-0"
      />
      <span className={dims.textClass}>AuraHire</span>
    </span>
  );
}
