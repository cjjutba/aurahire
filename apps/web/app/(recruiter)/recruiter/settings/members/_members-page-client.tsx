"use client";

import Link from "next/link";

import { useActiveCompany } from "@/contexts/active-company-context";
import { useMembersQuery } from "@/hooks/use-members";

import { MembersInviteButton } from "@/components/settings/members-invite-dialog";
import { MembersTable } from "@/components/settings/members-table";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";

export function MembersPageClient() {
  const ctx = useActiveCompany();
  const role = ctx?.activeMembership?.role ?? null;
  const isOwnerOrAdmin = role === "owner" || role === "admin";
  const { data } = useMembersQuery(isOwnerOrAdmin);

  if (!ctx?.activeMembership) {
    return (
      <>
        <SettingsSectionHeader
          title="Team Members"
          subtitle="Invite, manage, and remove people who can collaborate in this workspace."
        />
        <SettingsCard>
          <p className="text-sm text-[var(--color-muted)]">
            Loading workspace…
          </p>
        </SettingsCard>
      </>
    );
  }

  if (!isOwnerOrAdmin) {
    return (
      <>
        <SettingsSectionHeader
          title="Team Members"
          subtitle="Invite, manage, and remove people who can collaborate in this workspace."
        />
        <SettingsCard>
          <p className="text-sm text-[var(--color-body)]">
            Only owners and admins can manage team members. Ask an admin if you
            need to invite or remove someone.
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

  const counts = countMembers(data?.data ?? []);

  return (
    <>
      <SettingsSectionHeader
        title="Team Members"
        subtitle={
          counts.active > 0 || counts.pending > 0
            ? `${counts.active} active · ${counts.pending} pending`
            : "Invite someone to collaborate in this workspace."
        }
        actions={<MembersInviteButton />}
      />
      <MembersTable />
    </>
  );
}

function countMembers(rows: { status: string }[]) {
  let active = 0;
  let pending = 0;
  for (const r of rows) {
    if (r.status === "active") active += 1;
    else if (r.status === "invited") pending += 1;
  }
  return { active, pending };
}
