import { z } from "zod";
import { uuidSchema } from "./shared";
import { APPLICATION_STATUS } from "../enums";

export const applyToJobSchema = z.object({
  jobId: uuidSchema,
  resumeId: uuidSchema.optional(),
  coverLetter: z.string().max(5000).nullable().optional(),
});

export type ApplyToJobInput = z.infer<typeof applyToJobSchema>;

export const updateApplicationStatusSchema = z.object({
  newStatus: z.enum(APPLICATION_STATUS),
  note: z.string().max(2000).nullable().optional(),
  /**
   * When true AND newStatus is "hired", server cascades: every other
   * in-flight application on the same job is auto-rejected with a
   * "position filled" notification. Honored only for hire transitions.
   */
  autoRejectOthers: z.boolean().optional(),
});

export type UpdateApplicationStatusInput = z.infer<
  typeof updateApplicationStatusSchema
>;

export const updateApplicationNotesSchema = z.object({
  notes: z.string().max(5000).nullable(),
});

export type UpdateApplicationNotesInput = z.infer<
  typeof updateApplicationNotesSchema
>;

export const recentApplicationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional().default(6),
});

export type RecentApplicationsQuery = z.infer<
  typeof recentApplicationsQuerySchema
>;

export const recruiterStatsQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d", "all"]).optional().default("7d"),
});

export type RecruiterStatsQuery = z.infer<typeof recruiterStatsQuerySchema>;
export type RecruiterStatsRange = RecruiterStatsQuery["range"];

export const shortlistQuerySchema = z.object({
  q: z.string().max(200).optional(),
  status: z.enum(APPLICATION_STATUS).optional(),
  jobId: uuidSchema.optional(),
  band: z.enum(["strong", "partial", "limited"]).optional(),
  sort: z
    .enum(["recently-shortlisted", "highest-score", "earliest-applied"])
    .optional()
    .default("recently-shortlisted"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export type ShortlistQuery = z.infer<typeof shortlistQuerySchema>;

export const recruiterApplicationsListQuerySchema = z.object({
  q: z.string().max(200).optional(),
  status: z.enum(APPLICATION_STATUS).optional(),
  jobId: uuidSchema.optional(),
  band: z.enum(["strong", "partial", "limited"]).optional(),
  sort: z.enum(["recent", "oldest", "score-high"]).optional().default("recent"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export type RecruiterApplicationsListQuery = z.infer<
  typeof recruiterApplicationsListQuerySchema
>;

export const withdrawApplicationSchema = z.object({
  reason: z.string().trim().max(500).nullable().optional(),
});
export type WithdrawApplicationInput = z.infer<
  typeof withdrawApplicationSchema
>;
