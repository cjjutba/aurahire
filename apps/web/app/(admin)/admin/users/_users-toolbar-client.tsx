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
  role: string;
  status: string;
}

const ROLE_OPTIONS = [
  { value: "all", label: "All Roles" },
  { value: "candidate", label: "Candidate" },
  { value: "recruiter", label: "Recruiter" },
  { value: "admin", label: "Admin" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "deleted", label: "Deleted" },
];

export function UsersToolbarClient({
  initialQuery,
  role,
  status,
}: ToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(initialQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    setQ(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
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
        `/admin/users${params.toString() ? `?${params.toString()}` : ""}`,
      );
    });
  }

  const currentRole =
    ROLE_OPTIONS.find((o) => o.value === role) ?? ROLE_OPTIONS[0]!;
  const currentStatus =
    STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0]!;

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      style={{ opacity: isPending ? 0.6 : 1, transition: "opacity 150ms" }}
    >
      <div className="relative flex min-w-48 flex-1 items-center">
        <Search
          className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--color-muted)]"
          aria-hidden
        />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or email…"
          className="h-10 w-full rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] pl-9 pr-4 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      <FilterDropdown
        label="Role"
        current={currentRole.label}
        options={ROLE_OPTIONS}
        onSelect={(v) => updateParam("role", v)}
      />

      <FilterDropdown
        label="Status"
        current={currentStatus.label}
        options={STATUS_OPTIONS}
        onSelect={(v) => updateParam("status", v)}
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
