import { redirect } from "next/navigation";
import { PersonalStepClient } from "./_client";
import { fetchCandidateProfileMe, fetchLatestParsedResume } from "../_data";
import { getCurrentSession } from "@/lib/auth/session";

export const metadata = { title: "Personal Info, Onboarding" };

export default async function Step2Page() {
  // Run the three independent fetches in parallel, sequential awaits added
  // ~3s of server time to every navigation into Step 2.
  const [me, session, latestResume] = await Promise.all([
    fetchCandidateProfileMe(),
    getCurrentSession(),
    fetchLatestParsedResume(),
  ]);

  if (me.profileCompleted) redirect("/candidate");
  if (!session) redirect("/login");
  const parsed = latestResume?.parsed ?? null;
  const parsedContact = parsed?.contact ?? null;
  const parsedSummary = parsed?.summary ?? null;

  // Derive headline from most recent (preferably current) experience title.
  const experiences = parsed?.experience ?? [];
  const currentRole = experiences.find((e) => e?.is_current && e?.title);
  const mostRecentRole = experiences.find((e) => e?.title);
  const parsedHeadline = currentRole?.title ?? mostRecentRole?.title ?? null;

  const defaults = {
    fullName: me.fullName ?? "",
    phone: me.phone ?? parsedContact?.phone ?? "",
    headline: me.headline ?? parsedHeadline ?? "",
    summary: me.summary ?? parsedSummary?.text ?? "",
    locationCity: me.locationCity ?? parsedContact?.location_city ?? "",
    locationRegion: me.locationRegion ?? "",
    locationCountry:
      me.locationCountry ?? parsedContact?.location_country ?? "",
  };

  const aiSuggestedFields: Partial<Record<keyof typeof defaults, boolean>> = {};
  if (!me.phone && parsedContact?.phone) aiSuggestedFields.phone = true;
  if (!me.headline && parsedHeadline) aiSuggestedFields.headline = true;
  if (!me.summary && parsedSummary?.text) aiSuggestedFields.summary = true;
  if (!me.locationCity && parsedContact?.location_city)
    aiSuggestedFields.locationCity = true;
  if (!me.locationCountry && parsedContact?.location_country)
    aiSuggestedFields.locationCountry = true;

  return (
    <PersonalStepClient
      defaults={defaults}
      aiSuggestedFields={aiSuggestedFields}
      accessToken={session.access_token}
      latestResume={latestResume}
    />
  );
}
