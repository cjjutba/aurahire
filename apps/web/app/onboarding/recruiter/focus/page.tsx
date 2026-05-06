import { redirect } from "next/navigation";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { RecruiterFocusForm } from "@/components/onboarding/recruiter/focus-form";
import { getCurrentSession } from "@/lib/auth/session";

export const metadata = { title: "Hiring Focus — Onboarding" };

// Phase 4: 2-step wizard post-membership-acquisition. The company step is
// implicit (either created via /onboarding/recruiter/company-create or
// joined via /onboarding/invite before reaching this wizard).
const STEPS = [{ label: "About" }, { label: "Focus" }];

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
    <WizardShell
      title="Your hiring focus"
      description="What kinds of roles do you typically hire for?"
      steps={STEPS}
      currentStep={2}
    >
      <RecruiterFocusForm
        defaults={{
          rolesHiringFor: body.data.rolesHiringFor,
          hiringVolumePerQuarter:
            body.data.hiringVolumePerQuarter as HiringVolume | null,
        }}
      />
    </WizardShell>
  );
}
