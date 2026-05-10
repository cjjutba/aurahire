"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ToolbarProps {
  initialQuery: string;
  status: string;
  mode: string;
  experienceLevel: string;
  sort: string;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
];

const MODE_OPTIONS = [
  { value: "all", label: "All Modes" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "on-site", label: "On-site" },
];

const EXPERIENCE_OPTIONS = [
  { value: "all", label: "All Levels" },
  { value: "entry", label: "Entry" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
  { value: "principal", label: "Principal" },
  { value: "manager", label: "Manager" },
  { value: "director", label: "Director" },
  { value: "vp+", label: "VP+" },
];

const SORT_OPTIONS = [
  { value: "recent", label: "Newest" },
  { value: "recent-activity", label: "Recently Active" },
  { value: "salary-high", label: "Salary High → Low" },
];

export function JobsToolbarClient({
  initialQuery,
  status,
  mode,
  experienceLevel,
  sort,
}: ToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(initialQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Sync input when URL changes (e.g. filter resets)
  useEffect(() => {
    setQ(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    // Skip firing when already in sync with the URL
    if (q === initialQuery) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParam("q", q);
    }, 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    if (key !== "page") params.delete("page");
    startTransition(() => {
      router.push(
        `/recruiter/jobs${params.toString() ? `?${params.toString()}` : ""}`,
      );
    });
  }

  const currentStatus =
    STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0]!;
  const currentMode =
    MODE_OPTIONS.find((o) => o.value === mode) ?? MODE_OPTIONS[0]!;
  const currentExp =
    EXPERIENCE_OPTIONS.find((o) => o.value === experienceLevel) ??
    EXPERIENCE_OPTIONS[0]!;
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
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search jobs by title…"
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

      {/* Mode filter */}
      <FilterDropdown
        label="Mode"
        current={currentMode.label}
        options={MODE_OPTIONS}
        onSelect={(v) => updateParam("mode", v)}
      />

      {/* Experience filter */}
      <FilterDropdown
        label="Experience"
        current={currentExp.label}
        options={EXPERIENCE_OPTIONS}
        onSelect={(v) => updateParam("experienceLevel", v)}
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
