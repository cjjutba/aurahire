import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";

import { PasteTokenForm } from "./_paste-token-form";

export const metadata = { title: "Accept Invitation, AuraHire" };

/**
 * Sidebar's "Accept invitation" entry point. Strictly auth-gated, signed-out
 * users get bounced to login, then back here on completion. Signed-in users
 * get the paste-token form which forwards to /invite/{token}.
 */
export default async function InviteIndexPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent("/invite")}`);
  }

  return <PasteTokenForm />;
}
