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
});

export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusSchema>;

export const updateApplicationNotesSchema = z.object({
  notes: z.string().max(5000).nullable(),
});

export type UpdateApplicationNotesInput = z.infer<typeof updateApplicationNotesSchema>;

export const recentApplicationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional().default(6),
});

export type RecentApplicationsQuery = z.infer<typeof recentApplicationsQuerySchema>;

export const recruiterStatsQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d", "all"]).optional().default("7d"),
});

export type RecruiterStatsQuery = z.infer<typeof recruiterStatsQuerySchema>;
export type RecruiterStatsRange = RecruiterStatsQuery["range"];
