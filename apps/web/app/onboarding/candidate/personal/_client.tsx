"use client";

import { useState } from "react";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { HighlightProvider } from "@/components/onboarding/resume-preview/highlight-context";
import { ResumePreviewPane } from "@/components/onboarding/resume-preview/resume-preview-pane";
import { ResumeSheet } from "@/components/onboarding/mobile/resume-sheet";
import {
  CandidatePersonalInfoForm,
  type PersonalFormValues,
} from "@/components/onboarding/candidate/personal-info-form";
import { ONBOARDING_STEPS, type LatestParsedResume } from "@/app/onboarding/candidate/_steps";
import type { SaveStatus } from "@/components/onboarding/save-status-indicator";

interface Props {
  defaults: PersonalFormValues;
  aiSuggestedFields: Partial<Record<keyof PersonalFormValues, boolean>>;
  accessToken: string;
  latestResume: LatestParsedResume | null;
}

export function PersonalStepClient({
  defaults,
  aiSuggestedFields,
  accessToken,
  latestResume,
}: Props) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const rightPaneContent = (
    <ResumePreviewPane
      signedPdfUrl={latestResume?.signedPdfUrl ?? null}
      parsed={latestResume?.parsed ?? null}
      rawText={latestResume?.rawText ?? null}
      activeCategories={["contact", "summary"]}
    />
  );

  return (
    <HighlightProvider>
      <OnboardingShell
        steps={ONBOARDING_STEPS}
        currentStepId="personal"
        saveStatus={saveStatus}
        rightPane={rightPaneContent}
        mobileRightPaneToggle={
          <ResumeSheet triggerLabel="View resume">{rightPaneContent}</ResumeSheet>
        }
        title="Tell us about yourself"
        subtitle="Some fields are prefilled from your resume — review and edit as needed."
      >
        <CandidatePersonalInfoForm
          defaults={defaults}
          aiSuggestedFields={aiSuggestedFields}
          accessToken={accessToken}
          onSaveStatusChange={setSaveStatus}
        />
      </OnboardingShell>
    </HighlightProvider>
  );
}
