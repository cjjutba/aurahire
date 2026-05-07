import { forwardRef, Module } from "@nestjs/common";

import { NotificationPreferencesController } from "./notification-preferences.controller";
import { NotificationPreferencesService } from "./notification-preferences.service";
import { NotificationPreferencesRepository } from "./notification-preferences.repository";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuditModule } from "../../audit";

@Module({
  imports: [forwardRef(() => NotificationsModule), AuditModule],
  controllers: [NotificationPreferencesController],
  providers: [NotificationPreferencesService, NotificationPreferencesRepository],
  exports: [NotificationPreferencesService],
})
export class NotificationPreferencesModule {}
