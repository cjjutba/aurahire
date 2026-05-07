import { z } from "zod";

import {
  APPLICATION_STATUS,
  BIAS_CATEGORY,
  INTERVIEW_FORMAT,
  INTERVIEW_STATUS,
} from "../enums";

// Event names — the single source of truth used by both backend emitters and
// frontend listeners. Past-tense, dotted-namespace.
export const RealtimeEvent = {
  ApplicationCreated: "application.created",
  ApplicationStatusChanged: "application.status_changed",
  ApplicationScored: "application.scored",
  InterviewScheduled: "interview.scheduled",
  InterviewStatusChanged: "interview.status_changed",
  OfferSent: "offer.sent",
  AuditEntry: "audit.entry",
  BiasFlagCreated: "bias.flag_created",
} as const;

export type RealtimeEventName = (typeof RealtimeEvent)[keyof typeof RealtimeEvent];

// Payload schemas. All IDs are uuids; timestamps are ISO strings (the wire format).
const isoDate = z.string().datetime();

export const applicationCreatedSchema = z.object({
  applicationId: z.string().uuid(),
  jobId: z.string().uuid(),
  recruiterId: z.string().uuid(),
  candidateId: z.string().uuid(),
  createdAt: isoDate,
});
export type ApplicationCreatedPayload = z.infer<typeof applicationCreatedSchema>;

export const applicationStatusChangedSchema = z.object({
  applicationId: z.string().uuid(),
  jobId: z.string().uuid(),
  recruiterId: z.string().uuid(),
  candidateId: z.string().uuid(),
  previousStatus: z.enum(APPLICATION_STATUS),
  status: z.enum(APPLICATION_STATUS),
  changedAt: isoDate,
});
export type ApplicationStatusChangedPayload = z.infer<
  typeof applicationStatusChangedSchema
>;

// Emitted from the async match-score worker after the match_score row lands.
// Targets the candidate's user room, the recruiter, and the job room so every
// open surface (applicant detail page, recruiter pipeline card) updates live.
export const applicationScoredSchema = z.object({
  applicationId: z.string().uuid(),
  jobId: z.string().uuid(),
  recruiterId: z.string().uuid(),
  candidateId: z.string().uuid(),
  overallScore: z.number().int().min(0).max(100),
  band: z.enum(["strong", "partial", "limited"]),
  scoredAt: isoDate,
});
export type ApplicationScoredPayload = z.infer<typeof applicationScoredSchema>;

export const interviewScheduledSchema = z.object({
  interviewId: z.string().uuid(),
  applicationId: z.string().uuid(),
  jobId: z.string().uuid(),
  recruiterId: z.string().uuid(),
  candidateId: z.string().uuid(),
  scheduledFor: isoDate,
  format: z.enum(INTERVIEW_FORMAT),
});
export type InterviewScheduledPayload = z.infer<typeof interviewScheduledSchema>;

export const interviewStatusChangedSchema = z.object({
  interviewId: z.string().uuid(),
  applicationId: z.string().uuid(),
  recruiterId: z.string().uuid(),
  candidateId: z.string().uuid(),
  previousStatus: z.enum(INTERVIEW_STATUS),
  status: z.enum(INTERVIEW_STATUS),
  changedAt: isoDate,
});
export type InterviewStatusChangedPayload = z.infer<
  typeof interviewStatusChangedSchema
>;

export const offerSentSchema = z.object({
  offerId: z.string().uuid(),
  applicationId: z.string().uuid(),
  recruiterId: z.string().uuid(),
  candidateId: z.string().uuid(),
  sentAt: isoDate,
});
export type OfferSentPayload = z.infer<typeof offerSentSchema>;

export const auditEntrySchema = z.object({
  auditId: z.string().uuid(),
  actorId: z.string().uuid().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().uuid(),
  createdAt: isoDate,
  summary: z.string(),
});
export type AuditEntryPayload = z.infer<typeof auditEntrySchema>;

export const biasFlagCreatedSchema = z.object({
  flagId: z.string().uuid(),
  jobId: z.string().uuid(),
  term: z.string(),
  category: z.enum(BIAS_CATEGORY),
  createdAt: isoDate,
});
export type BiasFlagCreatedPayload = z.infer<typeof biasFlagCreatedSchema>;

// A discriminated map of event-name → payload, useful for typing handlers.
export interface RealtimeEventPayloadMap {
  [RealtimeEvent.ApplicationCreated]: ApplicationCreatedPayload;
  [RealtimeEvent.ApplicationStatusChanged]: ApplicationStatusChangedPayload;
  [RealtimeEvent.ApplicationScored]: ApplicationScoredPayload;
  [RealtimeEvent.InterviewScheduled]: InterviewScheduledPayload;
  [RealtimeEvent.InterviewStatusChanged]: InterviewStatusChangedPayload;
  [RealtimeEvent.OfferSent]: OfferSentPayload;
  [RealtimeEvent.AuditEntry]: AuditEntryPayload;
  [RealtimeEvent.BiasFlagCreated]: BiasFlagCreatedPayload;
}

// Subscription messages (client → server).
export const subscribeMessageSchema = z.object({
  resource: z.literal("job"),
  id: z.string().uuid(),
});
export type SubscribeMessage = z.infer<typeof subscribeMessageSchema>;
