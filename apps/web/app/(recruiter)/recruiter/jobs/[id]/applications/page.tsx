import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { ApplicationsClient } from "./_applications-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Applications" };

export default async function JobApplicationsPage({ params }: PageProps) {
  const { id: jobId } = await params;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const jobRes = await fetch(`${apiUrl}/api/v1/jobs/${jobId}/for-recruiter`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (jobRes.status === 404) notFound();
  if (!jobRes.ok) {
    return (
      <div className="text-[var(--color-status-danger)]">Failed to load.</div>
    );
  }

  const jobBody = (await jobRes.json()) as { data: { id: string; title: string } };

  return (
    <ApplicationsClient jobId={jobId} jobTitle={jobBody.data.title} />
  );
}
