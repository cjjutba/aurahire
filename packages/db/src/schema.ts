import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  numeric,
  date,
  unique,
  index,
  check,
  inet,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  USER_ROLES,
  USER_STATUS,
  APPLICATION_STATUS,
  OFFER_STATUS,
  INTERVIEW_FORMAT,
  INTERVIEW_STATUS,
  JOB_STATUS,
  EMPLOYMENT_TYPE,
  WORK_MODE,
  EXPERIENCE_LEVEL,
  EDUCATION_REQUIREMENT,
  COMPANY_SIZE,
  SCORE_BAND,
  SCORE_STATUS,
  RESUME_PARSE_STATUS,
  BIAS_CATEGORY,
  BIAS_FLAG_STATUS,
  BIAS_SEVERITY,
  AUDIT_ACTOR_TYPE,
  SCORE_TYPE,
  COMPANY_MEMBER_ROLE,
  COMPANY_MEMBER_STATUS,
} from "./enums";

// ============================================================================
// IDENTITY
// ============================================================================

export const profilesTable = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(), // mirrors auth.users.id; FK enforced via Supabase trigger
    role: text("role", { enum: USER_ROLES }).notNull(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull().unique(),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    status: text("status", { enum: USER_STATUS }).notNull().default("active"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    // Per-user active-company pointer. The FK constraint is declared in the
    // 0003_multi_tenancy.sql migration (NOT inline here) to break a circular
    // type-inference loop with companiesTable.createdBy → profilesTable.id.
    // The relation is wired in relations.ts so query joins still work.
    lastActiveCompanyId: uuid("last_active_company_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: index("profiles_email_idx").on(t.email),
    roleIdx: index("profiles_role_idx").on(t.role),
    statusIdx: index("profiles_status_idx").on(t.status),
    lastActiveCompanyIdx: index("profiles_last_active_company_idx").on(t.lastActiveCompanyId),
  }),
);

export const candidateProfilesTable = pgTable(
  "candidate_profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    headline: text("headline"),
    summary: text("summary"),
    locationCity: text("location_city"),
    locationRegion: text("location_region"),
    locationCountry: text("location_country"),
    desiredRoles: text("desired_roles").array().notNull().default(sql`'{}'::text[]`),
    desiredSeniority: text("desired_seniority"),
    openTo: text("open_to").array().notNull().default(sql`'{}'::text[]`),
    desiredSalaryMin: numeric("desired_salary_min", { precision: 12, scale: 2 }),
    desiredSalaryMax: numeric("desired_salary_max", { precision: 12, scale: 2 }),
    desiredCurrency: text("desired_currency").default("USD"),
    availableStartDate: date("available_start_date"),
    defaultResumeId: uuid("default_resume_id"), // FK added below to avoid circular reference
    profileCompleted: boolean("profile_completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    completedIdx: index("candidate_profiles_completed_idx").on(t.profileCompleted),
  }),
);

export const companiesTable = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    industry: text("industry"),
    size: text("size", { enum: COMPANY_SIZE }),
    website: text("website"),
    logoUrl: text("logo_url"),
    headquartersLocation: text("headquarters_location"),
    description: text("description"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profilesTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    createdByIdx: index("companies_created_by_idx").on(t.createdBy),
    nameIdx: index("companies_name_idx").on(t.name),
  }),
);

export const recruiterProfilesTable = pgTable("recruiter_profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => profilesTable.id, { onDelete: "cascade" }),
  jobTitle: text("job_title"),
  department: text("department"),
  rolesHiringFor: text("roles_hiring_for").array().notNull().default(sql`'{}'::text[]`),
  hiringVolumePerQuarter: text("hiring_volume_per_quarter"),
  profileCompleted: boolean("profile_completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per (user, company) membership. Replaces the old 1:1 link from
// `recruiter_profiles.company_id`. user_id is NULLABLE so a row can represent
// a pending invitation (no user account yet) — `email` is snapshotted at
// invite time so the row survives `profiles` deletion.
export const companyMembersTable = pgTable(
  "company_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => profilesTable.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role", { enum: COMPANY_MEMBER_ROLE }).notNull(),
    status: text("status", { enum: COMPANY_MEMBER_STATUS }).notNull(),
    invitationToken: text("invitation_token").unique(),
    invitationExpiresAt: timestamp("invitation_expires_at", { withTimezone: true }),
    invitedBy: uuid("invited_by").references(() => profilesTable.id, { onDelete: "set null" }),
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyUserUnique: unique("company_members_company_user_unique").on(t.companyId, t.userId),
    companyEmailUnique: unique("company_members_company_email_unique").on(t.companyId, t.email),
    userStatusIdx: index("company_members_user_status_idx").on(t.userId, t.status),
    companyStatusIdx: index("company_members_company_status_idx").on(t.companyId, t.status),
    // No separate index on invitationToken — the .unique() above is backed by
    // an automatic btree index sufficient for token lookups.
  }),
);

// ============================================================================
// RECRUITMENT
// ============================================================================

export const jobsTable = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recruiterId: uuid("recruiter_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    department: text("department"),
    employmentType: text("employment_type", { enum: EMPLOYMENT_TYPE }).notNull(),
    workMode: text("work_mode", { enum: WORK_MODE }).notNull(),
    locationCity: text("location_city"),
    locationRegion: text("location_region"),
    locationCountry: text("location_country"),
    salaryMin: numeric("salary_min", { precision: 12, scale: 2 }),
    salaryMax: numeric("salary_max", { precision: 12, scale: 2 }),
    salaryCurrency: text("salary_currency").default("USD"),
    description: text("description").notNull(),
    descriptionPlain: text("description_plain").notNull(),
    requiredSkills: text("required_skills").array().notNull().default(sql`'{}'::text[]`),
    experienceLevel: text("experience_level", { enum: EXPERIENCE_LEVEL }).notNull(),
    educationRequirement: text("education_requirement", { enum: EDUCATION_REQUIREMENT }),
    applicationDeadline: date("application_deadline"),
    status: text("status", { enum: JOB_STATUS }).notNull().default("draft"),
    viewCount: integer("view_count").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    recruiterIdx: index("jobs_recruiter_idx").on(t.recruiterId),
    companyIdx: index("jobs_company_idx").on(t.companyId),
    statusIdx: index("jobs_status_idx").on(t.status),
    publishedIdx: index("jobs_published_idx").on(t.publishedAt),
  }),
);

export const resumesTable = pgTable(
  "resumes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storagePath: text("storage_path").notNull(),
    rawText: text("raw_text"),
    parsedData: jsonb("parsed_data"),
    parseStatus: text("parse_status", { enum: RESUME_PARSE_STATUS }).notNull().default("pending"),
    parseError: text("parse_error"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    candidateIdx: index("resumes_candidate_idx").on(t.candidateId),
    defaultIdx: index("resumes_default_idx").on(t.candidateId, t.isDefault),
  }),
);

export const applicationsTable = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobsTable.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    resumeId: uuid("resume_id")
      .notNull()
      .references(() => resumesTable.id, { onDelete: "restrict" }),
    coverLetter: text("cover_letter"),
    status: text("status", { enum: APPLICATION_STATUS }).notNull().default("applied"),
    recruiterNotes: text("recruiter_notes"),
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
    statusUpdatedAt: timestamp("status_updated_at", { withTimezone: true }).notNull().defaultNow(),
    shortlistedAt: timestamp("shortlisted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueCandidateJob: unique("applications_unique_candidate_job").on(t.candidateId, t.jobId),
    jobIdx: index("applications_job_idx").on(t.jobId),
    candidateIdx: index("applications_candidate_idx").on(t.candidateId),
    statusIdx: index("applications_status_idx").on(t.status),
    appliedIdx: index("applications_applied_idx").on(t.appliedAt),
    shortlistedIdx: index("applications_shortlisted_idx").on(t.shortlistedAt),
  }),
);

export const interviewsTable = pgTable(
  "interviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applicationsTable.id, { onDelete: "cascade" }),
    scheduledBy: uuid("scheduled_by")
      .notNull()
      .references(() => profilesTable.id),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    format: text("format", { enum: INTERVIEW_FORMAT }).notNull(),
    locationOrLink: text("location_or_link"),
    status: text("status", { enum: INTERVIEW_STATUS }).notNull().default("scheduled"),
    feedback: text("feedback"),
    rating: integer("rating"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    applicationIdx: index("interviews_application_idx").on(t.applicationId),
    scheduledAtIdx: index("interviews_scheduled_at_idx").on(t.scheduledAt),
    ratingCheck: check("interviews_rating_range", sql`${t.rating} IS NULL OR (${t.rating} >= 1 AND ${t.rating} <= 5)`),
  }),
);

export const offersTable = pgTable(
  "offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .unique()
      .references(() => applicationsTable.id, { onDelete: "cascade" }),
    sentBy: uuid("sent_by")
      .notNull()
      .references(() => profilesTable.id),
    title: text("title").notNull(),
    salary: numeric("salary", { precision: 12, scale: 2 }).notNull(),
    salaryCurrency: text("salary_currency").notNull().default("USD"),
    startDate: date("start_date").notNull(),
    managerName: text("manager_name"),
    benefitsSummary: text("benefits_summary"),
    customMessage: text("custom_message"),
    status: text("status", { enum: OFFER_STATUS }).notNull().default("pending"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("offers_status_idx").on(t.status),
  }),
);

// ============================================================================
// AI / SCORING
// ============================================================================

export const profileScoresTable = pgTable(
  "profile_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    resumeId: uuid("resume_id")
      .notNull()
      .references(() => resumesTable.id),
    overallScore: integer("overall_score").notNull(),
    band: text("band", { enum: SCORE_BAND }).notNull(),
    components: jsonb("components").notNull(),
    improvementSuggestions: jsonb("improvement_suggestions").notNull().default(sql`'[]'::jsonb`),
    redactedFields: text("redacted_fields").array().notNull().default(sql`'{}'::text[]`),
    promptVersion: text("prompt_version").notNull(),
    modelUsed: text("model_used").notNull(),
    rawOutput: jsonb("raw_output").notNull(),
    latencyMs: integer("latency_ms"),
    status: text("status", { enum: SCORE_STATUS }).notNull().default("completed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    candidateIdx: index("profile_scores_candidate_idx").on(t.candidateId, t.createdAt),
    resumeIdx: index("profile_scores_resume_idx").on(t.resumeId),
    overallScoreCheck: check(
      "profile_scores_overall_range",
      sql`${t.overallScore} >= 0 AND ${t.overallScore} <= 100`,
    ),
  }),
);

export const matchScoresTable = pgTable(
  "match_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .unique()
      .references(() => applicationsTable.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => profilesTable.id),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobsTable.id),
    resumeId: uuid("resume_id")
      .notNull()
      .references(() => resumesTable.id),
    overallScore: integer("overall_score").notNull(),
    band: text("band", { enum: SCORE_BAND }).notNull(),
    components: jsonb("components").notNull(),
    redactedFields: text("redacted_fields").array().notNull().default(sql`'{}'::text[]`),
    weightsUsed: jsonb("weights_used").notNull(),
    promptVersion: text("prompt_version").notNull(),
    modelUsed: text("model_used").notNull(),
    rawOutput: jsonb("raw_output").notNull(),
    latencyMs: integer("latency_ms"),
    status: text("status", { enum: SCORE_STATUS }).notNull().default("completed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    candidateIdx: index("match_scores_candidate_idx").on(t.candidateId),
    jobIdx: index("match_scores_job_idx").on(t.jobId),
    overallIdx: index("match_scores_overall_idx").on(t.overallScore),
    overallScoreCheck: check(
      "match_scores_overall_range",
      sql`${t.overallScore} >= 0 AND ${t.overallScore} <= 100`,
    ),
  }),
);

export const evidenceExcerptsTable = pgTable(
  "evidence_excerpts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scoreType: text("score_type", { enum: SCORE_TYPE }).notNull(),
    scoreId: uuid("score_id").notNull(), // polymorphic FK; gated via RLS + service-layer integrity
    componentName: text("component_name").notNull(),
    excerptText: text("excerpt_text").notNull(),
    excerptSource: text("excerpt_source"),
    relevance: text("relevance", { enum: ["positive", "negative", "neutral"] }).notNull(),
    contributionPoints: integer("contribution_points"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    scoreIdx: index("evidence_excerpts_score_idx").on(t.scoreType, t.scoreId),
  }),
);

export const biasFlagsTable = pgTable(
  "bias_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobsTable.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    category: text("category", { enum: BIAS_CATEGORY }).notNull(),
    severity: text("severity", { enum: BIAS_SEVERITY }),
    suggestion: text("suggestion"),
    positionStart: integer("position_start"),
    positionEnd: integer("position_end"),
    status: text("status", { enum: BIAS_FLAG_STATUS }).notNull().default("flagged"),
    overrideReason: text("override_reason"),
    overriddenBy: uuid("overridden_by").references(() => profilesTable.id),
    overriddenAt: timestamp("overridden_at", { withTimezone: true }),
    promptVersion: text("prompt_version").notNull(),
    modelUsed: text("model_used").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    jobIdx: index("bias_flags_job_idx").on(t.jobId),
    statusIdx: index("bias_flags_status_idx").on(t.status),
    categoryIdx: index("bias_flags_category_idx").on(t.category),
    createdIdx: index("bias_flags_created_idx").on(t.createdAt),
  }),
);

export const scoringConfigTable = pgTable(
  "scoring_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    isActive: boolean("is_active").notNull().default(false),
    matchWeights: jsonb("match_weights").notNull(),
    profileWeights: jsonb("profile_weights").notNull(),
    bandThresholds: jsonb("band_thresholds").notNull(),
    biasCategoriesEnabled: text("bias_categories_enabled")
      .array()
      .notNull()
      .default(sql`'{gendered,age-coded,ableist,exclusionary}'::text[]`),
    customFlaggedTerms: text("custom_flagged_terms").array().notNull().default(sql`'{}'::text[]`),
    piiRedactionEnabled: boolean("pii_redaction_enabled").notNull().default(true),
    piiFieldsRedacted: text("pii_fields_redacted")
      .array()
      .notNull()
      .default(sql`'{name,photo,age,gender,address,date_of_birth}'::text[]`),
    updatedBy: uuid("updated_by").references(() => profilesTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    activeIdx: index("scoring_config_active_idx").on(t.isActive),
  }),
);

// ============================================================================
// AUTH TOKENS
// ============================================================================

// Single-purpose, single-use tokens for backend-owned email verification and
// password reset flows. Raw tokens are never stored — only their SHA-256 hash.
export const authTokensTable = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(), // mirrors auth.users.id (no FK; auth schema is owned by Supabase)
    email: text("email").notNull(),
    kind: text("kind", { enum: ["email_verification", "password_reset"] }).notNull(),
    tokenHash: text("token_hash").notNull(),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenHashIdx: unique("auth_tokens_token_hash_unique").on(t.tokenHash),
    userKindIdx: index("auth_tokens_user_kind_idx").on(t.userId, t.kind),
    emailKindIdx: index("auth_tokens_email_kind_idx").on(t.email, t.kind),
    expiresIdx: index("auth_tokens_expires_idx").on(t.expiresAt),
  }),
);

// ============================================================================
// AUDIT
// ============================================================================

export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => profilesTable.id, { onDelete: "set null" }),
    actorType: text("actor_type", { enum: AUDIT_ACTOR_TYPE }).notNull(),
    // Per-tenant explainability. Nullable so cross-tenant admin/system
    // actions can still log with no company context.
    companyId: uuid("company_id").references(() => companiesTable.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    details: jsonb("details").notNull().default(sql`'{}'::jsonb`),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    createdIdx: index("audit_logs_created_idx").on(t.createdAt),
    actorIdx: index("audit_logs_actor_idx").on(t.actorId, t.createdAt),
    entityIdx: index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    actionIdx: index("audit_logs_action_idx").on(t.action),
    companyIdx: index("audit_logs_company_id_idx").on(t.companyId),
  }),
);

// ============================================================================
// TYPE EXPORTS (for application-layer use)
// ============================================================================

export type Profile = typeof profilesTable.$inferSelect;
export type NewProfile = typeof profilesTable.$inferInsert;
export type CandidateProfile = typeof candidateProfilesTable.$inferSelect;
export type NewCandidateProfile = typeof candidateProfilesTable.$inferInsert;
export type RecruiterProfile = typeof recruiterProfilesTable.$inferSelect;
export type NewRecruiterProfile = typeof recruiterProfilesTable.$inferInsert;
export type Company = typeof companiesTable.$inferSelect;
export type NewCompany = typeof companiesTable.$inferInsert;
export type Job = typeof jobsTable.$inferSelect;
export type NewJob = typeof jobsTable.$inferInsert;
export type Resume = typeof resumesTable.$inferSelect;
export type NewResume = typeof resumesTable.$inferInsert;
export type Application = typeof applicationsTable.$inferSelect;
export type NewApplication = typeof applicationsTable.$inferInsert;
export type Interview = typeof interviewsTable.$inferSelect;
export type NewInterview = typeof interviewsTable.$inferInsert;
export type Offer = typeof offersTable.$inferSelect;
export type NewOffer = typeof offersTable.$inferInsert;
export type ProfileScore = typeof profileScoresTable.$inferSelect;
export type NewProfileScore = typeof profileScoresTable.$inferInsert;
export type MatchScore = typeof matchScoresTable.$inferSelect;
export type NewMatchScore = typeof matchScoresTable.$inferInsert;
export type EvidenceExcerpt = typeof evidenceExcerptsTable.$inferSelect;
export type NewEvidenceExcerpt = typeof evidenceExcerptsTable.$inferInsert;
export type BiasFlag = typeof biasFlagsTable.$inferSelect;
export type NewBiasFlag = typeof biasFlagsTable.$inferInsert;
export type ScoringConfig = typeof scoringConfigTable.$inferSelect;
export type NewScoringConfig = typeof scoringConfigTable.$inferInsert;
export type AuditLog = typeof auditLogsTable.$inferSelect;
export type NewAuditLog = typeof auditLogsTable.$inferInsert;
export type AuthToken = typeof authTokensTable.$inferSelect;
export type NewAuthToken = typeof authTokensTable.$inferInsert;
export type CompanyMember = typeof companyMembersTable.$inferSelect;
export type NewCompanyMember = typeof companyMembersTable.$inferInsert;
