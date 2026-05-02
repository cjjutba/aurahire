import { redirect } from "next/navigation";
import { getCurrentSession, getCurrentProfile } from "@/lib/auth/session";
import { ProfileScoreCardClient } from "./_components/profile-score-card-client";

export const metadata = { title: "Candidate Dashboard" };

interface ProfileMe {
  id: string;
  fullName: string;
  profileCompleted: boolean;
}

interface InitialScore {
  id: string;
  overallScore: number;
  band: "strong" | "partial" | "limited";
  createdAt: string;
}

export default async function CandidateDashboard() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const profile = (await getCurrentProfile()) as ProfileMe | null;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/scoring/profile/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  let initialScore: InitialScore | null = null;
  if (res.ok) {
    const body = (await res.json()) as { data: InitialScore | null };
    initialScore = body.data;
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <header>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          Welcome back{profile ? `, ${profile.fullName.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          Your AuraHire dashboard.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <ProfileScoreCardClient initial={initialScore} />

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Active Applications
          </h3>
          <p className="mt-3 text-sm text-[var(--color-body)]">
            Coming when you apply to a job.
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Upcoming Interviews
          </h3>
          <p className="mt-3 text-sm text-[var(--color-body)]">
            Will appear when scheduled.
          </p>
        </div>
      </div>
    </div>
  );
}
