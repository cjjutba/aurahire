"use client";

import { useState } from "react";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { HighlightProvider } from "@/components/onboarding/resume-preview/highlight-context";
import { ProfilePreviewPane } from "@/components/onboarding/candidate/profile-preview-pane";
import { ResumeSheet } from "@/components/onboarding/mobile/resume-sheet";
import {
  CandidatePreferencesForm,
  type PreferencesFormValues,
} from "@/components/onboarding/candidate/preferences-form";
import {
  ONBOARDING_STEPS,
  type CandidateProfileMe,
} from "@/app/onboarding/candidate/_steps";
import type { SaveStatus } from "@/components/onboarding/save-status-indicator";

interface ExperienceLike {
  title: string;
  company: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
}

interface Props {
  defaults: PreferencesFormValues;
  accessToken: string;
  me: CandidateProfileMe;
  experience: ExperienceLike[];
  skills: string[];
}

export function PreferencesStepClient({
  defaults,
  accessToken,
  me,
  experience,
  skills,
}: Props) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const rightPaneContent = (
    <ProfilePreviewPane me={me} experience={experience} skills={skills} />
  );

  return (
    <HighlightProvider>
      <OnboardingShell
        steps={ONBOARDING_STEPS}
        currentStepId="preferences"
        saveStatus={saveStatus}
        rightPane={rightPaneContent}
        mobileRightPaneToggle={
          <ResumeSheet triggerLabel="View preview">
            {rightPaneContent}
          </ResumeSheet>
        }
        title="Job preferences"
        subtitle="What kind of role are you looking for?"
      >
        <CandidatePreferencesForm
          defaults={defaults}
          accessToken={accessToken}
          onSaveStatusChange={setSaveStatus}
        />
      </OnboardingShell>
    </HighlightProvider>
  );
}
