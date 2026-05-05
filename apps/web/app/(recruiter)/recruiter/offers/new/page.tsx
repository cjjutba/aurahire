import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";
import { OfferFormClient } from "./_offer-form-client";

export const metadata = { title: "Send Offer" };

interface PageProps {
  searchParams: Promise<{ applicationId?: string }>;
}

interface AppContext {
  id: string;
  job: { title: string; company: { name: string } } | null;
  candidate: { fullName: string } | null;
}

export default async function NewOfferPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  if (!sp.applicationId) notFound();

  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/applications/${sp.applicationId}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });
  if (res.status === 404) notFound();
  if (!res.ok) {
    return <div className="text-[var(--color-status-danger)]">Failed to load.</div>;
  }
  const body = (await res.json()) as { data: AppContext };

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <div className="max-w-[720px] space-y-6">
        <Link
          href={`/recruiter/applications/${body.data.id}`}
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          ← Back to application
        </Link>
        <header>
          <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
            Send Offer
          </h1>
          <p className="mt-1 text-sm text-[var(--color-body)]">
            To <strong>{body.data.candidate?.fullName ?? "candidate"}</strong> for{" "}
            <strong>{body.data.job?.title ?? "the role"}</strong>
            {body.data.job?.company.name ? <> at {body.data.job.company.name}</> : null}.
          </p>
        </header>
        <OfferFormClient
          applicationId={body.data.id}
          defaultTitle={body.data.job?.title ?? ""}
        />
      </div>
    </div>
  );
}
