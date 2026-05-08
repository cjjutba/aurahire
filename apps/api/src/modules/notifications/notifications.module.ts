import { forwardRef, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";

import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationEmailProcessor } from "./notification-email.processor";
import { NotificationsScheduler } from "./notifications.scheduler";
import { NOTIFICATION_EMAIL_QUEUE } from "./queues";
import { NotificationPreferencesModule } from "../notification-preferences/notification-preferences.module";
import { ProfilesModule } from "../profiles/profiles.module";
import { EmailModule } from "../../email";
import { AuditModule } from "../../audit";

@Module({
  imports: [
    BullModule.registerQueue({ name: NOTIFICATION_EMAIL_QUEUE }),
    forwardRef(() => NotificationPreferencesModule),
    ProfilesModule,
    EmailModule,
    AuditModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationEmailProcessor,
    NotificationsScheduler,
  ],
  exports: [BullModule, NotificationsService, NotificationsRepository, NotificationsScheduler],
})
export class NotificationsModule {}
