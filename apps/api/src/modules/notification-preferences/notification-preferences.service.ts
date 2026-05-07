import { Injectable, BadRequestException } from "@nestjs/common";
import type {
  NotificationEventType,
  NotificationMode,
} from "@aurahire/db";
import { NOTIFICATION_EVENT_TYPE } from "@aurahire/db";
import {
  DEFAULT_MODES,
  SECURITY_EVENTS,
  EVENT_CATEGORIES,
  ROLE_VISIBLE_EVENTS,
  EVENT_LABELS,
  EVENT_DESCRIPTIONS,
  type EventCategory,
} from "../notifications/event-defaults";
import { NotificationPreferencesRepository } from "./notification-preferences.repository";

export interface UpsertPreferenceInput {
  eventType: NotificationEventType;
  mode: NotificationMode;
}

export interface PreferenceListItem {
  eventType: NotificationEventType;
  mode: NotificationMode;
  isDefault: boolean;
  isSecurityLocked: boolean;
  category: EventCategory;
  label: string;
  description: string;
}

export interface RestoreDefaultsInput {
  category: EventCategory | "all";
}

@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly repo: NotificationPreferencesRepository) {}

  async getEffectiveMode(
    userId: string,
    eventType: NotificationEventType,
  ): Promise<NotificationMode> {
    if (SECURITY_EVENTS.has(eventType)) return "instant";
    const row = await this.repo.findOne(userId, eventType);
    return row?.mode ?? DEFAULT_MODES[eventType];
  }

  async upsert(userId: string, input: UpsertPreferenceInput) {
    if (SECURITY_EVENTS.has(input.eventType)) {
      throw new BadRequestException(
        "This event type is required for security and cannot be modified.",
      );
    }
    return this.repo.upsert(userId, input.eventType, input.mode);
  }

  async listForRole(
    userId: string,
    role: "candidate" | "recruiter" | "admin",
  ): Promise<PreferenceListItem[]> {
    const visible = ROLE_VISIBLE_EVENTS[role];
    const stored = await this.repo.findByUser(userId);
    const map = new Map(stored.map((r) => [r.eventType, r.mode]));

    return visible.map((eventType) => {
      const isSecurityLocked = SECURITY_EVENTS.has(eventType);
      const overridden = map.get(eventType);
      const mode: NotificationMode = isSecurityLocked
        ? "instant"
        : overridden ?? DEFAULT_MODES[eventType];
      return {
        eventType,
        mode,
        isDefault: !isSecurityLocked && overridden === undefined,
        isSecurityLocked,
        category: EVENT_CATEGORIES[eventType],
        label: EVENT_LABELS[eventType],
        description: EVENT_DESCRIPTIONS[eventType],
      };
    });
  }

  async restoreDefaults(userId: string, input: RestoreDefaultsInput) {
    if (input.category === "all") {
      const deleted = await this.repo.deleteAllForUser(userId);
      return { deleted };
    }
    const eventsInCategory = NOTIFICATION_EVENT_TYPE.filter(
      (e) => EVENT_CATEGORIES[e] === input.category && !SECURITY_EVENTS.has(e),
    );
    const deleted = await this.repo.deleteForCategory(userId, eventsInCategory);
    return { deleted };
  }
}
