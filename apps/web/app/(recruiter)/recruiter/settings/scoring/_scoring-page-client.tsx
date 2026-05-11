"use client";

import { useState } from "react";
import Link from "next/link";

import { useActiveCompany } from "@/contexts/active-company-context";

import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";

interface Weights {
  skills: number;
  experience: number;
  education: number;
  keywords: number;
}

const DEFAULTS: Weights = {
  skills: 40,
  experience: 30,
  education: 20,
  keywords: 10,
};

const FIELDS: { key: keyof Weights; label: string; help: string }[] = [
  {
    key: "skills",
    label: "Skills",
    help: "Match of resume skills against job-required skills.",
  },
  {
    key: "experience",
    label: "Experience",
    help: "Years and relevance of past roles to the job.",
  },
  {
    key: "education",
    label: "Education",
    help: "Degree level and field alignment with the role.",
  },
  {
    key: "keywords",
    label: "Keywords",
    help: "Free-text terms from the job description.",
  },
];

/**
 * Scoring weights are global (per the Phase 2c report), there's no
 * per-company write endpoint exposed yet. We render the canonical
 * defaults read-only with sliders so a recruiter can see what the AI
 * applies without wondering where the numbers come from.
 */
export function ScoringPageClient() {
  const ctx = useActiveCompany();
  const role = ctx?.activeMembership?.role ?? null;
  const isOwnerOrAdmin = role === "owner" || role === "admin";

  const [weights] = useState<Weights>(DEFAULTS);
  const total =
    weights.skills + weights.experience + weights.education + weights.keywords;

  if (!isOwnerOrAdmin) {
    return (
      <>
        <SettingsSectionHeader
          title="Scoring"
          subtitle="The weights AuraHire uses when computing every match score."
        />
        <SettingsCard>
          <p className="text-sm text-[var(--color-body)]">
            Only owners and admins can view scoring configuration.
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
        title="Scoring"
        subtitle="The weights AuraHire uses when computing every match score."
      />

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-primary-soft)] bg-[var(--color-primary-soft)]/30 p-4 text-sm text-[var(--color-ink)]">
        These weights are global across AuraHire today. Per-company tuning will
        land in a future release; for now this view is read-only.
      </div>

      <SettingsCard
        title="Weights"
        description={`Components total ${total}/100.`}
        trailing={
          <span className="font-mono text-sm font-medium text-[var(--color-ink)]">
            {total}/100
          </span>
        }
      >
        <ul className="space-y-5">
          {FIELDS.map((f) => {
            const value = weights[f.key];
            return (
              <li key={f.key} className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-ink)]">
                      {f.label}
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {f.help}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-medium text-[var(--color-ink)]">
                    {value}
                  </span>
                </div>
                {/* Disabled native slider keeps native a11y while signalling read-only. */}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={value}
                  disabled
                  className="w-full accent-[var(--color-primary)] disabled:opacity-60"
                  aria-label={`${f.label} weight`}
                />
              </li>
            );
          })}
        </ul>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-[var(--radius-pill)] bg-[var(--color-primary-disabled)] px-6 py-2 text-sm font-semibold text-[var(--color-on-primary)]"
          >
            Save (coming soon)
          </button>
        </div>
      </SettingsCard>
    </>
  );
}
