// Client-safe step definitions and types — imported by Client Components.
// Do NOT import server-only modules (e.g. next/headers) here.

export const ONBOARDING_STEPS = [
  { id: "resume", label: "Resume", path: "/onboarding/candidate" },
  { id: "personal", label: "Personal", path: "/onboarding/candidate/personal" },
  { id: "review", label: "Review", path: "/onboarding/candidate/review" },
  { id: "preferences", label: "Preferences", path: "/onboarding/candidate/preferences" },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

export interface CandidateProfileMe {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  headline: string | null;
  summary: string | null;
  locationCity: string | null;
  locationRegion: string | null;
  locationCountry: string | null;
  desiredRoles: string[];
  desiredSeniority: string | null;
  openTo: string[];
  desiredSalaryMin: number | null;
  desiredSalaryMax: number | null;
  desiredCurrency: string;
  availableStartDate: string | null;
  profileCompleted: boolean;
}

export interface ParsedResumeV2 {
  contact: {
    full_name: string | null;        full_name_source: string | null;
    email: string | null;            email_source: string | null;
    phone: string | null;            phone_source: string | null;
    location_city: string | null;    location_city_source: string | null;
    location_country: string | null; location_country_source: string | null;
    linkedin_url: string | null;     linkedin_url_source: string | null;
    portfolio_url: string | null;    portfolio_url_source: string | null;
  };
  summary: { text: string; text_source: string } | null;
  education: Array<{
    institution: string;       institution_source: string;
    degree: string | null;     degree_source: string | null;
    field_of_study: string | null; field_of_study_source: string | null;
    start_year: number | null;
    end_year: number | null;
    period_source: string | null;
    gpa: string | null;        gpa_source: string | null;
  }>;
  experience: Array<{
    company: string;           company_source: string;
    title: string;             title_source: string;
    start_date: string | null;
    end_date: string | null;
    period_source: string;
    is_current: boolean;
    responsibilities: string[];
    responsibilities_source: string[];
    technologies_used: string[];
  }>;
  skills: Array<{ name: string; source: string }>;
  certifications: Array<{
    name: string;                          name_source: string;
    issuing_organization: string | null;   issuing_organization_source: string | null;
    issue_date: string | null;             issue_date_source: string | null;
    expires: string | null;
  }>;
  languages: string[];
  parse_confidence: "high" | "medium" | "low";
}

export interface LatestParsedResume {
  id: string;
  parseStatus: "pending" | "parsing" | "parsed" | "failed";
  signedPdfUrl: string | null;
  rawText: string | null;
  canonicalPdfPath: string | null;
  parsed: ParsedResumeV2 | null;
}
