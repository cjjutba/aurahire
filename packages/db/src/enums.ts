// AuraHire canonical enums — used in Drizzle schema definitions.
// These are TypeScript const tuples (not pgEnum types) — Drizzle's text({ enum: ... }) accepts them.
// Mirroring `lib/constants/enums.ts` from `docs/main/database-schema.md`.

export const USER_ROLES = ["candidate", "recruiter", "admin"] as const;
export const USER_STATUS = ["active", "suspended", "deleted"] as const;

export const APPLICATION_STATUS = [
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
] as const;

export const OFFER_STATUS = ["pending", "accepted", "declined", "expired", "withdrawn"] as const;
export const INTERVIEW_FORMAT = ["phone", "video", "in-person"] as const;
export const INTERVIEW_STATUS = ["scheduled", "completed", "cancelled", "no-show"] as const;

export const JOB_STATUS = ["draft", "published", "archived", "closed"] as const;
export const EMPLOYMENT_TYPE = ["full-time", "part-time", "contract"] as const;
export const WORK_MODE = ["remote", "hybrid", "on-site"] as const;
export const EXPERIENCE_LEVEL = [
  "entry",
  "junior",
  "mid",
  "senior",
  "lead",
  "principal",
  "manager",
  "director",
  "vp+",
] as const;
export const EDUCATION_REQUIREMENT = [
  "none",
  "high-school",
  "associate",
  "bachelor",
  "master",
  "phd",
  "other",
] as const;

export const COMPANY_SIZE = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1000+",
] as const;

export const SCORE_BAND = ["strong", "partial", "limited"] as const;
export const SCORE_STATUS = ["pending", "completed", "failed"] as const;

export const RESUME_PARSE_STATUS = ["pending", "parsing", "parsed", "failed"] as const;

export const BIAS_CATEGORY = ["gendered", "age-coded", "ableist", "exclusionary", "other"] as const;
export const BIAS_FLAG_STATUS = ["flagged", "overridden", "resolved"] as const;
export const BIAS_SEVERITY = ["high", "medium", "low"] as const;

export const AUDIT_ACTOR_TYPE = ["user", "system", "ai"] as const;
export const PARSE_CONFIDENCE = ["high", "medium", "low"] as const;
export const EVIDENCE_RELEVANCE = ["positive", "negative", "neutral"] as const;

export const SCORE_TYPE = ["profile", "match"] as const;
export const SCORE_COMPONENT_PROFILE = [
  "completeness",
  "skill_depth",
  "experience_clarity",
  "education_quality",
] as const;
export const SCORE_COMPONENT_MATCH = ["skills", "experience", "education", "cultural_fit"] as const;

export const COMPANY_MEMBER_ROLE = ["owner", "admin", "recruiter"] as const;
export const COMPANY_MEMBER_STATUS = ["invited", "active", "suspended", "left"] as const;

// TypeScript types derived from the const tuples
export type UserRole = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUS)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUS)[number];
export type OfferStatus = (typeof OFFER_STATUS)[number];
export type InterviewFormat = (typeof INTERVIEW_FORMAT)[number];
export type InterviewStatus = (typeof INTERVIEW_STATUS)[number];
export type JobStatus = (typeof JOB_STATUS)[number];
export type EmploymentType = (typeof EMPLOYMENT_TYPE)[number];
export type WorkMode = (typeof WORK_MODE)[number];
export type ExperienceLevel = (typeof EXPERIENCE_LEVEL)[number];
export type EducationRequirement = (typeof EDUCATION_REQUIREMENT)[number];
export type CompanySize = (typeof COMPANY_SIZE)[number];
export type ScoreBand = (typeof SCORE_BAND)[number];
export type ScoreStatus = (typeof SCORE_STATUS)[number];
export type ResumeParseStatus = (typeof RESUME_PARSE_STATUS)[number];
export type BiasCategory = (typeof BIAS_CATEGORY)[number];
export type BiasFlagStatus = (typeof BIAS_FLAG_STATUS)[number];
export type BiasSeverity = (typeof BIAS_SEVERITY)[number];
export type AuditActorType = (typeof AUDIT_ACTOR_TYPE)[number];
export type ParseConfidence = (typeof PARSE_CONFIDENCE)[number];
export type EvidenceRelevance = (typeof EVIDENCE_RELEVANCE)[number];
export type ScoreType = (typeof SCORE_TYPE)[number];
export type CompanyMemberRole = (typeof COMPANY_MEMBER_ROLE)[number];
export type CompanyMemberStatus = (typeof COMPANY_MEMBER_STATUS)[number];
