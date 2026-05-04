import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Interviews" };

interface InterviewRow {
  id: string;
  applicationId: string;
  scheduledAt: string;
  durationMinutes: number;
  format: string;
  locationOrLink: string | null;
  status: string;
}

const FORMAT_LABELS: Record<string, string> = {
  phone: "Phone",
  video: "Video",
  "in-person": "In-Person",
};

export default async function RecruiterInterviewsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/interviews/by-recruiter/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    return <div className="text-[var(--color-status-danger)]">Failed to load.</div>;
  }
  const body = (await res.json()) as { data: InterviewRow[] };

  const now = new Date();
  const upcoming = body.data.filter(
    (i) => new Date(i.scheduledAt) >= now && i.status === "scheduled",
  );
  const past = body.data.filter(
    (i) => new Date(i.scheduledAt) < now || i.status !== "scheduled",
  );

  return (
    <div className="mx-auto max-w-[1024px] space-y-6">
      <header>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          Interviews
        </h1>
        <p className="mt-1 text-sm text-[var(--color-body)]">
          Schedule and track interviews with shortlisted candidates.
        </p>
      </header>

      {body.data.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-6 w-6" />}
          headline="No interviews scheduled"
          description="Open an application from your job's pipeline to schedule an interview."
          cta={{ href: "/recruiter/jobs", label: "View jobs" }}
        />
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Upcoming
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No upcoming interviews.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((i) => (
                  <li
                    key={i.id}
                    className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <strong className="text-[var(--color-ink)]">
                        {new Date(i.scheduledAt).toLocaleString()}
                      </strong>
                      <span className="text-xs text-[var(--color-muted)]">
                        {FORMAT_LABELS[i.format] ?? i.format} · {i.durationMinutes} min
                      </span>
                    </div>
                    {i.locationOrLink && (
                      <p className="mt-1 break-all text-xs text-[var(--color-body)]">
                        {i.locationOrLink}
                      </p>
                    )}
                    <Link
                      href={`/recruiter/applications/${i.applicationId}`}
                      className="mt-2 inline-block text-xs text-[var(--color-primary)] hover:underline"
                    >
                      View application →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {past.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Past
              </h2>
              <ul className="space-y-2 opacity-80">
                {past.map((i) => (
                  <li
                    key={i.id}
                    className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[var(--color-ink)]">
                        {new Date(i.scheduledAt).toLocaleString()}
                      </span>
                      <span className="text-xs text-[var(--color-muted)]">
                        {FORMAT_LABELS[i.format] ?? i.format} · {i.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
