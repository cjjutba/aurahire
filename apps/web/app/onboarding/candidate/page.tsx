import { redirect } from "next/navigation";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { ResumeUpload } from "@/components/onboarding/candidate/resume-upload";
import { fetchCandidateProfileMe, ONBOARDING_STEPS } from "./_data";

export const metadata = { title: "Upload Resume — Onboarding" };

export default async function Step1Page() {
  const me = await fetchCandidateProfileMe();
  if (me.profileCompleted) redirect("/candidate");

  return (
    <WizardShell
      title="Upload your resume"
      description="We'll extract your contact info, experience, education, and skills automatically. The AI takes 5–15 seconds."
      steps={[...ONBOARDING_STEPS]}
      currentStep={1}
    >
      <ResumeUpload />
    </WizardShell>
  );
}
