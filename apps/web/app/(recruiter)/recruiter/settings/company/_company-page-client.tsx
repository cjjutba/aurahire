"use client";

import Link from "next/link";

import { useActiveCompany } from "@/contexts/active-company-context";

import { CompanyForm } from "@/components/settings/company-form";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";

/**
 * Client wrapper that gates the form on owner/admin. The rail already
 * hides the link for plain recruiters, but a deep link past the URL bar
 * shouldn't reveal the form — we render an explicit "no permission"
 * state so the URL is always honest.
 */
export function CompanyPageClient() {
  const ctx = useActiveCompany();
  const role = ctx?.activeMembership?.role ?? null;
  const canEdit = role === "owner" || role === "admin";

  if (!ctx?.activeMembership) {
    return (
      <>
        <SettingsSectionHeader
          title="Company"
          subtitle="Edit the workspace's brand profile."
        />
        <SettingsCard>
          <p className="text-sm text-[var(--color-muted)]">
            Loading workspace…
          </p>
        </SettingsCard>
      </>
    );
  }

  if (!canEdit) {
    return (
      <>
        <SettingsSectionHeader
          title="Company"
          subtitle="Edit the workspace's brand profile."
        />
        <SettingsCard>
          <p className="text-sm text-[var(--color-body)]">
            Only owners and admins can edit the company profile. Ask the
            workspace owner if you need to make changes here.
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
        title="Company"
        subtitle={`Brand profile for ${ctx.activeMembership.companyName}.`}
      />
      <SettingsCard
        title="Brand profile"
        description="Shown on candidate-facing job pages and outbound emails."
      >
        <CompanyForm />
      </SettingsCard>
    </>
  );
}
