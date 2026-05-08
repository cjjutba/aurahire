import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";

import { ExpireOffersCron } from "./expire-offers.cron";
import { ArchivePastDeadlineJobsCron } from "./archive-past-deadline-jobs.cron";
import { CleanupUnverifiedAccountsCron } from "./cleanup-unverified-accounts.cron";
import { DigestEmailCron } from "./digest-email.cron";
import { NotificationsRetentionCron } from "./notifications-retention.cron";
import { InterviewReminderCron } from "./interview-reminder.cron";
import { OfferExpiryReminderCron } from "./offer-expiry-reminder.cron";
import { InterviewFeedbackDueCron } from "./interview-feedback-due.cron";
import { InterviewAutocompleteCron } from "./interview-autocomplete.cron";
import { CronAdminController } from "./cron-admin.controller";
import { NotificationsModule } from "../modules/notifications/notifications.module";

@Module({
  imports: [ScheduleModule.forRoot(), NotificationsModule],
  controllers: [CronAdminController],
  providers: [
    ArchivePastDeadlineJobsCron,
    CleanupUnverifiedAccountsCron,
    DigestEmailCron,
    ExpireOffersCron,
    InterviewAutocompleteCron,
    InterviewFeedbackDueCron,
    InterviewReminderCron,
    NotificationsRetentionCron,
    OfferExpiryReminderCron,
  ],
  exports: [
    ArchivePastDeadlineJobsCron,
    CleanupUnverifiedAccountsCron,
    DigestEmailCron,
    ExpireOffersCron,
    InterviewAutocompleteCron,
    InterviewFeedbackDueCron,
    InterviewReminderCron,
    NotificationsRetentionCron,
    OfferExpiryReminderCron,
  ],
})
export class CronModule {}
