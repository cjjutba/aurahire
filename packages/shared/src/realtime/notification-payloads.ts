import { z } from "zod";

export const notificationCreatedPayloadSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  kind: z.string(),
  title: z.string(),
  bodyExcerpt: z.string(),
  linkUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
  unreadCount: z.number().int().min(0),
});
export type NotificationCreatedPayload = z.infer<
  typeof notificationCreatedPayloadSchema
>;

export const notificationReadPayloadSchema = z.object({
  id: z.string().uuid(),
  unreadCount: z.number().int().min(0),
});
export type NotificationReadPayload = z.infer<
  typeof notificationReadPayloadSchema
>;

export const notificationArchivedPayloadSchema = z.object({
  id: z.string().uuid(),
  unreadCount: z.number().int().min(0),
});
export type NotificationArchivedPayload = z.infer<
  typeof notificationArchivedPayloadSchema
>;

export const notificationArchiveAllPayloadSchema = z.object({
  unreadCount: z.literal(0),
});
export type NotificationArchiveAllPayload = z.infer<
  typeof notificationArchiveAllPayloadSchema
>;
