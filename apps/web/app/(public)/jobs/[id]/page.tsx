import Link from "next/link";
import { notFound } from "next/navigation";
import { JobDetail } from "@/components/jobs/job-detail";
import { getCurrentSession } from "@/lib/auth/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Job Detail" };

type JobDetailJob = Parameters<typeof JobDetail>[0]["job"];

export default async function PublicJobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/jobs/${id}`, { cache: "no-store" });
  if (res.status === 404) notFound();

  const body = (await res.json()) as { data: JobDetailJob };
  const session = await getCurrentSession();

  const applyHref = session
    ? `/candidate/jobs/${id}`
    : `/login?redirect=/candidate/jobs/${id}`;

  return (
    <div className="mx-auto max-w-[1024px] px-6 py-12">
      <Link
        href="/jobs"
        className="inline-block text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Back to all jobs
      </Link>
      <div className="mt-6">
        <JobDetail
          job={body.data}
          actions={
            <Link
              href={applyHref}
              className="inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 py-3 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
            >
              {session ? "Apply Now" : "Sign in to apply"}
            </Link>
          }
        />
      </div>
    </div>
  );
}
