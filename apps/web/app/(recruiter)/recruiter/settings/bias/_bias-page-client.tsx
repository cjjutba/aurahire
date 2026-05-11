"use client";

import Link from "next/link";

import { useActiveCompany } from "@/contexts/active-company-context";
import { BIAS_CATEGORY } from "@aurahire/shared";

import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";

const CATEGORY_LABELS: Record<string, string> = {
  gendered: "Gendered language",
  "age-coded": "Age-coded phrases",
  ableist: "Ableist phrases",
  exclusionary: "Exclusionary phrases",
  other: "Other",
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  gendered:
    'Detects gender-coded vocabulary (e.g. "rockstar", "manpower") in job descriptions.',
  "age-coded":
    'Flags age-coded phrasing (e.g. "digital native", "recent grad") that excludes candidates by age.',
  ableist:
    'Identifies ableist language (e.g. "crazy hours", "sanity check") that may dissuade disabled applicants.',
  exclusionary:
    "Surfaces phrases that exclude protected groups (e.g. citizenship, family status).",
  other: "Catch-all for biased phrasing that doesn't fit the categories above.",
};

/**
 * Per-company bias thresholds aren't wired yet, this page is a
 * read-only confirmation that all categories are detected with default
 * thresholds. The Phase 5 spec explicitly designates this section as a
 * stub for now.
 */
export function BiasPageClient() {
  const ctx = useActiveCompany();
  const role = ctx?.activeMembership?.role ?? null;
  const isOwnerOrAdmin = role === "owner" || role === "admin";

  if (!isOwnerOrAdmin) {
    return (
      <>
        <SettingsSectionHeader
          title="Bias & Fairness"
          subtitle="Detection categories applied to every job description before publish."
        />
        <SettingsCard>
          <p className="text-sm text-[var(--color-body)]">
            Only owners and admins can view bias-detection settings.
          </p>
          <div className="mt-4">
            <Link
              href="/recruiter/settings/profile"
              className="inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-6 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline)]"
            >
              Back to profile
            </Link>
          </div>
        </SettingsCard>
      </>
    );
  }

  return (
    <>
      <SettingsSectionHeader
        title="Bias & Fairness"
        subtitle="Detection categories applied to every job description before publish."
      />

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-primary-soft)] bg-[var(--color-primary-soft)]/30 p-4 text-sm text-[var(--color-ink)]">
        Per-company bias thresholds will sync to the AI pipeline in a future
        release. Today, every category is checked at the system default
        sensitivity.
      </div>

      <SettingsCard
        title="Detection categories"
        description="All categories enabled by default."
      >
        <ul className="divide-y divide-[var(--color-hairline-soft)]">
          {BIAS_CATEGORY.map((cat) => (
            <li
              key={cat}
              className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-ink)]">
                  {CATEGORY_LABELS[cat] ?? cat}
                </p>
                <p className="mt-1 text-sm text-[var(--color-body)]">
                  {CATEGORY_DESCRIPTIONS[cat] ?? ""}
                </p>
              </div>
              {/* Read-only "on" toggle, visually identical to the live one but inert */}
              <span
                role="switch"
                aria-checked="true"
                aria-disabled="true"
                className="relative mt-1 inline-flex h-6 w-11 shrink-0 cursor-not-allowed items-center rounded-full bg-[var(--color-primary)] opacity-90"
              >
                <span className="ml-1 inline-block h-4 w-4 translate-x-5 rounded-full bg-[var(--color-canvas)] shadow" />
              </span>
            </li>
          ))}
        </ul>
      </SettingsCard>

      <SettingsCard
        title="Override audit"
        description="A timeline of recruiter overrides on flagged phrases."
        trailing={
          <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Coming soon
          </span>
        }
      >
        <p className="text-sm text-[var(--color-body)]">
          Overrides are already recorded in audit logs. A dedicated per-company
          timeline view will surface here in a future release.
        </p>
      </SettingsCard>
    </>
  );
}
