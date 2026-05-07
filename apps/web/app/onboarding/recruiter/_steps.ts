// Client-safe step definitions for recruiter onboarding.
export const RECRUITER_ONBOARDING_STEPS = [
  { id: "company", label: "Company", path: "/onboarding/recruiter/company-create" },
  { id: "about", label: "About", path: "/onboarding/recruiter" },
  { id: "focus", label: "Focus", path: "/onboarding/recruiter/focus" },
] as const;

export type RecruiterOnboardingStepId = (typeof RECRUITER_ONBOARDING_STEPS)[number]["id"];
