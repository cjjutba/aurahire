import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { VenuesListClient } from "./_venues-list-client";

export const metadata = { title: "Interview Venues · AuraHire" };

export default async function InterviewVenuesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return <VenuesListClient />;
}
