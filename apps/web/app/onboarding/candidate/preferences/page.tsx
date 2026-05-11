import { redirect } from "next/navigation";
import { PreferencesStepClient } from "./_client";
import { fetchCandidateProfileMe, fetchLatestParsedResume } from "../_data";
import { getCurrentSession } from "@/lib/auth/session";

export const metadata = { title: "Job Preferences, Onboarding" };

export default async function Step4Page() {
  const me = await fetchCandidateProfileMe();
  if (me.profileCompleted) redirect("/candidate");
  if (!me.fullName?.trim()) redirect("/onboarding/candidate/personal");

  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const latestResume = await fetchLatestParsedResume();
  const parsed = latestResume?.parsed ?? null;

  const experience = (parsed?.experience ?? []).map((e) => ({
    title: e.title,
    company: e.company,
    start_date: e.start_date,
    end_date: e.end_date,
    is_current: e.is_current,
  }));
  const skills = (parsed?.skills ?? []).map((s) => s.name);

  const defaults = {
    desiredRoles: (me.desiredRoles ?? []).join(", "),
    desiredSeniority: me.desiredSeniority ?? "",
    openTo: me.openTo ?? [],
    desiredSalaryMin: me.desiredSalaryMin?.toString() ?? "",
    desiredSalaryMax: me.desiredSalaryMax?.toString() ?? "",
    desiredCurrency: me.desiredCurrency ?? "USD",
    availableStartDate: me.availableStartDate ?? "",
  };

  return (
    <PreferencesStepClient
      defaults={defaults}
      accessToken={session.access_token}
      me={me}
      experience={experience}
      skills={skills}
    />
  );
}
