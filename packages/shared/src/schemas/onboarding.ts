import { z } from "zod";
import { fullNameSchema, phoneSchema, companyNameSchema } from "./shared";

// ============================================================================
// CANDIDATE ONBOARDING (skeleton; populated in Slice 1.8 + Slice 2.4)
// ============================================================================

export const candidatePersonalInfoSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  locationCity: z.string().nullable().optional(),
  locationRegion: z.string().nullable().optional(),
  locationCountry: z.string().nullable().optional(),
  headline: z.string().max(200).nullable().optional(),
  summary: z.string().max(2000).nullable().optional(),
});

export type CandidatePersonalInfo = z.infer<typeof candidatePersonalInfoSchema>;

export const candidatePreferencesSchema = z.object({
  desiredRoles: z.array(z.string().min(1)).default([]),
  desiredSeniority: z.string().nullable().optional(),
  openTo: z.array(z.string()).default([]),
  desiredSalaryMin: z.number().nonnegative().nullable().optional(),
  desiredSalaryMax: z.number().nonnegative().nullable().optional(),
  desiredCurrency: z.string().length(3).default("USD"),
  availableStartDate: z.string().date().nullable().optional(),
});

export type CandidatePreferences = z.infer<typeof candidatePreferencesSchema>;

// ============================================================================
// RECRUITER ONBOARDING (skeleton; populated in Slice 1.7)
// ============================================================================

export const recruiterAboutSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  jobTitle: z.string().max(150).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
});

export type RecruiterAbout = z.infer<typeof recruiterAboutSchema>;

export const recruiterCompanySchema = z.object({
  companyName: companyNameSchema,
  industry: z.string().max(100).nullable().optional(),
  size: z
    .enum(["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"])
    .nullable()
    .optional(),
  website: z.string().url().nullable().optional(),
  headquartersLocation: z.string().nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
});

export type RecruiterCompany = z.infer<typeof recruiterCompanySchema>;

export const recruiterFocusSchema = z.object({
  rolesHiringFor: z.array(z.string()).default([]),
  hiringVolumePerQuarter: z
    .enum(["1-5", "6-10", "11-25", "25+"])
    .nullable()
    .optional(),
});

export type RecruiterFocus = z.infer<typeof recruiterFocusSchema>;

// ============================================================================
// CANDIDATE ONBOARDING — analyzing-screen skip telemetry (Skip-to-Dashboard)
// ============================================================================

/**
 * Body of `POST /candidate-profiles/me/onboarding/skipped-analyzing`.
 *
 * Fired by the analyzing screen when the candidate clicks the manual
 * "Skip to dashboard" link. Pure telemetry: lets us measure how often the
 * skip is exercised and at what stage of preview-streaming it happens. The
 * endpoint records an audit row and returns 204; it has no scoring side
 * effects.
 */
export const onboardingSkippedAnalyzingSchema = z.object({
  /** True if the Profile Score had landed (state was past `computingProfileScore`)
   * by the time the candidate clicked Skip. False only on the degraded path. */
  scoreReady: z.boolean(),
  /** How many `match-preview.created` events had ticked into the reducer
   * by the time of the skip. Capped at 5 because the precompute target is 5. */
  previewsReady: z.number().int().min(0).max(5),
});

export type OnboardingSkippedAnalyzing = z.infer<
  typeof onboardingSkippedAnalyzingSchema
>;
