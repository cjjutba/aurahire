"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExperienceList } from "./experience-list";
import { EducationList } from "./education-list";
import { SkillsCloud } from "./skills-cloud";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import type { HighlightCategory } from "@/components/onboarding/resume-preview/derive-highlights";
import type { ExperienceEntry } from "./experience-card";
import type { EducationEntry } from "./education-card";

interface Props {
  initialExperience: ExperienceEntry[];
  initialEducation: EducationEntry[];
  initialSkills: string[];
  syncSection: (
    section: "experience" | "education" | "skills",
    payload: ExperienceEntry[] | EducationEntry[] | string[],
  ) => Promise<void>;
  onCategoriesChange: (cats: HighlightCategory[]) => void;
}

export function ReviewStep({
  initialExperience,
  initialEducation,
  initialSkills,
  syncSection,
  onCategoriesChange,
}: Props) {
  const router = useRouter();
  const expRef = useRef<HTMLDivElement>(null);
  const eduRef = useRef<HTMLDivElement>(null);
  const skillRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<HighlightCategory>("experience");
  const [isContinuing, startContinue] = useTransition();
  const [isGoingBack, startBack] = useTransition();

  useEffect(() => {
    onCategoriesChange([active]);
  }, [active, onCategoriesChange]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const cat = (entry.target as HTMLElement).dataset.category as HighlightCategory;
            if (cat) setActive(cat);
          }
        }
      },
      { threshold: 0.5 },
    );
    [expRef.current, eduRef.current, skillRef.current].forEach(
      (el) => el && observer.observe(el),
    );
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-10">
      <section ref={expRef} data-category="experience">
        <ExperienceList
          initial={initialExperience}
          onSync={(v) => syncSection("experience", v)}
        />
      </section>

      <section ref={eduRef} data-category="education">
        <EducationList
          initial={initialEducation}
          onSync={(v) => syncSection("education", v)}
        />
      </section>

      <section ref={skillRef} data-category="skill">
        <SkillsCloud initial={initialSkills} onSync={(v) => syncSection("skills", v)} />
      </section>

      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={() => startBack(() => router.push("/onboarding/candidate/personal"))}
          disabled={isContinuing || isGoingBack}
          className="rounded-full bg-[var(--color-surface-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--color-ink)] disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => startContinue(() => router.push("/onboarding/candidate/preferences"))}
          disabled={isContinuing || isGoingBack}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)] disabled:cursor-not-allowed disabled:bg-[var(--color-primary-disabled)]"
        >
          {isContinuing && <ButtonSpinner />}
          {isContinuing ? "Continuing..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
