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
import { ButtonSpinner } from "@/components/ui/button-spinner";

interface CompanyOption {
  id: string;
  name: string;
  logoUrl: string | null;
}

interface Props {
  initialFilters: {
    actorId?: string;
    q?: string;
    entityType?: string;
    action?: string;
    actorType?: string;
    companyId?: string;
    dateFrom?: string;
    dateTo?: string;
  };
  companies: CompanyOption[];
}

const ENTITY_TYPES = [
  "profile",
  "job",
  "application",
  "match_score",
  "profile_score",
  "bias_flag",
  "scoring_config",
  "resume",
  "company",
  "company_member",
  "interview",
  "offer",
  "cron",
] as const;

const ACTOR_TYPES = ["user", "ai", "system"] as const;

export function FiltersClient({ initialFilters, companies }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(initialFilters.q ?? "");
  const [entityType, setEntityType] = useState(
    initialFilters.entityType ?? "all",
  );
  const [action, setAction] = useState(initialFilters.action ?? "");
  const [actorType, setActorType] = useState(
    initialFilters.actorType ?? "all",
  );
  const [companyId, setCompanyId] = useState(
    initialFilters.companyId ?? "all",
  );
  const [dateFrom, setDateFrom] = useState(
    initialFilters.dateFrom ? initialFilters.dateFrom.slice(0, 10) : "",
  );
  const [dateTo, setDateTo] = useState(
    initialFilters.dateTo ? initialFilters.dateTo.slice(0, 10) : "",
  );

  function apply() {
    const next = new URLSearchParams(sp.toString());
    if (q) next.set("q", q);
    else next.delete("q");
    if (entityType && entityType !== "all") next.set("entityType", entityType);
    else next.delete("entityType");
    if (action) next.set("action", action);
    else next.delete("action");
    if (actorType && actorType !== "all") next.set("actorType", actorType);
    else next.delete("actorType");
    if (companyId && companyId !== "all") next.set("companyId", companyId);
    else next.delete("companyId");
    if (dateFrom) next.set("dateFrom", new Date(dateFrom).toISOString());
    else next.delete("dateFrom");
    if (dateTo)
      next.set("dateTo", new Date(`${dateTo}T23:59:59`).toISOString());
    else next.delete("dateTo");
    next.delete("page");
    startTransition(() => router.push(`?${next.toString()}`));
  }

  function reset() {
    setQ("");
    setEntityType("all");
    setAction("");
    setActorType("all");
    setCompanyId("all");
    setDateFrom("");
    setDateTo("");
    startTransition(() => router.push("?"));
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4">
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-7">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Actor
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
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Entity Type
          </label>
          <Select
            value={entityType}
            onValueChange={(v) => setEntityType(v ?? "all")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {ENTITY_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Action
          </label>
          <Input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="e.g. score.match.computed"
            onKeyDown={(e) => {
              if (e.key === "Enter") apply();
            }}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Actor Type
          </label>
          <Select
            value={actorType}
            onValueChange={(v) => setActorType(v ?? "all")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {ACTOR_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Company
          </label>
          <Select
            value={companyId}
            onValueChange={(v) => setCompanyId(v ?? "all")}
          >
            <SelectTrigger>
              <SelectValue placeholder="All companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All companies</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      </div>
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
          {isPending && <ButtonSpinner />}
          {isPending ? "Applying..." : "Apply filters"}
        </Button>
      </div>
    </div>
  );
}
