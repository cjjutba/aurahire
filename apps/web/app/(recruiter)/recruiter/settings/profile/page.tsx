import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { RecruiterProfileForm } from "@/components/settings/recruiter-profile-form";

export const metadata = { title: "Profile · Settings" };

interface ProfileBody {
  data: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    jobTitle: string | null;
    department: string | null;
    company: { id: string; name: string } | null;
  };
}

/**
 * GET /api/v1/recruiter-profiles/me — fetched server-side so the form is
 * pre-populated on the very first paint. The active company id is
 * resolved by the API server (via ActiveCompanyGuard fallback to the
 * stored profiles.lastActiveCompanyId), so we don't need to forward
 * X-Active-Company-Id from the SSR request.
 */
export default async function RecruiterSettingsProfilePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/recruiter-profiles/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <>
        <SettingsSectionHeader
          title="Profile"
          subtitle="Update your contact info and role at your company."
        />
        <SettingsCard>
          <p className="text-sm text-[var(--color-status-danger)]">
            Failed to load profile. Refresh to try again.
          </p>
        </SettingsCard>
      </>
    );
  }

  const body = (await res.json()) as ProfileBody;

  return (
    <>
      <SettingsSectionHeader
        title="Profile"
        subtitle="Update your contact info and role at your company."
      />

      <SettingsCard
        title="Identity"
        description={`Email ${body.data.email} is set at signup and can't be changed here.`}
      >
        {/*
          Email is intentionally rendered as read-only text rather than a
          disabled input — Supabase Auth is the source of truth, and a
          changeable email field would imply we re-verify it ourselves.
        */}
        <div className="mb-5 grid gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Email
          </span>
          <span className="text-sm font-medium text-[var(--color-ink)]">
            {body.data.email}
          </span>
        </div>
        <RecruiterProfileForm
          defaults={{
            fullName: body.data.fullName,
            phone: body.data.phone ?? "",
            jobTitle: body.data.jobTitle,
            department: body.data.department,
          }}
        />
      </SettingsCard>
    </>
  );
}
