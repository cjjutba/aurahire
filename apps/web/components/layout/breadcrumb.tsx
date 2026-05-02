"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

const SEGMENT_LABELS: Record<string, string> = {
  candidate: "Candidate",
  recruiter: "Recruiter",
  admin: "Admin",
  jobs: "Jobs",
  applications: "Applications",
  interviews: "Interviews",
  profile: "Profile",
  resume: "Resume",
  settings: "Settings",
  candidates: "Candidates",
  shortlist: "Shortlist",
  offers: "Offers",
  analytics: "Analytics",
  users: "Users",
  audit: "Audit",
  "ai-config": "AI Config",
  "bias-monitor": "Bias Monitor",
  new: "New",
  edit: "Edit",
};

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, idx) => {
    const href = "/" + segments.slice(0, idx + 1).join("/");
    const label =
      SEGMENT_LABELS[segment] ??
      (segment.length > 20 ? `${segment.slice(0, 8)}...` : segment);
    return { href, label, isLast: idx === segments.length - 1 };
  });

  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex items-center gap-2">
        {crumbs.map((c, i) => (
          <Fragment key={c.href}>
            {i > 0 && (
              <span className="text-[var(--color-muted-soft)]">/</span>
            )}
            {c.isLast ? (
              <span className="text-[var(--color-ink)]">{c.label}</span>
            ) : (
              <Link
                href={c.href}
                className="text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
              >
                {c.label}
              </Link>
            )}
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
