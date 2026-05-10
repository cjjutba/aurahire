"use client";

import { useState } from "react";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { HighlightProvider } from "@/components/onboarding/resume-preview/highlight-context";
import { ResumePreviewPane } from "@/components/onboarding/resume-preview/resume-preview-pane";
import { ResumeSheet } from "@/components/onboarding/mobile/resume-sheet";
import { ReviewStep } from "@/components/onboarding/candidate/review/review-step";
import { LowConfidenceBanner } from "@/components/onboarding/candidate/low-confidence-banner";
import {
  ONBOARDING_STEPS,
  type LatestParsedResume,
} from "@/app/onboarding/candidate/_steps";
import type { SaveStatus } from "@/components/onboarding/save-status-indicator";
import type { HighlightCategory } from "@/components/onboarding/resume-preview/derive-highlights";
import type { ExperienceEntry } from "@/components/onboarding/candidate/review/experience-card";
import type { EducationEntry } from "@/components/onboarding/candidate/review/education-card";

interface Props {
  initialExperience: ExperienceEntry[];
  initialEducation: EducationEntry[];
  initialSkills: string[];
  latestResume: LatestParsedResume | null;
  accessToken: string;
}

export function ReviewStepClient({
  initialExperience,
  initialEducation,
  initialSkills,
  latestResume,
  accessToken: _accessToken,
}: Props) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [activeCategories, setActiveCategories] = useState<HighlightCategory[]>(
    ["experience"],
  );

  // For sprint scope: review-step edits are ephemeral client state.
  // Backend's PATCH /candidate-profiles/me does NOT currently accept
  // experience[] / education[] / skills[] arrays — those live on the parsed
  // resume. Re-uploading the resume is the canonical path to refresh them.
  // We keep the sync interface in place so wiring the endpoint later is a one-line change.
  const syncSection = async (_section: string, _payload: unknown) => {
    setSaveStatus("idle");
    return Promise.resolve();
  };

  const rightPaneContent = (
    <ResumePreviewPane
      signedPdfUrl={latestResume?.signedPdfUrl ?? null}
      parsed={latestResume?.parsed ?? null}
      rawText={latestResume?.rawText ?? null}
      activeCategories={activeCategories}
    />
  );

  return (
    <HighlightProvider>
      <OnboardingShell
        steps={ONBOARDING_STEPS}
        currentStepId="review"
        saveStatus={saveStatus}
        rightPane={rightPaneContent}
        mobileRightPaneToggle={
          <ResumeSheet triggerLabel="View resume">
            {rightPaneContent}
          </ResumeSheet>
        }
        title="Review what we found"
        subtitle="Double-check the AI's extraction. Edit anything that's off, add what's missing."
      >
        <LowConfidenceBanner
          confidence={latestResume?.parsed?.parse_confidence ?? null}
        />
        <ReviewStep
          initialExperience={initialExperience}
          initialEducation={initialEducation}
          initialSkills={initialSkills}
          syncSection={syncSection}
          onCategoriesChange={setActiveCategories}
        />
      </OnboardingShell>
    </HighlightProvider>
  );
}
