import { z } from "zod";
import {
  INTERVIEW_FORMAT,
  INTERVIEW_RECOMMENDATION,
  INTERVIEW_STATUS,
} from "../enums";

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
export type RecruiterInterviewsQuery = z.infer<
  typeof recruiterInterviewsQuerySchema
>;

const httpOrHttpsUrl = z
  .string()
  .trim()
  .max(2048)
  .regex(/^https?:\/\//i, { message: "Must start with http:// or https://" })
  .optional()
  .nullable();

export const scheduleInterviewSchema = z.object({
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(240).default(60),
  // Format kept for forward-compat; defaults to in-person.
  format: z.enum(INTERVIEW_FORMAT).optional().default("in-person"),
  // Legacy field — accepted but not displayed.
  locationOrLink: z.string().min(1).max(500).nullable().optional(),

  // Structured venue fields
  venueName: z.string().trim().min(1).max(200),
  addressLine: z.string().trim().min(1).max(500),
  roomOrFloor: z.string().trim().max(200).nullable().optional(),
  mapUrl: httpOrHttpsUrl,
  reportingInstructions: z.string().max(2000).nullable().optional(),
  whatToBring: z.string().max(2000).nullable().optional(),
  interviewerName: z.string().trim().max(200).nullable().optional(),
  interviewerTitle: z.string().trim().max(200).nullable().optional(),

  // Optional persistence flag
  saveAsTemplate: z.boolean().optional().default(false),
  templateLabel: z.string().trim().min(1).max(100).optional(),
});
export type ScheduleInterviewInput = z.infer<typeof scheduleInterviewSchema>;

export const rescheduleInterviewSchema = scheduleInterviewSchema;
export type RescheduleInterviewInput = z.infer<
  typeof rescheduleInterviewSchema
>;

export const updateInterviewFeedbackSchema = z.object({
  feedback: z.string().min(1).max(5000),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  recommendation: z.enum(INTERVIEW_RECOMMENDATION).nullable().optional(),
});
export type UpdateInterviewFeedbackInput = z.infer<
  typeof updateInterviewFeedbackSchema
>;

export const shareInterviewFeedbackSchema = z.object({
  candidateSummary: z.string().trim().min(1).max(4000),
});
export type ShareInterviewFeedbackInput = z.infer<
  typeof shareInterviewFeedbackSchema
>;

export const updateInterviewStatusSchema = z.object({
  newStatus: z.enum(INTERVIEW_STATUS),
});
export type UpdateInterviewStatusInput = z.infer<
  typeof updateInterviewStatusSchema
>;

export const interviewConflictsQuerySchema = z.object({
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(240),
  candidateId: z.string().uuid(),
});
export type InterviewConflictsQuery = z.infer<
  typeof interviewConflictsQuerySchema
>;
