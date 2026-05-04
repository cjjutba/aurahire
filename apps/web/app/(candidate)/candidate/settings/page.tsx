import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { CandidateSettingsForm } from "./_settings-form-client";

export const metadata = { title: "Settings" };

interface ProfileBody {
  data: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    headline: string | null;
    summary: string | null;
    locationCity: string | null;
    locationRegion: string | null;
    locationCountry: string | null;
  };
}

export default async function CandidateSettingsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/candidate-profiles/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="text-[var(--color-status-danger)]">
        Failed to load profile.
      </div>
    );
  }

  const body = (await res.json()) as ProfileBody;

  return (
    <div className="mx-auto max-w-[720px] space-y-6">
      <header>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[var(--color-body)]">
          Update your name, contact info, and bio. Changes apply to all your applications.
        </p>
      </header>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <h2 className="mb-1 text-base font-semibold text-[var(--color-ink)]">
          Profile
        </h2>
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          Email <strong>{body.data.email}</strong> is set at signup and can&apos;t be changed here.
        </p>
        <CandidateSettingsForm
          defaults={{
            fullName: body.data.fullName,
            phone: body.data.phone ?? "",
            locationCity: body.data.locationCity,
            locationRegion: body.data.locationRegion,
            locationCountry: body.data.locationCountry,
            headline: body.data.headline,
            summary: body.data.summary,
          }}
        />
      </section>
    </div>
  );
}
