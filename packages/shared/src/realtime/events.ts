import { z } from "zod";

// Event names — the single source of truth used by both backend emitters and
// frontend listeners. Past-tense, dotted-namespace.
export const RealtimeEvent = {
  ApplicationCreated: "application.created",
  ApplicationStatusChanged: "application.status_changed",
  InterviewScheduled: "interview.scheduled",
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
  previousStatus: z.string(),
  status: z.string(),
  changedAt: isoDate,
});
export type ApplicationStatusChangedPayload = z.infer<
  typeof applicationStatusChangedSchema
>;

export const interviewScheduledSchema = z.object({
  interviewId: z.string().uuid(),
  applicationId: z.string().uuid(),
  jobId: z.string().uuid(),
  recruiterId: z.string().uuid(),
  candidateId: z.string().uuid(),
  scheduledFor: isoDate,
  format: z.string(),
});
export type InterviewScheduledPayload = z.infer<typeof interviewScheduledSchema>;

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
  entityId: z.string().uuid().nullable(),
  createdAt: isoDate,
  summary: z.string(),
});
export type AuditEntryPayload = z.infer<typeof auditEntrySchema>;

export const biasFlagCreatedSchema = z.object({
  flagId: z.string().uuid(),
  jobId: z.string().uuid(),
  term: z.string(),
  category: z.string(),
  createdAt: isoDate,
});
export type BiasFlagCreatedPayload = z.infer<typeof biasFlagCreatedSchema>;

// A discriminated map of event-name → payload, useful for typing handlers.
export interface RealtimeEventPayloadMap {
  [RealtimeEvent.ApplicationCreated]: ApplicationCreatedPayload;
  [RealtimeEvent.ApplicationStatusChanged]: ApplicationStatusChangedPayload;
  [RealtimeEvent.InterviewScheduled]: InterviewScheduledPayload;
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
