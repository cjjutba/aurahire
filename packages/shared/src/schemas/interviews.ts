import { z } from "zod";
import { INTERVIEW_FORMAT, INTERVIEW_STATUS } from "../enums";

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
