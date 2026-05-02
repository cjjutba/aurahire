import { redirect } from "next/navigation";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { CandidatePersonalInfoForm } from "@/components/onboarding/candidate/personal-info-form";
import {
  fetchCandidateProfileMe,
  fetchLatestParsedResume,
  ONBOARDING_STEPS,
} from "../_data";

export const metadata = { title: "Personal Info — Onboarding" };

export default async function Step2Page() {
  const me = await fetchCandidateProfileMe();
  if (me.profileCompleted) redirect("/candidate");

  const latestResume = await fetchLatestParsedResume();
  const parsedContact = latestResume?.parsed?.contact ?? null;
  const parsedSummary = latestResume?.parsed?.summary ?? null;

  const aiSuggestedFields: Record<string, boolean> = {};

  const defaults = {
    fullName: me.fullName,
    phone: me.phone ?? parsedContact?.phone ?? "",
    headline: me.headline,
    summary: me.summary ?? parsedSummary ?? null,
    locationCity: me.locationCity ?? parsedContact?.location_city ?? null,
    locationRegion: me.locationRegion,
    locationCountry: me.locationCountry ?? parsedContact?.location_country ?? null,
  };

  if (!me.phone && parsedContact?.phone) aiSuggestedFields.phone = true;
  if (!me.summary && parsedSummary) aiSuggestedFields.summary = true;
  if (!me.locationCity && parsedContact?.location_city) aiSuggestedFields.locationCity = true;
  if (!me.locationCountry && parsedContact?.location_country)
    aiSuggestedFields.locationCountry = true;

  return (
    <WizardShell
      title="Tell us about yourself"
      description={
        latestResume?.parseStatus === "parsed"
          ? "Some fields are prefilled from your resume — review and edit as needed."
          : "A short bio that shows up on your profile."
      }
      steps={[...ONBOARDING_STEPS]}
      currentStep={2}
    >
      <CandidatePersonalInfoForm defaults={defaults} aiSuggestedFields={aiSuggestedFields} />
    </WizardShell>
  );
}
