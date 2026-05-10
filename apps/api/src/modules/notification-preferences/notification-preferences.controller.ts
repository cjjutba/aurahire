import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "@aurahire/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";

import { NotificationPreferencesService } from "./notification-preferences.service";
import { UpsertPreferenceDto } from "./dto/upsert-preference.dto";
import { RestoreDefaultsDto } from "./dto/restore-defaults.dto";
import { AuditService } from "../../audit/audit.service";
import { AUDIT_ACTIONS } from "../../audit/audit.types";

@ApiTags("notification-preferences")
@ApiBearerAuth()
@Controller("notification-preferences")
@Roles("candidate", "recruiter", "admin")
export class NotificationPreferencesController {
  constructor(
    private readonly service: NotificationPreferencesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.listForRole(user.id, user.role);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  async upsert(
    @CurrentUser() user: AuthUser,
    @Body() body: UpsertPreferenceDto,
  ) {
    const previous = await this.service.getEffectiveMode(
      user.id,
      body.eventType,
    );
    const result = await this.service.upsert(user.id, body);
    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.NOTIFICATION_PREFERENCE_UPDATED,
      entityType: "notification_preference",
      entityId: user.id,
      details: {
        eventType: body.eventType,
        oldMode: previous,
        newMode: body.mode,
      },
    });
    return { eventType: result.eventType, mode: result.mode, isDefault: false };
  }

  @Post("restore-defaults")
  @HttpCode(HttpStatus.OK)
  async restoreDefaults(
    @CurrentUser() user: AuthUser,
    @Body() body: RestoreDefaultsDto,
  ) {
    const result = await this.service.restoreDefaults(user.id, body);
    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.NOTIFICATION_PREFERENCES_RESET,
      entityType: "notification_preference",
      entityId: user.id,
      details: { category: body.category, deleted: result.deleted },
    });
    return result;
  }
}
