import {
  Controller,
  Get,
  Post,
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

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  dismiss(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.dismiss(id, user.id);
  }
}
