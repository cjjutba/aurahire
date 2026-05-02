import Link from "next/link";
import { redirect } from "next/navigation";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { fetchCandidateProfileMe, ONBOARDING_STEPS } from "../_data";

export const metadata = { title: "Skills — Onboarding" };

export default async function Step5Page() {
  const me = await fetchCandidateProfileMe();
  if (me.profileCompleted) redirect("/candidate");

  return (
    <WizardShell
      title="Skills"
      description="Your skills will populate from your uploaded resume."
      steps={[...ONBOARDING_STEPS]}
      currentStep={5}
    >
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-6 text-center text-sm text-[var(--color-body)]">
        Coming in a future slice.
      </div>
      <div className="mt-4 flex justify-between">
        <Link
          href="/onboarding/candidate/experience"
          className="inline-flex items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-6 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-strong)]"
        >
          Back
        </Link>
        <Link
          href="/onboarding/candidate/preferences"
          className="inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 py-2 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
        >
          Continue
        </Link>
      </div>
    </WizardShell>
  );
}
