import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { ApplyFormClient } from "./_apply-form-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Apply to Job" };

export default async function ApplyPage({ params }: PageProps) {
  const { id: jobId } = await params;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

  const [jobRes, resumesRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/jobs/${jobId}/for-candidate`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    }),
    fetch(`${apiUrl}/api/v1/resumes/mine`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    }),
  ]);

  if (jobRes.status === 404) notFound();
  if (!jobRes.ok || !resumesRes.ok) {
    return (
      <div className="text-[var(--color-status-danger)]">Failed to load.</div>
    );
  }

  const jobBody = (await jobRes.json()) as {
    data: { id: string; title: string; company: { name: string } };
  };
  const resumesBody = (await resumesRes.json()) as {
    data: Array<{
      id: string;
      filename: string;
      isDefault: boolean;
      parseStatus: string;
    }>;
  };

  const parsedResumes = resumesBody.data.filter((r) => r.parseStatus === "parsed");

  return (
    <div className="mx-auto max-w-[1280px] py-8">
      <div className="max-w-[720px]">
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          Apply to {jobBody.data.title}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          at {jobBody.data.company.name}
        </p>

        <div className="mt-8 rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-8">
          {parsedResumes.length === 0 ? (
            <div className="text-center">
              <p className="text-[var(--color-body)]">
                You don&apos;t have any parsed resumes yet.
              </p>
              <a
                href="/onboarding/candidate"
                className="mt-4 inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 py-2 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
              >
                Upload a resume first
              </a>
            </div>
          ) : (
            <ApplyFormClient jobId={jobId} resumes={parsedResumes} />
          )}
        </div>
      </div>
    </div>
  );
}
