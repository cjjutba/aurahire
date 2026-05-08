import { redirect } from "next/navigation";

import { getCurrentProfile, getCurrentSession } from "@/lib/auth/session";

import { AnalyzingClient } from "./_analyzing-client";

export const metadata = { title: "Analyzing — Onboarding" };

/**
 * Onboarding bridge between the preferences step and the candidate dashboard.
 *
 * The preferences form no longer calls `complete-onboarding` itself — it now
 * forwards the candidate here, and this screen owns the call. That gives the
 * UI a chance to render a state-machine experience (shimmer → Score Ring →
 * "N of 5 matches ready" → redirect) instead of leaving the candidate staring
 * at a finishing-button spinner for several seconds.
 *
 * If the candidate has already completed onboarding (e.g. they hit refresh
 * after the redirect fired), bounce them straight to the dashboard. The
 * client component handles the API call exactly once on mount; rendering it
 * a second time would double-charge the AI compute.
 */
export default async function AnalyzingPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const profile = (await getCurrentProfile()) as
    | { id: string; role: string; profileCompleted: boolean }
    | null;
  if (!profile) redirect("/login");
  if (profile.role !== "candidate") redirect("/");
  if (profile.profileCompleted) redirect("/candidate");

  return <AnalyzingClient candidateId={profile.id} />;
}
