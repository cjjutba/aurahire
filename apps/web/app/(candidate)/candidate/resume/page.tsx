import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { getCurrentSession } from "@/lib/auth/session";

export const metadata = { title: "Resume" };

interface ResumeRow {
  id: string;
  filename: string;
  parseStatus: string;
  isDefault: boolean;
  createdAt: string;
  sizeBytes: number;
}

export default async function CandidateResumePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/resumes/mine`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  let resumes: ResumeRow[] = [];
  if (res.ok) {
    const body = (await res.json()) as { data: ResumeRow[] };
    resumes = body.data;
  }

  return (
    <div className="mx-auto max-w-[1024px] space-y-6">
      <header>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          Resume
        </h1>
        <p className="mt-1 text-sm text-[var(--color-body)]">
          {resumes.length === 0
            ? "Upload a resume so we can match you to roles."
            : `${resumes.length} resume${resumes.length === 1 ? "" : "s"} on file`}
        </p>
      </header>

      {resumes.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          headline="Upload your first resume"
          description="The AI parses your resume to prefill your profile, score your match against open roles, and quote evidence in every match breakdown."
          cta={{ href: "/onboarding/candidate", label: "Upload resume" }}
        />
      ) : (
        <ul className="space-y-3">
          {resumes.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-[var(--color-primary)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    {r.filename}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {(r.sizeBytes / 1024).toFixed(1)} KB · Status: {r.parseStatus}
                    {r.isDefault ? " · Default" : ""}
                  </p>
                </div>
              </div>
              <span className="text-xs text-[var(--color-muted)]">
                {new Date(r.createdAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
