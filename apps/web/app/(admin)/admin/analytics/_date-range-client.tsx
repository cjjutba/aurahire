"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";

const DAY_MS = 24 * 60 * 60 * 1000;

interface Props {
  initialFrom?: string;
  initialTo?: string;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function DateRangeClient({ initialFrom, initialTo }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [from, setFrom] = useState(initialFrom ? initialFrom.slice(0, 10) : "");
  const [to, setTo] = useState(initialTo ? initialTo.slice(0, 10) : "");

  function applyPreset(days: number) {
    const newTo = new Date();
    const newFrom = new Date(newTo.getTime() - days * DAY_MS);
    apply(isoDay(newFrom), isoDay(newTo));
  }

  function applyCustom() {
    if (!from || !to) return;
    apply(from, to);
  }

  function apply(fromIso: string, toIso: string) {
    const next = new URLSearchParams(sp.toString());
    next.set("dateFrom", new Date(fromIso).toISOString());
    next.set("dateTo", new Date(`${toIso}T23:59:59`).toISOString());
    setFrom(fromIso);
    setTo(toIso);
    startTransition(() => router.push(`?${next.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex gap-1">
        {[7, 30, 90].map((d) => (
          <Button
            key={d}
            onClick={() => applyPreset(d)}
            disabled={isPending}
            variant="outline"
            className="rounded-[var(--radius-pill)] text-xs"
          >
            Last {d}
          </Button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <div>
          <label className="mb-1 block text-xs uppercase text-[var(--color-muted)]">
            From
          </label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase text-[var(--color-muted)]">
            To
          </label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="text-xs"
          />
        </div>
        <Button
          onClick={applyCustom}
          disabled={!from || !to || isPending}
          className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-xs"
        >
          {isPending && <ButtonSpinner />}
          {isPending ? "Applying..." : "Apply"}
        </Button>
      </div>
    </div>
  );
}
