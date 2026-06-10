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
import {
  NOTIFICATION_EMAIL_QUEUE,
  type NotificationEmailJobData,
} from "./queues";
import { SECURITY_EVENTS } from "./event-defaults";
import { buildTitle, buildBody, buildLink } from "./templates";
import { ProfilesRepository } from "../profiles/profiles.repository";
import { EventsService } from "../../realtime";

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
    private readonly events: EventsService,
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

      // Realtime: broadcast `notification.created` to the user's room so
      // the navbar badge increments and the popover prepends the new row
      // without polling. Compute unreadCount AFTER the insert so the bell
      // count reflects this notification.
      const unreadCount = await this.repo.countUnread(params.userId);
      this.events.emitNotificationCreated({
        id: row.id,
        userId: row.userId,
        kind: row.eventType,
        title: row.title,
        bodyExcerpt: (row.body ?? "").slice(0, 200),
        linkUrl: row.link,
        createdAt: row.createdAt.toISOString(),
        unreadCount,
      });

      const mode = await this.resolveDeliveryMode(
        params.userId,
        params.eventType,
      );

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

  async emitMany(
    userIds: string[],
    params: Omit<EmitParams, "userId">,
  ): Promise<void> {
    await Promise.all(
      userIds.map((userId) => this.emit({ ...params, userId })),
    );
  }

  private async resolveDeliveryMode(
    userId: string,
    eventType: NotificationEventType,
  ): Promise<NotificationMode> {
    if (SECURITY_EVENTS.has(eventType)) return "instant";
    return this.prefs.getEffectiveMode(userId, eventType);
  }

  async listForUser(
    userId: string,
    query: { tab: "inbox" | "archive"; limit: number; cursor?: string },
  ) {
    const result = await this.repo.listForUser(userId, query);
    return {
      items: result.items.map((row) => ({
        id: row.id,
        eventType: row.eventType,
        scope: row.scope,
        title: row.title,
        body: row.body,
        link: row.link,
        entityType: row.entityType,
        entityId: row.entityId,
        actorId: row.actorId,
        metadata: row.metadata,
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: result.nextCursor,
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.repo.countUnread(userId);
    return { count, displayCount: count > 99 ? "99+" : String(count) };
  }

  async markRead(id: string, userId: string) {
    const { unreadCount } = await this.repo.markRead(id, userId);
    // Realtime: notify other tabs/devices of this same user so all open
    // surfaces collapse the unread state for `id` and refresh the bell.
    this.events.emitNotificationRead(userId, { id, unreadCount });
    return {
      unreadCount,
      count: unreadCount,
      displayCount: unreadCount > 99 ? "99+" : String(unreadCount),
    };
  }

  async markAllRead(userId: string) {
    await this.repo.markAllRead(userId);
    return { unreadCount: 0, count: 0, displayCount: "0" };
  }

  /**
   * Archive a single notification - popover vocabulary. The DB column is
   * `dismissed_at`; the realtime event is `notification.archived`. Also
   * marks unread rows as read on archive (handled in the repository) so
   * we never strand "unread but hidden" rows.
   */
  async archive(id: string, userId: string) {
    const { unreadCount } = await this.repo.archive(id, userId);
    this.events.emitNotificationArchived(userId, { id, unreadCount });
    return {
      unreadCount,
      count: unreadCount,
      displayCount: unreadCount > 99 ? "99+" : String(unreadCount),
    };
  }

  /**
   * Backward-compatible alias for {@link archive}. The popover and the
   * frontend client speak "archive"; older call sites speak "dismiss".
   * Forward to keep one source of truth + one realtime event name.
   */
  async dismiss(id: string, userId: string) {
    return this.archive(id, userId);
  }

  /**
   * Archive every undismissed notification for the user. Drops unread
   * count to zero and emits `notification.archive_all` so all open
   * surfaces clear the inbox in one shot.
   */
  async archiveAll(userId: string) {
    await this.repo.archiveAllForUser(userId);
    this.events.emitNotificationArchiveAll(userId, { unreadCount: 0 });
    return { unreadCount: 0, count: 0, displayCount: "0" };
  }
}
