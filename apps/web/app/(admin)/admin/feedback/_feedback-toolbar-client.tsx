"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import {
  FEEDBACK_STATUS,
  FEEDBACK_TYPE,
  FEEDBACK_SEVERITY,
} from "@aurahire/shared";

interface Props {
  initialQuery: string;
  status: string;
  type: string;
  severity: string;
}

export function FeedbackToolbarClient({
  initialQuery,
  status,
  type,
  severity,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQuery);

  // Debounce free-text search so navigation only fires after typing stops.
  useEffect(() => {
    if (q === initialQuery) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (q.trim()) {
        params.set("q", q.trim());
      } else {
        params.delete("q");
      }
      params.delete("page");
      router.push(`/admin/feedback?${params.toString()}`);
    }, 300);
    return () => clearTimeout(timer);
  }, [q, initialQuery, router, searchParams]);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("page");
    router.push(`/admin/feedback?${params.toString()}`);
  }

  const statusOptions = useMemo(
    () => [
      { value: "all", label: "All" },
      ...FEEDBACK_STATUS.map((s) => ({ value: s, label: capitalize(s) })),
    ],
    [],
  );

  const typeOptions = useMemo(
    () => [
      { value: "all", label: "All" },
      ...FEEDBACK_TYPE.map((s) => ({ value: s, label: capitalize(s) })),
    ],
    [],
  );

  const severityOptions = useMemo(
    () => [
      { value: "all", label: "All severity" },
      ...FEEDBACK_SEVERITY.map((s) => ({ value: s, label: capitalize(s) })),
    ],
    [],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[240px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search subject, message, or submitter…"
          className="h-10 w-full rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-surface-strong)] pl-9 pr-9 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:bg-[var(--color-canvas)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
        />
        {q ? (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--color-muted)] hover:bg-[var(--color-hairline)] hover:text-[var(--color-ink)]"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      <FilterSelect
        value={status}
        onChange={(v) => setParam("status", v)}
        options={statusOptions}
        label="Status"
      />
      <FilterSelect
        value={type}
        onChange={(v) => setParam("type", v)}
        options={typeOptions}
        label="Type"
      />
      <FilterSelect
        value={severity}
        onChange={(v) => setParam("severity", v)}
        options={severityOptions}
        label="Severity"
      />
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 pr-8 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
