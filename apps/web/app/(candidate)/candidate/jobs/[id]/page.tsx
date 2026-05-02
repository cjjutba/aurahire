import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { JobDetail } from "@/components/jobs/job-detail";
import { getCurrentSession } from "@/lib/auth/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Job Detail" };

type JobDetailJob = Parameters<typeof JobDetail>[0]["job"];

export default async function CandidateJobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/jobs/${id}/for-candidate`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (res.status === 404) notFound();
  const body = (await res.json()) as { data: JobDetailJob };

  return (
    <div className="mx-auto max-w-[1024px] space-y-6">
      <Link
        href="/candidate/jobs"
        className="inline-block text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Back to jobs
      </Link>
      <JobDetail
        job={body.data}
        actions={
          <Link
            href={`/candidate/jobs/${id}/apply`}
            className="inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 py-3 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
          >
            Apply Now
          </Link>
        }
      />
    </div>
  );
}
