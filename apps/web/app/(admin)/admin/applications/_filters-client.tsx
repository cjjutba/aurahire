"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, RotateCcw, Search } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "applied", label: "Applied" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];

function clampScore(raw: string): string {
  if (!raw) return "";
  const n = Number(raw);
  if (Number.isNaN(n)) return "";
  return String(Math.min(100, Math.max(0, Math.round(n))));
}

export function FiltersClient({ initialFilters }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(initialFilters.q ?? "");
  const [status, setStatus] = useState(initialFilters.status ?? "all");
  const [minScore, setMinScore] = useState(initialFilters.minScore ?? "");
  const [maxScore, setMaxScore] = useState(initialFilters.maxScore ?? "");
  const [dateFrom, setDateFrom] = useState(
    initialFilters.dateFrom ? initialFilters.dateFrom.slice(0, 10) : "",
  );
  const [dateTo, setDateTo] = useState(
    initialFilters.dateTo ? initialFilters.dateTo.slice(0, 10) : "",
  );

  const qDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scoreDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setQ(initialFilters.q ?? "");
    setStatus(initialFilters.status ?? "all");
    setMinScore(initialFilters.minScore ?? "");
    setMaxScore(initialFilters.maxScore ?? "");
    setDateFrom(
      initialFilters.dateFrom ? initialFilters.dateFrom.slice(0, 10) : "",
    );
    setDateTo(
      initialFilters.dateTo ? initialFilters.dateTo.slice(0, 10) : "",
    );
  }, [
    initialFilters.q,
    initialFilters.status,
    initialFilters.minScore,
    initialFilters.maxScore,
    initialFilters.dateFrom,
    initialFilters.dateTo,
  ]);

  // Debounce search query updates
  useEffect(() => {
    if (q === (initialFilters.q ?? "")) return;
    clearTimeout(qDebounceRef.current);
    qDebounceRef.current = setTimeout(() => {
      pushParams({ q });
    }, 300);
    return () => clearTimeout(qDebounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Debounce score range updates
  useEffect(() => {
    const initialMin = initialFilters.minScore ?? "";
    const initialMax = initialFilters.maxScore ?? "";
    if (minScore === initialMin && maxScore === initialMax) return;
    clearTimeout(scoreDebounceRef.current);
    scoreDebounceRef.current = setTimeout(() => {
      pushParams({ minScore, maxScore });
    }, 400);
    return () => clearTimeout(scoreDebounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minScore, maxScore]);

  function pushParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [key, raw] of Object.entries(updates)) {
      if (!raw || raw === "all") {
        params.delete(key);
      } else {
        params.set(key, raw);
      }
    }
    params.delete("page");
    startTransition(() => {
      router.push(`/admin/applications${params.toString() ? `?${params.toString()}` : ""}`);
    });
  }

  function selectStatus(v: string) {
    setStatus(v);
    pushParams({ status: v });
  }

  function commitDateFrom(v: string) {
    setDateFrom(v);
    pushParams({ dateFrom: v ? new Date(v).toISOString() : null });
  }

  function commitDateTo(v: string) {
    setDateTo(v);
    pushParams({ dateTo: v ? new Date(v).toISOString() : null });
  }

  function reset() {
    setQ("");
    setStatus("all");
    setMinScore("");
    setMaxScore("");
    setDateFrom("");
    setDateTo("");
    startTransition(() => router.push("/admin/applications"));
  }

  const filtersActive = !!(
    initialFilters.q ||
    (initialFilters.status && initialFilters.status !== "all") ||
    initialFilters.minScore ||
    initialFilters.maxScore ||
    initialFilters.dateFrom ||
    initialFilters.dateTo
  );

  const currentStatus =
    STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0]!;

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      style={{ opacity: isPending ? 0.6 : 1, transition: "opacity 150ms" }}
    >
      {/* Search */}
      <div className="relative flex min-w-48 flex-1 items-center">
        <Search
          className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--color-muted)]"
          aria-hidden
        />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search candidate by name or email…"
          className="h-10 w-full rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] pl-9 pr-4 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* Status filter */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-3 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-hairline-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          }
        >
          <span>Status: {currentStatus.label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-[var(--color-muted)]" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom">
          {STATUS_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => selectStatus(opt.value)}
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Score range pill */}
      <div className="inline-flex h-10 items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-3 text-sm text-[var(--color-ink)]">
        <span className="text-[var(--color-muted)]">Score</span>
        <input
          type="number"
          min={0}
          max={100}
          value={minScore}
          onChange={(e) => setMinScore(e.target.value)}
          onBlur={(e) => setMinScore(clampScore(e.target.value))}
          placeholder="0"
          aria-label="Minimum score"
          className="w-10 bg-transparent text-center font-mono text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-[var(--color-muted)]">–</span>
        <input
          type="number"
          min={0}
          max={100}
          value={maxScore}
          onChange={(e) => setMaxScore(e.target.value)}
          onBlur={(e) => setMaxScore(clampScore(e.target.value))}
          placeholder="100"
          aria-label="Maximum score"
          className="w-10 bg-transparent text-center font-mono text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>

      {/* Date range pill */}
      <div className="inline-flex h-10 items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-3 text-sm text-[var(--color-ink)]">
        <span className="text-[var(--color-muted)]">Date</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => commitDateFrom(e.target.value)}
          aria-label="Date from"
          className="bg-transparent text-sm text-[var(--color-ink)] focus:outline-none"
        />
        <span className="text-[var(--color-muted)]">–</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => commitDateTo(e.target.value)}
          aria-label="Date to"
          className="bg-transparent text-sm text-[var(--color-ink)] focus:outline-none"
        />
      </div>

      {/* Reset */}
      {filtersActive && (
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-pill)] px-3 text-sm font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Reset
        </button>
      )}
    </div>
  );
}
