import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { PrivacySection } from "@/components/settings/privacy-section";

export const metadata = { title: "Privacy · Settings" };

interface ProfileBody {
  data: { email: string };
}

export default async function CandidateSettingsPrivacyPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/candidate-profiles/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });
  const email = res.ok ? ((await res.json()) as ProfileBody).data.email : "";

  return (
    <>
      <SettingsSectionHeader
        title="Privacy"
        subtitle="Export the data we hold about you, or request account deletion."
      />
      <PrivacySection email={email} />
    </>
  );
}
