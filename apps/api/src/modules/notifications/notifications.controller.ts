import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "@aurahire/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";

import { NotificationsService } from "./notifications.service";
import { ListNotificationsDto } from "./dto/list-notifications.dto";
import { AuditService } from "../../audit/audit.service";
import { AUDIT_ACTIONS } from "../../audit/audit.types";

@ApiTags("notifications")
@ApiBearerAuth()
@Controller("notifications")
@Roles("candidate", "recruiter", "admin")
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListNotificationsDto) {
    return this.service.listForUser(user.id, query);
  }

  @Get("unread-count")
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.service.getUnreadCount(user.id);
  }

  @Post(":id/read")
  @HttpCode(HttpStatus.OK)
  markRead(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.markRead(id, user.id);
  }

  @Post("read-all")
  @HttpCode(HttpStatus.OK)
  async markAllRead(@CurrentUser() user: AuthUser) {
    const result = await this.service.markAllRead(user.id);
    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.NOTIFICATIONS_MARKED_ALL_READ,
      entityType: "notifications",
      entityId: user.id,
      details: {},
    });
    return result;
  }

  /**
   * Archive a single notification — popover-aligned vocabulary. The DB
   * column is `dismissed_at`; the realtime event is `notification.archived`.
   * Writes an audit row mirroring the {@link markAllRead} pattern.
   */
  @Patch(":id/archive")
  @HttpCode(HttpStatus.OK)
  async archive(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const result = await this.service.archive(id, user.id);
    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.NOTIFICATION_ARCHIVED,
      entityType: "notification",
      entityId: id,
      details: {},
    });
    return result;
  }

  /**
   * Archive every undismissed notification for the user. Drops unread
   * count to zero in one round-trip and emits a single realtime event so
   * all open surfaces clear the inbox at once.
   */
  @Post("archive-all")
  @HttpCode(HttpStatus.OK)
  async archiveAll(@CurrentUser() user: AuthUser) {
    const result = await this.service.archiveAll(user.id);
    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.NOTIFICATIONS_ARCHIVED_ALL,
      entityType: "notifications",
      entityId: user.id,
      details: {},
    });
    return result;
  }

  /**
   * @deprecated Use `PATCH /notifications/:id/archive` instead. Kept for
   * back-compat while older callers migrate; service-side this is a thin
   * alias for {@link archive} and emits the same realtime event.
   */
  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  dismiss(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.dismiss(id, user.id);
  }
}
