import { Injectable, Logger, forwardRef, Inject } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type {
  NotificationEventType,
  NotificationScope,
  NotificationMode,
} from "@aurahire/db";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationPreferencesService } from "../notification-preferences/notification-preferences.service";
import { NOTIFICATION_EMAIL_QUEUE, type NotificationEmailJobData } from "./queues";
import { SECURITY_EVENTS } from "./event-defaults";
import { buildTitle, buildBody, buildLink } from "./templates";
import { ProfilesRepository } from "../profiles/profiles.repository";

export interface EmitParams {
  userId: string;
  eventType: NotificationEventType;
  scope?: NotificationScope;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repo: NotificationsRepository,
    @Inject(forwardRef(() => NotificationPreferencesService))
    private readonly prefs: NotificationPreferencesService,
    @InjectQueue(NOTIFICATION_EMAIL_QUEUE)
    private readonly queue: Queue<NotificationEmailJobData>,
    private readonly profiles: ProfilesRepository,
  ) {}

  async emit(params: EmitParams): Promise<void> {
    try {
      if (params.actorId && params.actorId === params.userId) return;

      const profile = await this.profiles.findById(params.userId);
      if (!profile || profile.status !== "active") return;

      const role = profile.role as "candidate" | "recruiter" | "admin";
      const title = buildTitle(params.eventType, params.metadata ?? {});
      const body = buildBody(params.eventType, params.metadata ?? {});
      const link = buildLink(params.eventType, role, params.metadata ?? {});

      const row = await this.repo.insertOne({
        userId: params.userId,
        eventType: params.eventType,
        scope: params.scope ?? "personal",
        title,
        body,
        link,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        actorId: params.actorId ?? null,
        metadata: params.metadata ?? null,
      });

      const mode = await this.resolveDeliveryMode(params.userId, params.eventType);

      this.logger.debug(
        `emit: user=${params.userId} eventType=${params.eventType} mode=${mode} id=${row.id}`,
      );

      if (mode === "instant") {
        await this.queue.add(
          "instant-email",
          { kind: "instant", notificationId: row.id },
          { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
        );
      } else if (mode === "digest") {
        await this.repo.setDigestPending(row.id, true);
      }
    } catch (err) {
      this.logger.error("notifications.emit failed", { err, params });
    }
  }

  async emitMany(userIds: string[], params: Omit<EmitParams, "userId">): Promise<void> {
    await Promise.all(userIds.map((userId) => this.emit({ ...params, userId })));
  }

  private async resolveDeliveryMode(
    userId: string,
    eventType: NotificationEventType,
  ): Promise<NotificationMode> {
    if (SECURITY_EVENTS.has(eventType)) return "instant";
    return this.prefs.getEffectiveMode(userId, eventType);
  }
}
