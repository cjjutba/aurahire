"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink } from "lucide-react";

interface Override {
  flagId: string;
  term: string;
  category: string;
  jobId: string;
  jobTitle: string;
  overriddenBy: { id: string; fullName: string } | null;
  overrideReason: string;
  overriddenAt: string;
}

interface Props {
  overrides: Override[];
}

const CATEGORY_LABEL: Record<string, string> = {
  gendered: "Gendered",
  "age-coded": "Age-coded",
  ableist: "Ableist",
  exclusionary: "Exclusionary",
  other: "Other",
};

const REASON_TRUNCATE = 120;

function ReasonBlock({ reason }: { reason: string }) {
  const [expanded, setExpanded] = useState(false);
  if (reason.length <= REASON_TRUNCATE) {
    return (
      <p className="mt-1 text-sm text-[var(--color-body)]">{reason}</p>
    );
  }
  return (
    <div className="mt-1 text-sm text-[var(--color-body)]">
      {expanded ? reason : `${reason.slice(0, REASON_TRUNCATE)}…`}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="ml-2 text-xs text-[var(--color-primary)] hover:underline"
      >
        {expanded ? "show less" : "show more"}
      </button>
    </div>
  );
}

export function RecentOverridesList({ overrides }: Props) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
      <header className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Recent Override Decisions
        </h3>
        <p className="mt-1 text-xs text-[var(--color-body)]">
          Every flag a recruiter chose to keep, with their written reason. The
          audit-grade trail: who decided, when, and why.
        </p>
      </header>

      {overrides.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-[var(--color-muted)]">
          No overrides in this period.
        </div>
      ) : (
        <ol className="divide-y divide-[var(--color-hairline-soft)]">
          {overrides.map((o) => (
            <li key={o.flagId} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded-[var(--radius-pill)] bg-[var(--color-score-mid-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-score-mid)]">
                    {CATEGORY_LABEL[o.category] ?? o.category}
                  </span>
                  <strong className="font-mono text-sm text-[var(--color-ink)]">
                    &ldquo;{o.term}&rdquo;
                  </strong>
                  <span className="text-xs text-[var(--color-muted)]">
                    overridden by{" "}
                    <strong className="text-[var(--color-body)]">
                      {o.overriddenBy?.fullName ?? "(unknown)"}
                    </strong>
                  </span>
                </div>
                <time className="whitespace-nowrap text-xs text-[var(--color-muted)]">
                  {new Date(o.overriddenAt).toLocaleString()}
                </time>
              </div>
              <ReasonBlock reason={o.overrideReason} />
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="text-[var(--color-muted)]">on job:</span>
                <Link
                  href={`/admin/jobs?openId=${o.jobId}`}
                  className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                >
                  {o.jobTitle}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
