// apps/web/app/onboarding/candidate/page.tsx
import { redirect } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { ResumeUploadCard } from "@/components/onboarding/candidate/resume-upload-card";
import { fetchCandidateProfileMe, fetchLatestParsedResume } from "./_data";
import { ONBOARDING_STEPS } from "./_steps";
import { getCurrentSession } from "@/lib/auth/session";

export const metadata = { title: "Upload Resume — Onboarding" };

export default async function Step1Page() {
  const me = await fetchCandidateProfileMe();
  if (me.profileCompleted) redirect("/candidate");

  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const latestResume = await fetchLatestParsedResume();

  return (
    <OnboardingShell
      steps={ONBOARDING_STEPS}
      currentStepId="resume"
      saveStatus="idle"
      title="Upload your resume"
      subtitle="We'll extract your contact info, experience, education, and skills automatically. The AI takes 5–15 seconds."
    >
      <ResumeUploadCard latestResume={latestResume} accessToken={session.access_token} />
    </OnboardingShell>
  );
}
