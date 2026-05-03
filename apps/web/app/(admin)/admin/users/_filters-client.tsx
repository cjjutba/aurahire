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
  initialFilters: { role?: string; status?: string; q?: string };
}

export function FiltersClient({ initialFilters }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState(initialFilters.role ?? "all");
  const [status, setStatus] = useState(initialFilters.status ?? "all");
  const [q, setQ] = useState(initialFilters.q ?? "");

  function apply() {
    const next = new URLSearchParams(sp.toString());
    if (role && role !== "all") next.set("role", role);
    else next.delete("role");
    if (status && status !== "all") next.set("status", status);
    else next.delete("status");
    if (q) next.set("q", q);
    else next.delete("q");
    next.delete("page");
    startTransition(() => router.push(`?${next.toString()}`));
  }

  function reset() {
    setRole("all");
    setStatus("all");
    setQ("");
    startTransition(() => router.push("?"));
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4">
      <div className="min-w-[140px]">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Role
        </label>
        <Select value={role} onValueChange={(v) => setRole(v ?? "all")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="candidate">Candidate</SelectItem>
            <SelectItem value="recruiter">Recruiter</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
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
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="deleted">Deleted</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-[200px] flex-1">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Search name or email
        </label>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="maria@..."
          onKeyDown={(e) => {
            if (e.key === "Enter") apply();
          }}
        />
      </div>
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
