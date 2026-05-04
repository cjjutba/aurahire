import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import {
  fetchCandidateProfileMe,
  fetchLatestParsedResume,
  ONBOARDING_STEPS,
} from "../_data";

export const metadata = { title: "Skills — Onboarding" };

export default async function Step5Page() {
  const me = await fetchCandidateProfileMe();
  if (me.profileCompleted) redirect("/candidate");

  const latestResume = await fetchLatestParsedResume();
  const skills = latestResume?.parsed?.skills ?? [];
  const certifications = latestResume?.parsed?.certifications ?? [];
  const hasParsedSkills = latestResume?.parseStatus === "parsed" && skills.length > 0;
  const hasCertifications = certifications.length > 0;

  return (
    <WizardShell
      title="Skills"
      description={
        hasParsedSkills
          ? "Your skills extracted from your resume — these get used for match scoring. You can refine later from your profile."
          : "We didn't find skills in your resume. You can continue and add them later from your profile."
      }
      steps={[...ONBOARDING_STEPS]}
      currentStep={5}
    >
      {hasParsedSkills ? (
        <div className="space-y-4">
          <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
            <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink)]">
              Skills <span className="ml-2 font-mono text-xs text-[var(--color-muted)]">{skills.length}</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill, i) => (
                <span
                  key={i}
                  className="rounded-[var(--radius-pill)] bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-medium text-[var(--color-primary)]"
                >
                  {skill}
                </span>
              ))}
            </div>
          </section>

          {hasCertifications && (
            <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
              <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink)]">Certifications</h3>
              <ul className="space-y-2">
                {certifications.map((cert, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium text-[var(--color-ink)]">{cert.name}</span>
                    {cert.issuing_organization && (
                      <span className="text-[var(--color-muted)]"> · {cert.issuing_organization}</span>
                    )}
                    {cert.issue_date && (
                      <span className="ml-2 font-mono text-xs text-[var(--color-muted)]">
                        {cert.issue_date}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-[var(--color-muted)]" />
          <p className="mt-3 text-sm text-[var(--color-body)]">
            No skills found in your resume.
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            That&apos;s okay — you can add your skills manually from your profile after onboarding.
          </p>
        </div>
      )}

      <div className="mt-6 flex justify-between">
        <Link
          href="/onboarding/candidate/experience"
          className="inline-flex items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-6 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-strong)]"
        >
          Back
        </Link>
        <Link
          href="/onboarding/candidate/preferences"
          className="inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 py-2 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
        >
          Continue
        </Link>
      </div>
    </WizardShell>
  );
}
