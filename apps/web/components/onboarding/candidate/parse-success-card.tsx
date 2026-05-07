// apps/web/components/onboarding/candidate/parse-success-card.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ParsedResumeV2 } from "@/app/onboarding/candidate/_steps";
import { ButtonSpinner } from "@/components/ui/button-spinner";

interface Props {
  parsed: ParsedResumeV2 | null;
}

export function ParseSuccessCard({ parsed }: Props) {
  const router = useRouter();
  const [isContinuing, startContinue] = useTransition();

  const expCount = parsed?.experience.length ?? 0;
  const eduCount = parsed?.education.length ?? 0;
  const skillCount = parsed?.skills.length ?? 0;
  const certCount = parsed?.certifications.length ?? 0;

  const chips: Array<[string, boolean]> = [
    [`${expCount} ${expCount === 1 ? "experience" : "experiences"}`, expCount > 0],
    [`${eduCount} ${eduCount === 1 ? "school" : "schools"}`, eduCount > 0],
    [`${skillCount} ${skillCount === 1 ? "skill" : "skills"}`, skillCount > 0],
    [`${certCount} ${certCount === 1 ? "cert" : "certs"}`, certCount > 0],
  ];

  return (
    <div>
      <h2 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
        We&apos;ve read your resume
      </h2>
      <p className="mt-2 text-sm text-[var(--color-body)]">
        Highlighted sections show what we extracted. Review them on the next step.
      </p>
      <ul className="mt-5 flex flex-wrap gap-2">
        {chips.map(([label, on], i) => (
          <li
            key={i}
            className={[
              "rounded-full px-3 py-1 text-xs",
              on
                ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                : "bg-[var(--color-surface-strong)] text-[var(--color-muted)]",
            ].join(" ")}
          >
            {label}
          </li>
        ))}
      </ul>
      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={() => startContinue(() => router.push("/onboarding/candidate/personal"))}
          disabled={isContinuing}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)] disabled:cursor-not-allowed disabled:bg-[var(--color-primary-disabled)]"
        >
          {isContinuing && <ButtonSpinner />}
          {isContinuing ? "Continuing..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
