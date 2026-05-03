"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  label: string;
  value: number | string;
  tooltip: string;
}

export function KpiTileWithTooltip({ label, value, tooltip }: Props) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </h3>
        <Tooltip>
          <TooltipTrigger
            type="button"
            aria-label="How is this calculated?"
            className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
          >
            <Info className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </div>
      <p className="mt-3 font-mono text-3xl font-medium text-[var(--color-ink)]">
        {value}
      </p>
    </div>
  );
}
