"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Per thesis panel revision (May 2026): "Screening" stage removed.
const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "applied", label: "Applied" },
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

export function ShortlistToolbarClient({
  q,
  status,
  band,
  sort,
}: ShortlistToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Sync input when URL changes (e.g. filter resets)
  useEffect(() => {
    setQuery(q);
  }, [q]);

  useEffect(() => {
    if (query === q) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParam("q", query);
    }, 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      if (key !== "page") params.delete("page");
      startTransition(() => {
        router.push(
          `/recruiter/shortlist${params.toString() ? `?${params.toString()}` : ""}`,
        );
      });
    },
    [router, searchParams],
  );

  const currentStatus =
    STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0]!;
  const currentBand =
    BAND_OPTIONS.find((o) => o.value === band) ?? BAND_OPTIONS[0]!;
  const currentSort =
    SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0]!;

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
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by candidate or job…"
          className="h-10 w-full rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] pl-9 pr-4 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* Status filter */}
      <FilterDropdown
        label="Status"
        current={currentStatus.label}
        options={STATUS_OPTIONS}
        onSelect={(v) => updateParam("status", v)}
      />

      {/* Match band filter */}
      <FilterDropdown
        label="Match"
        current={currentBand.label}
        options={BAND_OPTIONS}
        onSelect={(v) => updateParam("band", v)}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sort */}
      <FilterDropdown
        label="Sort"
        current={currentSort.label}
        options={SORT_OPTIONS}
        onSelect={(v) => updateParam("sort", v)}
      />
    </div>
  );
}

function FilterDropdown({
  label,
  current,
  options,
  onSelect,
}: {
  label: string;
  current: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-3 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-hairline-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        }
      >
        <span>
          {label}: {current}
        </span>
        <ChevronDown
          className="h-3.5 w-3.5 text-[var(--color-muted)]"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom">
        {options.map((opt) => (
          <DropdownMenuItem key={opt.value} onClick={() => onSelect(opt.value)}>
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
