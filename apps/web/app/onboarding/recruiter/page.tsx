import { redirect } from "next/navigation";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { RecruiterAboutForm } from "@/components/onboarding/recruiter/about-form";
import { getCurrentSession } from "@/lib/auth/session";

export const metadata = { title: "About You — Onboarding" };

const STEPS = [{ label: "About" }, { label: "Company" }, { label: "Focus" }];

export default async function RecruiterAboutPage() {
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
      fullName: string;
      phone: string | null;
      jobTitle: string | null;
      department: string | null;
      profileCompleted: boolean;
    };
  };

  if (body.data.profileCompleted) redirect("/recruiter");

  return (
    <WizardShell
      title="Tell us about yourself"
      description="Just the basics — we'll tailor the platform to your role."
      steps={STEPS}
      currentStep={1}
    >
      <RecruiterAboutForm
        defaults={{
          fullName: body.data.fullName,
          phone: body.data.phone ?? "",
          jobTitle: body.data.jobTitle,
          department: body.data.department,
        }}
      />
    </WizardShell>
  );
}
