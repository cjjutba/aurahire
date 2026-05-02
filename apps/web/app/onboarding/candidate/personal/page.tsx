import { redirect } from "next/navigation";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { CandidatePersonalInfoForm } from "@/components/onboarding/candidate/personal-info-form";
import { fetchCandidateProfileMe, ONBOARDING_STEPS } from "../_data";

export const metadata = { title: "Personal Info — Onboarding" };

export default async function Step2Page() {
  const me = await fetchCandidateProfileMe();
  if (me.profileCompleted) redirect("/candidate");

  return (
    <WizardShell
      title="Tell us about yourself"
      description="A short bio that shows up on your profile."
      steps={[...ONBOARDING_STEPS]}
      currentStep={2}
    >
      <CandidatePersonalInfoForm
        defaults={{
          fullName: me.fullName,
          phone: me.phone ?? "",
          headline: me.headline,
          summary: me.summary,
          locationCity: me.locationCity,
          locationRegion: me.locationRegion,
          locationCountry: me.locationCountry,
        }}
      />
    </WizardShell>
  );
}
