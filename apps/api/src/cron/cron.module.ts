import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";

import { ExpireOffersCron } from "./expire-offers.cron";
import { ArchivePastDeadlineJobsCron } from "./archive-past-deadline-jobs.cron";
import { CleanupUnverifiedAccountsCron } from "./cleanup-unverified-accounts.cron";
import { CronAdminController } from "./cron-admin.controller";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [CronAdminController],
  providers: [
    ExpireOffersCron,
    ArchivePastDeadlineJobsCron,
    CleanupUnverifiedAccountsCron,
  ],
  exports: [
    ExpireOffersCron,
    ArchivePastDeadlineJobsCron,
    CleanupUnverifiedAccountsCron,
  ],
})
export class CronModule {}
