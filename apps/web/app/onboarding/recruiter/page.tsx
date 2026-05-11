import { redirect } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { RecruiterAboutForm } from "@/components/onboarding/recruiter/about-form";
import { getCurrentSession } from "@/lib/auth/session";
import { fetchMyMemberships } from "@/lib/memberships-server";
import { RECRUITER_ONBOARDING_STEPS } from "./_steps";

export const metadata = { title: "About You, Onboarding" };

export default async function RecruiterAboutPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  // No active membership → user hasn't picked the create-vs-join fork yet.
  // Bounce them through it. Backfilled accounts (created before the fork
  // existed) already have a membership, so this only triggers for genuinely
  // new flows.
  const memberships = await fetchMyMemberships(session.access_token);
  const activeMemberships = memberships.filter((m) => m.status === "active");
  if (activeMemberships.length === 0) {
    redirect("/onboarding/start");
  }

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
      fullName: string;
      phone: string | null;
      jobTitle: string | null;
      department: string | null;
      profileCompleted: boolean;
    };
  };

  if (body.data.profileCompleted) redirect("/recruiter");

  return (
    <OnboardingShell
      steps={RECRUITER_ONBOARDING_STEPS}
      currentStepId="about"
      saveStatus="idle"
      title="Tell us about yourself"
      subtitle="Just the basics, we'll tailor the platform to your role."
    >
      <RecruiterAboutForm
        defaults={{
          fullName: body.data.fullName,
          phone: body.data.phone ?? "",
          jobTitle: body.data.jobTitle,
          department: body.data.department,
        }}
      />
    </OnboardingShell>
  );
}
