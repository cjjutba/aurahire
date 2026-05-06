"use client";

import { useActiveCompany } from "@/contexts/active-company-context";

import {
  DeleteCompanyCard,
  LeaveCompanyCard,
  TransferOwnershipCard,
} from "@/components/settings/danger-zone";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";

export function DangerPageClient() {
  const ctx = useActiveCompany();
  const role = ctx?.activeMembership?.role ?? null;

  if (!ctx?.activeMembership) {
    return (
      <>
        <SettingsSectionHeader
          title="Danger Zone"
          subtitle="Irreversible actions on this workspace and your access to it."
        />
        <SettingsCard>
          <p className="text-sm text-[var(--color-muted)]">
            You don't belong to any workspace yet. Create or join one first.
          </p>
        </SettingsCard>
      </>
    );
  }

  return (
    <>
      <SettingsSectionHeader
        title="Danger Zone"
        subtitle="Irreversible actions on this workspace and your access to it."
      />

      <div className="space-y-6">
        <LeaveCompanyCard />
        {role === "owner" ? (
          <>
            <TransferOwnershipCard />
            <DeleteCompanyCard />
          </>
        ) : null}
      </div>
    </>
  );
}
