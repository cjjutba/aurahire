import { z } from "zod";

// ============================================================================
// PARSED RESUME v2 — output of resume parsing AI call
// Adds *_source verbatim strings for every extracted value, enabling client-side
// highlight positioning over the rendered PDF.
// ============================================================================

export const parsedResumeContactSchema = z.object({
  full_name: z.string().nullable(),
  full_name_source: z.string().nullable(),
  email: z.string().nullable(),
  email_source: z.string().nullable(),
  phone: z.string().nullable(),
  phone_source: z.string().nullable(),
  location_city: z.string().nullable(),
  location_city_source: z.string().nullable(),
  location_country: z.string().nullable(),
  location_country_source: z.string().nullable(),
  linkedin_url: z.string().nullable(),
  linkedin_url_source: z.string().nullable(),
  portfolio_url: z.string().nullable(),
  portfolio_url_source: z.string().nullable(),
});

export const parsedResumeSummarySchema = z.object({
  text: z.string(),
  text_source: z.string(),
});

export const educationEntrySchema = z.object({
  institution: z.string(),
  institution_source: z.string(),
  degree: z.string().nullable(),
  degree_source: z.string().nullable(),
  field_of_study: z.string().nullable(),
  field_of_study_source: z.string().nullable(),
  start_year: z.number().int().nullable(),
  end_year: z.number().int().nullable(),
  period_source: z.string().nullable(),
  gpa: z.string().nullable(),
  gpa_source: z.string().nullable(),
});

export const experienceEntrySchema = z.object({
  company: z.string(),
  company_source: z.string(),
  title: z.string(),
  title_source: z.string(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  period_source: z.string(),
  is_current: z.boolean(),
  responsibilities: z.array(z.string()),
  responsibilities_source: z.array(z.string()),
  technologies_used: z.array(z.string()),
});

export const skillEntrySchema = z.object({
  name: z.string(),
  source: z.string(),
});

export const certificationSchema = z.object({
  name: z.string(),
  name_source: z.string(),
  issuing_organization: z.string().nullable(),
  issuing_organization_source: z.string().nullable(),
  issue_date: z.string().nullable(),
  issue_date_source: z.string().nullable(),
  expires: z.string().nullable(),
});

export const parsedResumeSchema = z.object({
  contact: parsedResumeContactSchema,
  summary: parsedResumeSummarySchema.nullable(),
  education: z.array(educationEntrySchema),
  experience: z.array(experienceEntrySchema),
  skills: z.array(skillEntrySchema),
  certifications: z.array(certificationSchema),
  languages: z.array(z.string()),
  parse_confidence: z.enum(["high", "medium", "low"]),
});

export type ParsedResume = z.infer<typeof parsedResumeSchema>;
export type ParsedResumeContact = z.infer<typeof parsedResumeContactSchema>;
export type ParsedResumeSummary = z.infer<typeof parsedResumeSummarySchema>;
export type EducationEntry = z.infer<typeof educationEntrySchema>;
export type ExperienceEntry = z.infer<typeof experienceEntrySchema>;
export type SkillEntry = z.infer<typeof skillEntrySchema>;
export type Certification = z.infer<typeof certificationSchema>;
