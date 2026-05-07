import { Injectable } from "@nestjs/common";
import type { NotificationEventType, NotificationMode } from "@aurahire/db";

@Injectable()
export class NotificationPreferencesService {
  // Stub — full implementation lands in T10.
  async getEffectiveMode(_userId: string, _eventType: NotificationEventType): Promise<NotificationMode> {
    return "instant";
  }
}
