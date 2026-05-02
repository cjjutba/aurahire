import { z } from "zod";

// ============================================================================
// PARSED RESUME — output of resume parsing AI call
// ============================================================================

export const educationEntrySchema = z.object({
  institution: z.string(),
  degree: z.string().nullable(),
  field_of_study: z.string().nullable(),
  start_year: z.number().int().nullable(),
  end_year: z.number().int().nullable(),
  gpa: z.string().nullable(),
});

export const experienceEntrySchema = z.object({
  company: z.string(),
  title: z.string(),
  start_date: z.string().nullable(), // ISO YYYY-MM
  end_date: z.string().nullable(), // ISO YYYY-MM, or null for "Present"
  is_current: z.boolean(),
  responsibilities: z.array(z.string()),
  technologies_used: z.array(z.string()),
});

export const certificationSchema = z.object({
  name: z.string(),
  issuing_organization: z.string().nullable(),
  issue_date: z.string().nullable(),
  expires: z.string().nullable(),
});

export const parsedResumeContactSchema = z.object({
  full_name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location_city: z.string().nullable(),
  location_country: z.string().nullable(),
  linkedin_url: z.string().nullable(),
  portfolio_url: z.string().nullable(),
});

export const parsedResumeSchema = z.object({
  contact: parsedResumeContactSchema,
  summary: z.string().nullable(),
  education: z.array(educationEntrySchema),
  experience: z.array(experienceEntrySchema),
  skills: z.array(z.string()),
  certifications: z.array(certificationSchema),
  languages: z.array(z.string()),
  parse_confidence: z.enum(["high", "medium", "low"]),
});

export type ParsedResume = z.infer<typeof parsedResumeSchema>;
export type ParsedResumeContact = z.infer<typeof parsedResumeContactSchema>;
export type EducationEntry = z.infer<typeof educationEntrySchema>;
export type ExperienceEntry = z.infer<typeof experienceEntrySchema>;
export type Certification = z.infer<typeof certificationSchema>;
