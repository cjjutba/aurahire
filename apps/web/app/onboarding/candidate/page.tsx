import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { fetchCandidateProfileMe, ONBOARDING_STEPS } from "./_data";

export const metadata = { title: "Upload Resume — Onboarding" };

export default async function Step1Page() {
  const me = await fetchCandidateProfileMe();
  if (me.profileCompleted) redirect("/candidate");

  return (
    <WizardShell
      title="Upload your resume"
      description="We'll extract your education, experience, and skills automatically. (Resume upload + AI parse arrive in a future slice — for now, click Skip to fill out manually.)"
      steps={[...ONBOARDING_STEPS]}
      currentStep={1}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-hairline)] bg-[var(--color-surface-soft)] py-12 text-center">
          <div>
            <Sparkles className="mx-auto h-8 w-8 text-[var(--color-muted)]" />
            <p className="mt-3 text-sm text-[var(--color-body)]">
              Resume upload coming in a future slice.
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <Link
            href="/onboarding/candidate/personal"
            className="inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 py-3 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
          >
            Skip for now
          </Link>
        </div>
      </div>
    </WizardShell>
  );
}
