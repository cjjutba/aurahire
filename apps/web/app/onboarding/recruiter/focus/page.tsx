import { redirect } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { RecruiterFocusForm } from "@/components/onboarding/recruiter/focus-form";
import { getCurrentSession } from "@/lib/auth/session";
import { RECRUITER_ONBOARDING_STEPS } from "../_steps";

export const metadata = { title: "Hiring Focus — Onboarding" };

type HiringVolume = "1-5" | "6-10" | "11-25" | "25+";

export default async function RecruiterFocusPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/recruiter-profiles/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (res.status === 403) redirect("/login");
  if (!res.ok) {
    return (
      <div className="p-8 text-center text-[var(--color-status-danger)]">
        Failed to load profile.
      </div>
    );
  }

  const body = (await res.json()) as {
    data: {
      profileCompleted: boolean;
      rolesHiringFor: string[];
      hiringVolumePerQuarter: string | null;
    };
  };

  if (body.data.profileCompleted) redirect("/recruiter");

  return (
    <OnboardingShell
      steps={RECRUITER_ONBOARDING_STEPS}
      currentStepId="focus"
      saveStatus="idle"
      title="Your hiring focus"
      subtitle="A quick read on what you typically hire for — this lets us tune relevance from day one."
    >
      <RecruiterFocusForm
        defaults={{
          rolesHiringFor: body.data.rolesHiringFor,
          hiringVolumePerQuarter: body.data
            .hiringVolumePerQuarter as HiringVolume | null,
        }}
      />
    </OnboardingShell>
  );
}
