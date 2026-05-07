import type { NotificationEventType } from "@aurahire/db";

export function buildTitle(eventType: NotificationEventType, _metadata: Record<string, unknown>): string {
  return `Notification: ${eventType}`;
}

export function buildBody(_eventType: NotificationEventType, _metadata: Record<string, unknown>): string {
  return "";
}

export function buildLink(
  _eventType: NotificationEventType,
  _role: "candidate" | "recruiter" | "admin",
  _metadata: Record<string, unknown>,
): string | null {
  return null;
}
