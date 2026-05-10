export const NOTIFICATION_EMAIL_QUEUE = "notification-email";

export type NotificationEmailJobData =
  | { kind: "instant"; notificationId: string }
  | { kind: "digest"; userId: string; notificationIds: string[] };
