"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  initialFilters: { status?: string; q?: string; hasBiasFlags?: string };
}

export function FiltersClient({ initialFilters }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(initialFilters.status ?? "all");
  const [q, setQ] = useState(initialFilters.q ?? "");
  const [hasBiasFlags, setHasBiasFlags] = useState(
    initialFilters.hasBiasFlags === "true",
  );

  function apply() {
    const next = new URLSearchParams(sp.toString());
    if (status && status !== "all") next.set("status", status);
    else next.delete("status");
    if (q) next.set("q", q);
    else next.delete("q");
    if (hasBiasFlags) next.set("hasBiasFlags", "true");
    else next.delete("hasBiasFlags");
    next.delete("page");
    startTransition(() => router.push(`?${next.toString()}`));
  }

  function reset() {
    setStatus("all");
    setQ("");
    setHasBiasFlags(false);
    startTransition(() => router.push("?"));
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4">
      <div className="min-w-[140px]">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Status
        </label>
        <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-[200px] flex-1">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Search title or description
        </label>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="senior engineer..."
          onKeyDown={(e) => {
            if (e.key === "Enter") apply();
          }}
        />
      </div>
      <label className="flex items-center gap-2 pb-2 text-sm text-[var(--color-body)]">
        <Checkbox
          checked={hasBiasFlags}
          onCheckedChange={(v) => setHasBiasFlags(v === true)}
        />
        Has bias flags
      </label>
      <Button
        onClick={apply}
        disabled={isPending}
        className="rounded-[var(--radius-pill)] bg-[var(--color-primary)]"
      >
        {isPending ? "..." : "Apply"}
      </Button>
      <Button
        onClick={reset}
        variant="outline"
        className="rounded-[var(--radius-pill)]"
      >
        Reset
      </Button>
    </div>
  );
}
