import { redirect } from "next/navigation";
import Link from "next/link";

import { getCurrentSession } from "@/lib/auth/session";

import {
  ProfileScoreDashboardClient,
  type ProfileScoreData,
} from "./_profile-score-dashboard-client";

export const metadata = { title: "My Profile Score" };

export default async function ProfilePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/scoring/profile/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="mx-auto max-w-[1280px] py-12 text-center">
        <p className="text-[var(--color-status-danger)]">
          Failed to load profile score.
        </p>
      </div>
    );
  }

  const body = (await res.json()) as { data: ProfileScoreData | null };

  if (!body.data) {
    return (
      <div className="mx-auto max-w-[1280px] py-16 text-center">
        <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
          No score yet
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          Compute your Profile Score from the dashboard.
        </p>
        <Link
          href="/candidate"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
        >
          Go to dashboard
        </Link>
      </div>
    );
  }

  return <ProfileScoreDashboardClient data={body.data} />;
}
