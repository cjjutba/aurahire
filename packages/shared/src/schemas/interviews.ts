import { z } from "zod";
import { INTERVIEW_FORMAT, INTERVIEW_STATUS } from "../enums";

export const recruiterInterviewsQuerySchema = z.object({
  q: z.string().max(200).optional(),
  status: z.enum(INTERVIEW_STATUS).optional(),
  format: z.enum(INTERVIEW_FORMAT).optional(),
  sort: z
    .enum(["upcoming", "recent", "earliest"])
    .optional()
    .default("upcoming"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export type RecruiterInterviewsQuery = z.infer<typeof recruiterInterviewsQuerySchema>;

export const scheduleInterviewSchema = z.object({
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(240).default(60),
  format: z.enum(INTERVIEW_FORMAT),
  locationOrLink: z.string().min(1).max(500).nullable().optional(),
});
export type ScheduleInterviewInput = z.infer<typeof scheduleInterviewSchema>;

export const updateInterviewFeedbackSchema = z.object({
  feedback: z.string().min(1).max(5000),
  rating: z.number().int().min(1).max(5).nullable().optional(),
});
export type UpdateInterviewFeedbackInput = z.infer<typeof updateInterviewFeedbackSchema>;

export const updateInterviewStatusSchema = z.object({
  newStatus: z.enum(INTERVIEW_STATUS),
});
export type UpdateInterviewStatusInput = z.infer<typeof updateInterviewStatusSchema>;
