import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Apply" };

export default async function ApplyStubPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-[640px] py-12 text-center">
      <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
        Apply flow coming soon
      </h1>
      <p className="mt-2 text-sm text-[var(--color-body)]">
        The apply flow with AI match scoring lands in a future slice. For now,
        you can browse the job details.
      </p>
      <Link
        href={`/candidate/jobs/${id}`}
        className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-6 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-strong)]"
      >
        ← Back to job
      </Link>
    </div>
  );
}
