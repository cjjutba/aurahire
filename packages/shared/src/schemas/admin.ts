import { z } from "zod";

import {
  APPLICATION_STATUS,
  AUDIT_ACTOR_TYPE,
  JOB_STATUS,
  USER_ROLES,
  USER_STATUS,
} from "../enums/index";
import { uuidSchema } from "./shared";

// ---------- LIST USERS QUERY ----------
export const listAdminUsersQuerySchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUS).optional(),
  q: z.string().max(200).optional(),
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQuerySchema>;

// ---------- SUSPEND USER ----------
export const suspendUserSchema = z.object({
  reason: z
    .string()
    .min(10, "Reason must be at least 10 characters")
    .max(1000, "Reason cannot exceed 1000 characters"),
});
export type SuspendUserInput = z.infer<typeof suspendUserSchema>;

// ---------- CHANGE ROLE ----------
export const changeUserRoleSchema = z.object({
  newRole: z.enum(USER_ROLES),
});
export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>;

// ---------- LIST JOBS QUERY ----------
export const listAdminJobsQuerySchema = z.object({
  status: z.enum(JOB_STATUS).optional(),
  recruiterId: uuidSchema.optional(),
  hasBiasFlags: z.coerce.boolean().optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListAdminJobsQuery = z.infer<typeof listAdminJobsQuerySchema>;

// ---------- LIST ADMIN APPLICATIONS QUERY ----------
export const listAdminApplicationsQuerySchema = z
  .object({
    jobId: uuidSchema.optional(),
    candidateId: uuidSchema.optional(),
    status: z.enum(APPLICATION_STATUS).optional(),
    minScore: z.coerce.number().int().min(0).max(100).optional(),
    maxScore: z.coerce.number().int().min(0).max(100).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    q: z.string().max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine(
    (data) =>
      data.minScore === undefined ||
      data.maxScore === undefined ||
      data.minScore <= data.maxScore,
    {
      message: "minScore must be ≤ maxScore",
      path: ["minScore"],
    },
  );

export type ListAdminApplicationsQuery = z.infer<
  typeof listAdminApplicationsQuerySchema
>;

// ---------- SCORING CONFIG: nested schemas ----------

export const matchWeightsSchema = z.object({
  skills: z.number().int().min(0).max(100),
  experience: z.number().int().min(0).max(100),
  education: z.number().int().min(0).max(100),
  cultural_fit: z.number().int().min(0).max(100),
});
export type MatchWeights = z.infer<typeof matchWeightsSchema>;

export const profileWeightsSchema = z.object({
  completeness: z.number().int().min(0).max(100),
  skill_depth: z.number().int().min(0).max(100),
  experience_clarity: z.number().int().min(0).max(100),
  education_quality: z.number().int().min(0).max(100),
});
export type ProfileWeights = z.infer<typeof profileWeightsSchema>;

export const bandThresholdsSchema = z.object({
  strong: z.number().int().min(1).max(100),
  partial: z.number().int().min(0).max(99),
});
export type BandThresholds = z.infer<typeof bandThresholdsSchema>;

const BIAS_CATEGORY_VALUES = [
  "gendered",
  "age-coded",
  "ableist",
  "exclusionary",
  "other",
] as const;

// ---------- UPDATE SCORING CONFIG ----------

const SUM_TARGET = 100;
const SUM_TOLERANCE = 0;

function sumsTo100<T extends Record<string, number>>(weights: T): boolean {
  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  return Math.abs(total - SUM_TARGET) <= SUM_TOLERANCE;
}

export const updateScoringConfigSchema = z
  .object({
    matchWeights: matchWeightsSchema.optional(),
    profileWeights: profileWeightsSchema.optional(),
    bandThresholds: bandThresholdsSchema.optional(),
    // Per thesis panel revision (May 2026): admin-tunable minimum match
    // score for interview eligibility. Applications scoring below this
    // are auto-rejected. Default 75 (set in the DB column default).
    autoRejectThreshold: z.number().int().min(0).max(100).optional(),
    biasCategoriesEnabled: z
      .array(z.enum(BIAS_CATEGORY_VALUES))
      .max(5)
      .optional(),
    customFlaggedTerms: z.array(z.string().min(1).max(100)).max(50).optional(),
    piiRedactionEnabled: z.boolean().optional(),
    piiFieldsRedacted: z.array(z.string().min(1).max(50)).max(20).optional(),
  })
  .refine((data) => !data.matchWeights || sumsTo100(data.matchWeights), {
    message: "matchWeights must sum to 100",
    path: ["matchWeights"],
  })
  .refine((data) => !data.profileWeights || sumsTo100(data.profileWeights), {
    message: "profileWeights must sum to 100",
    path: ["profileWeights"],
  })
  .refine(
    (data) =>
      !data.bandThresholds ||
      data.bandThresholds.strong > data.bandThresholds.partial,
    {
      message:
        "bandThresholds.strong must be greater than bandThresholds.partial",
      path: ["bandThresholds"],
    },
  );
export type UpdateScoringConfigInput = z.infer<
  typeof updateScoringConfigSchema
>;

// ---------- PREVIEW IMPACT REQUEST ----------

export const previewImpactRequestSchema = z.object({
  proposedConfig: z
    .object({
      matchWeights: matchWeightsSchema.optional(),
      bandThresholds: bandThresholdsSchema.optional(),
    })
    .refine((data) => !data.matchWeights || sumsTo100(data.matchWeights), {
      message: "matchWeights must sum to 100",
      path: ["matchWeights"],
    })
    .refine(
      (data) =>
        !data.bandThresholds ||
        data.bandThresholds.strong > data.bandThresholds.partial,
      {
        message:
          "bandThresholds.strong must be greater than bandThresholds.partial",
        path: ["bandThresholds"],
      },
    ),
  sampleSize: z.coerce.number().int().min(1).max(500).default(100),
});
export type PreviewImpactInput = z.infer<typeof previewImpactRequestSchema>;

// ---------- LIST ADMIN AUDIT QUERY ----------

export const listAdminAuditQuerySchema = z.object({
  actorId: uuidSchema.optional(),
  q: z.string().max(200).optional(),
  entityType: z
    .enum([
      "profile",
      "job",
      "application",
      "match_score",
      "profile_score",
      "bias_flag",
      "scoring_config",
      "resume",
      "company",
      "company_member",
      "interview",
      "offer",
      "cron",
    ])
    .optional(),
  action: z.string().max(100).optional(),
  actorType: z.enum(AUDIT_ACTOR_TYPE).optional(),
  /** Cross-tenant filter: scope to a specific company. */
  companyId: uuidSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListAdminAuditQuery = z.infer<typeof listAdminAuditQuerySchema>;

// ---------- ANALYTICS QUERY ----------

export const analyticsQuerySchema = z
  .object({
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      if (!data.dateFrom || !data.dateTo) return true;
      return new Date(data.dateFrom) <= new Date(data.dateTo);
    },
    { message: "dateFrom must be ≤ dateTo", path: ["dateFrom"] },
  );
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

// ---------- BIAS MONITOR QUERY ----------

export const biasMonitorQuerySchema = z
  .object({
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    promptVersionMin: z.string().optional(),
  })
  .refine(
    (data) => {
      if (!data.dateFrom || !data.dateTo) return true;
      return new Date(data.dateFrom) <= new Date(data.dateTo);
    },
    { message: "dateFrom must be ≤ dateTo", path: ["dateFrom"] },
  );
export type BiasMonitorQuery = z.infer<typeof biasMonitorQuerySchema>;

// ---------- ENQUEUE RESCORE BATCH ----------

export const enqueueRescoreBatchSchema = z.object({
  sampleSize: z.coerce.number().int().min(1).max(500).default(50),
});
export type EnqueueRescoreBatchInput = z.infer<
  typeof enqueueRescoreBatchSchema
>;
