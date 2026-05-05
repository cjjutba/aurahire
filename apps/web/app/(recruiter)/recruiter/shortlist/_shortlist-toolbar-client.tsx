"use client";

import { useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "applied", label: "Applied" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];

const BAND_OPTIONS = [
  { value: "", label: "All Matches" },
  { value: "strong", label: "Strong" },
  { value: "partial", label: "Partial" },
  { value: "limited", label: "Limited" },
];

const SORT_OPTIONS = [
  { value: "recently-shortlisted", label: "Recently Shortlisted" },
  { value: "highest-score", label: "Highest Score" },
  { value: "earliest-applied", label: "Earliest Applied" },
];

interface ShortlistToolbarProps {
  q: string;
  status: string;
  band: string;
  sort: string;
}

export function ShortlistToolbarClient({ q, status, band, sort }: ShortlistToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep input in sync with URL param on mount
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== q) {
      inputRef.current.value = q;
    }
  }, [q]);

  const push = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(updates)) {
        if (val) {
          params.set(key, val);
        } else {
          params.delete(key);
        }
      }
      // Reset to page 1 on any filter change
      params.delete("page");
      startTransition(() => {
        router.push(`/recruiter/shortlist?${params.toString()}`);
      });
    },
    [router, searchParams],
  );

  function handleSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      push({ q: value });
    }, 300);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
        <input
          ref={inputRef}
          type="search"
          defaultValue={q}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by candidate or job…"
          className="h-[44px] w-full rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-surface-strong)] pl-9 pr-4 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
        />
      </div>

      {/* Status filter */}
      <select
        value={status}
        onChange={(e) => push({ status: e.target.value })}
        className="h-[44px] rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 pr-8 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Band filter */}
      <select
        value={band}
        onChange={(e) => push({ band: e.target.value })}
        className="h-[44px] rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 pr-8 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
      >
        {BAND_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Sort dropdown (push to end) */}
      <div className="ml-auto">
        <select
          value={sort}
          onChange={(e) => push({ sort: e.target.value })}
          className="h-[44px] rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 pr-8 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
