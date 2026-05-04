import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import {
  fetchCandidateProfileMe,
  fetchLatestParsedResume,
  ONBOARDING_STEPS,
} from "../_data";

export const metadata = { title: "Education — Onboarding" };

function formatYears(start: number | null, end: number | null): string {
  if (!start && !end) return "";
  if (start && !end) return `${start} – Present`;
  if (!start && end) return `${end}`;
  return `${start} – ${end}`;
}

export default async function Step3Page() {
  const me = await fetchCandidateProfileMe();
  if (me.profileCompleted) redirect("/candidate");

  const latestResume = await fetchLatestParsedResume();
  const education = latestResume?.parsed?.education ?? [];
  const hasParsed = latestResume?.parseStatus === "parsed" && education.length > 0;

  return (
    <WizardShell
      title="Education"
      description={
        hasParsed
          ? "Your education extracted from your resume — review below and continue. You can edit later from your profile."
          : "We didn't find any education in your resume. You can continue and add it later from your profile."
      }
      steps={[...ONBOARDING_STEPS]}
      currentStep={3}
    >
      {hasParsed ? (
        <ul className="space-y-3">
          {education.map((e, i) => (
            <li
              key={i}
              className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-[var(--color-ink)]">{e.institution}</h3>
                  <p className="text-sm text-[var(--color-body)]">
                    {e.degree ?? "—"}
                    {e.field_of_study ? `, ${e.field_of_study}` : ""}
                  </p>
                  {e.gpa && (
                    <p className="mt-1 text-xs text-[var(--color-muted)]">GPA: {e.gpa}</p>
                  )}
                </div>
                <span className="font-mono text-xs text-[var(--color-muted)]">
                  {formatYears(e.start_year, e.end_year)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-8 text-center">
          <GraduationCap className="mx-auto h-8 w-8 text-[var(--color-muted)]" />
          <p className="mt-3 text-sm text-[var(--color-body)]">
            No education entries found in your resume.
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            That&apos;s okay — you can add your education manually from your profile after onboarding.
          </p>
        </div>
      )}

      <div className="mt-6 flex justify-between">
        <Link
          href="/onboarding/candidate/personal"
          className="inline-flex items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-6 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-strong)]"
        >
          Back
        </Link>
        <Link
          href="/onboarding/candidate/experience"
          className="inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 py-2 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
        >
          Continue
        </Link>
      </div>
    </WizardShell>
  );
}
