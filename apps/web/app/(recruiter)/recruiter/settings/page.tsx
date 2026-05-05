import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { RecruiterSettingsForm } from "./_settings-form-client";

export const metadata = { title: "Settings" };

interface ProfileBody {
  data: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    jobTitle: string | null;
    department: string | null;
    company: { id: string; name: string } | null;
  };
}

export default async function RecruiterSettingsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/recruiter-profiles/me`, {
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
    <div className="mx-auto max-w-[1280px] space-y-6">
      <div className="max-w-[720px] space-y-6">
        <header>
          <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
            Settings
          </h1>
          <p className="mt-1 text-sm text-[var(--color-body)]">
            Update your contact info and role at <strong>{body.data.company?.name ?? "your company"}</strong>.
          </p>
        </header>

        <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
          <h2 className="mb-1 text-base font-semibold text-[var(--color-ink)]">
            Profile
          </h2>
          <p className="mb-4 text-xs text-[var(--color-muted)]">
            Email <strong>{body.data.email}</strong> is set at signup and can&apos;t be changed here.
          </p>
          <RecruiterSettingsForm
            defaults={{
              fullName: body.data.fullName,
              phone: body.data.phone ?? "",
              jobTitle: body.data.jobTitle,
              department: body.data.department,
            }}
          />
        </section>
      </div>
    </div>
  );
}
