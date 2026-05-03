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

interface Props {
  initialFilters: {
    status?: string;
    minScore?: string;
    maxScore?: string;
    dateFrom?: string;
    dateTo?: string;
    q?: string;
    jobId?: string;
  };
}

const STATUSES = [
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
] as const;

export function FiltersClient({ initialFilters }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(initialFilters.status ?? "all");
  const [minScore, setMinScore] = useState(initialFilters.minScore ?? "");
  const [maxScore, setMaxScore] = useState(initialFilters.maxScore ?? "");
  const [dateFrom, setDateFrom] = useState(
    initialFilters.dateFrom
      ? initialFilters.dateFrom.slice(0, 10)
      : "",
  );
  const [dateTo, setDateTo] = useState(
    initialFilters.dateTo ? initialFilters.dateTo.slice(0, 10) : "",
  );
  const [q, setQ] = useState(initialFilters.q ?? "");
  const [error, setError] = useState<string | null>(null);

  function apply() {
    setError(null);
    const minN = minScore ? Number(minScore) : null;
    const maxN = maxScore ? Number(maxScore) : null;
    if (minN != null && (minN < 0 || minN > 100)) {
      setError("Min must be 0-100");
      return;
    }
    if (maxN != null && (maxN < 0 || maxN > 100)) {
      setError("Max must be 0-100");
      return;
    }
    if (minN != null && maxN != null && minN > maxN) {
      setError("Min must be ≤ Max");
      return;
    }

    const next = new URLSearchParams(sp.toString());
    if (status && status !== "all") next.set("status", status);
    else next.delete("status");
    if (minScore) next.set("minScore", minScore);
    else next.delete("minScore");
    if (maxScore) next.set("maxScore", maxScore);
    else next.delete("maxScore");
    if (dateFrom) next.set("dateFrom", new Date(dateFrom).toISOString());
    else next.delete("dateFrom");
    if (dateTo) next.set("dateTo", new Date(dateTo).toISOString());
    else next.delete("dateTo");
    if (q) next.set("q", q);
    else next.delete("q");
    next.delete("page");
    startTransition(() => router.push(`?${next.toString()}`));
  }

  function reset() {
    setStatus("all");
    setMinScore("");
    setMaxScore("");
    setDateFrom("");
    setDateTo("");
    setQ("");
    setError(null);
    startTransition(() => router.push("?"));
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4">
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Status
          </label>
          <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Min Score
          </label>
          <Input
            type="number"
            min={0}
            max={100}
            placeholder="0"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Max Score
          </label>
          <Input
            type="number"
            min={0}
            max={100}
            placeholder="100"
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            From
          </label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            To
          </label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Search candidate
          </label>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="name or email"
            onKeyDown={(e) => {
              if (e.key === "Enter") apply();
            }}
          />
        </div>
      </div>
      {error && (
        <p className="text-xs text-[var(--color-status-danger)]">{error}</p>
      )}
      <div className="flex justify-end gap-2">
        <Button
          onClick={reset}
          variant="outline"
          className="rounded-[var(--radius-pill)]"
        >
          Reset
        </Button>
        <Button
          onClick={apply}
          disabled={isPending}
          className="rounded-[var(--radius-pill)] bg-[var(--color-primary)]"
        >
          {isPending ? "Applying..." : "Apply filters"}
        </Button>
      </div>
    </div>
  );
}
