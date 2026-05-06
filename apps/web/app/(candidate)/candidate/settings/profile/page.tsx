import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { CandidateProfileForm } from "@/components/settings/candidate-profile-form";

export const metadata = { title: "Profile · Settings" };

interface ProfileBody {
  data: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    headline: string | null;
    summary: string | null;
    locationCity: string | null;
    locationRegion: string | null;
    locationCountry: string | null;
  };
}

export default async function CandidateSettingsProfilePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/candidate-profiles/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <>
        <SettingsSectionHeader
          title="Profile"
          subtitle="Your name, contact info, and bio. Changes apply to all your applications."
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
        subtitle="Your name, contact info, and bio. Changes apply to all your applications."
      />

      <SettingsCard
        title="Identity"
        description={`Email ${body.data.email} is set at signup and can't be changed here.`}
      >
        <div className="mb-5 grid gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Email
          </span>
          <span className="text-sm font-medium text-[var(--color-ink)]">
            {body.data.email}
          </span>
        </div>
        <CandidateProfileForm
          defaults={{
            fullName: body.data.fullName,
            phone: body.data.phone ?? "",
            locationCity: body.data.locationCity,
            locationRegion: body.data.locationRegion,
            locationCountry: body.data.locationCountry,
            headline: body.data.headline,
            summary: body.data.summary,
          }}
        />
      </SettingsCard>
    </>
  );
}
