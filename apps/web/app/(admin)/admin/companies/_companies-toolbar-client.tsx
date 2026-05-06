"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

interface Props {
  q: string;
}

export function CompaniesToolbarClient({ q }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [query, setQuery] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setQuery(q);
  }, [q]);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value) params.delete(key);
      else params.set(key, value);
      if (key !== "page") params.delete("page");
      startTransition(() => {
        router.push(
          `/admin/companies${params.toString() ? `?${params.toString()}` : ""}`,
        );
      });
    },
    [router, searchParams],
  );

  useEffect(() => {
    if (query === q) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParam("q", query);
    }, 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
        <input
          type="search"
          placeholder="Search by company name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 w-full rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] pl-9 pr-4 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)]"
        />
      </div>
    </div>
  );
}
