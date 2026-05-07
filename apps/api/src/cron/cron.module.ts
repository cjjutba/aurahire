import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";

import { ExpireOffersCron } from "./expire-offers.cron";
import { ArchivePastDeadlineJobsCron } from "./archive-past-deadline-jobs.cron";
import { CleanupUnverifiedAccountsCron } from "./cleanup-unverified-accounts.cron";
import { DigestEmailCron } from "./digest-email.cron";
import { NotificationsRetentionCron } from "./notifications-retention.cron";
import { CronAdminController } from "./cron-admin.controller";
import { NotificationsModule } from "../modules/notifications/notifications.module";

@Module({
  imports: [ScheduleModule.forRoot(), NotificationsModule],
  controllers: [CronAdminController],
  providers: [
    ExpireOffersCron,
    ArchivePastDeadlineJobsCron,
    CleanupUnverifiedAccountsCron,
    DigestEmailCron,
    NotificationsRetentionCron,
  ],
  exports: [
    ExpireOffersCron,
    ArchivePastDeadlineJobsCron,
    CleanupUnverifiedAccountsCron,
    DigestEmailCron,
    NotificationsRetentionCron,
  ],
})
export class CronModule {}
