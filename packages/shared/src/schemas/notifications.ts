import { z } from "zod";

export const notificationEventTypeSchema = z.enum([
  "application_status_changed",
  "interview_scheduled",
  "interview_reminder_24h",
  "interview_cancelled",
  "offer_received",
  "offer_expiring_soon",
  "new_application_received",
  "candidate_withdrew",
  "interview_feedback_due",
  "offer_accepted",
  "offer_declined",
  "bias_flag_raised",
  "team_invite_accepted",
  "team_invite_declined",
  "system_bias_flag_raised",
  "system_ai_scoring_failure",
  "system_moderation_queue_item",
  "account_password_reset",
  "account_email_verified",
  "account_login_new_device",
]);

export const notificationModeSchema = z.enum(["instant", "digest", "off"]);
export const notificationScopeSchema = z.enum(["personal", "system"]);

export const notificationCategorySchema = z.enum([
  "account",
  "applications",
  "interviews",
  "offers",
  "bias",
  "team",
  "system",
]);

export const notificationItemSchema = z.object({
  id: z.string().uuid(),
  eventType: notificationEventTypeSchema,
  scope: notificationScopeSchema,
  title: z.string(),
  body: z.string(),
  link: z.string().nullable(),
  entityType: z.string().nullable(),
  entityId: z.string().uuid().nullable(),
  actorId: z.string().uuid().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  readAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
});
export type NotificationItem = z.infer<typeof notificationItemSchema>;

export const listNotificationsQuerySchema = z.object({
  tab: z.enum(["inbox", "archive"]).default("inbox"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export const listNotificationsResponseSchema = z.object({
  items: z.array(notificationItemSchema),
  nextCursor: z.string().nullable(),
});
export type ListNotificationsResponse = z.infer<typeof listNotificationsResponseSchema>;

export const unreadCountResponseSchema = z.object({
  count: z.number().int().min(0),
  displayCount: z.string(),
});
export type UnreadCountResponse = z.infer<typeof unreadCountResponseSchema>;

export const markReadResponseSchema = unreadCountResponseSchema.extend({
  unreadCount: z.number().int().min(0),
});
export type MarkReadResponse = z.infer<typeof markReadResponseSchema>;

export const upsertPreferenceBodySchema = z.object({
  eventType: notificationEventTypeSchema,
  mode: notificationModeSchema,
});
export type UpsertPreferenceBody = z.infer<typeof upsertPreferenceBodySchema>;

export const preferenceItemSchema = z.object({
  eventType: notificationEventTypeSchema,
  mode: notificationModeSchema,
  isDefault: z.boolean(),
  isSecurityLocked: z.boolean(),
  category: notificationCategorySchema,
  label: z.string(),
  description: z.string(),
});
export type PreferenceItem = z.infer<typeof preferenceItemSchema>;

export const restoreDefaultsBodySchema = z.object({
  category: z
    .enum(["applications", "interviews", "offers", "bias", "team", "system", "all"])
    .default("all"),
});
export type RestoreDefaultsBody = z.infer<typeof restoreDefaultsBodySchema>;

export const restoreDefaultsResponseSchema = z.object({
  deleted: z.number().int().min(0),
});
export type RestoreDefaultsResponse = z.infer<typeof restoreDefaultsResponseSchema>;
