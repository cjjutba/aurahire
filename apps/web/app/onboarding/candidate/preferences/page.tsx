import { redirect } from "next/navigation";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { CandidatePreferencesForm } from "@/components/onboarding/candidate/preferences-form";
import { fetchCandidateProfileMe, ONBOARDING_STEPS } from "../_data";

export const metadata = { title: "Job Preferences — Onboarding" };

export default async function Step6Page() {
  const me = await fetchCandidateProfileMe();
  if (me.profileCompleted) redirect("/candidate");

  return (
    <WizardShell
      title="Job preferences"
      description="What kind of role are you looking for?"
      steps={[...ONBOARDING_STEPS]}
      currentStep={6}
    >
      <CandidatePreferencesForm
        defaults={{
          desiredRoles: me.desiredRoles,
          desiredSeniority: me.desiredSeniority,
          openTo: me.openTo,
          desiredSalaryMin: me.desiredSalaryMin,
          desiredSalaryMax: me.desiredSalaryMax,
          desiredCurrency: me.desiredCurrency,
          availableStartDate: me.availableStartDate,
        }}
      />
    </WizardShell>
  );
}
