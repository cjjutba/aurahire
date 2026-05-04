import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase } from "lucide-react";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import {
  fetchCandidateProfileMe,
  fetchLatestParsedResume,
  ONBOARDING_STEPS,
} from "../_data";

export const metadata = { title: "Experience — Onboarding" };

function formatDateRange(start: string | null | undefined, end: string | null | undefined, isCurrent?: boolean | null): string {
  const startStr = start ?? "";
  const endStr = isCurrent ? "Present" : (end ?? "");
  if (!startStr && !endStr) return "";
  return `${startStr} – ${endStr}`;
}

export default async function Step4Page() {
  const me = await fetchCandidateProfileMe();
  if (me.profileCompleted) redirect("/candidate");

  const latestResume = await fetchLatestParsedResume();
  const experience = latestResume?.parsed?.experience ?? [];
  const hasParsed = latestResume?.parseStatus === "parsed" && experience.length > 0;

  return (
    <WizardShell
      title="Work Experience"
      description={
        hasParsed
          ? "Your work history extracted from your resume — review below and continue. You can edit later from your profile."
          : "We didn't find any work experience in your resume. You can continue and add it later from your profile."
      }
      steps={[...ONBOARDING_STEPS]}
      currentStep={4}
    >
      {hasParsed ? (
        <ul className="space-y-3">
          {experience.map((e, i) => (
            <li
              key={i}
              className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-[var(--color-ink)]">
                    {e.title ?? "—"}
                  </h3>
                  <p className="text-sm text-[var(--color-body)]">{e.company ?? "—"}</p>
                  {e.responsibilities && e.responsibilities.length > 0 && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-[var(--color-muted)]">
                      {e.responsibilities.slice(0, 3).map((r, ri) => (
                        <li key={ri}>{r}</li>
                      ))}
                    </ul>
                  )}
                  {e.technologies_used && e.technologies_used.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {e.technologies_used.slice(0, 8).map((t, ti) => (
                        <span
                          key={ti}
                          className="rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="font-mono text-xs text-[var(--color-muted)]">
                  {formatDateRange(e.start_date, e.end_date, e.is_current)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-8 text-center">
          <Briefcase className="mx-auto h-8 w-8 text-[var(--color-muted)]" />
          <p className="mt-3 text-sm text-[var(--color-body)]">
            No work experience entries found in your resume.
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            That&apos;s okay — you can add your work history manually from your profile after onboarding.
          </p>
        </div>
      )}

      <div className="mt-6 flex justify-between">
        <Link
          href="/onboarding/candidate/education"
          className="inline-flex items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-6 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-strong)]"
        >
          Back
        </Link>
        <Link
          href="/onboarding/candidate/skills"
          className="inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 py-2 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
        >
          Continue
        </Link>
      </div>
    </WizardShell>
  );
}
