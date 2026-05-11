import { redirect } from "next/navigation";
import { ReviewStepClient } from "./_client";
import { fetchCandidateProfileMe, fetchLatestParsedResume } from "../_data";
import { getCurrentSession } from "@/lib/auth/session";

export const metadata = { title: "Review, Onboarding" };

export default async function Step3Page() {
  const me = await fetchCandidateProfileMe();
  if (me.profileCompleted) redirect("/candidate");
  if (!me.fullName?.trim()) redirect("/onboarding/candidate/personal");

  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const latestResume = await fetchLatestParsedResume();
  const parsed = latestResume?.parsed ?? null;

  // Map parsed-resume v2 entries to the local ExperienceEntry / EducationEntry shapes.
  const initialExperience = (parsed?.experience ?? []).map((e, i) => ({
    id: `exp-${i}`,
    title: e.title,
    company: e.company,
    start_date: e.start_date,
    end_date: e.end_date,
    is_current: e.is_current,
    responsibilities: [...e.responsibilities],
    technologies_used: [...e.technologies_used],
  }));

  const initialEducation = (parsed?.education ?? []).map((e, i) => ({
    id: `edu-${i}`,
    institution: e.institution,
    degree: e.degree,
    field_of_study: e.field_of_study,
    start_year: e.start_year,
    end_year: e.end_year,
    gpa: e.gpa,
  }));

  const initialSkills = (parsed?.skills ?? []).map((s) => s.name);

  return (
    <ReviewStepClient
      initialExperience={initialExperience}
      initialEducation={initialEducation}
      initialSkills={initialSkills}
      latestResume={latestResume}
      accessToken={session.access_token}
    />
  );
}
