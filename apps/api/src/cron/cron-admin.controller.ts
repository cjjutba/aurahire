import {
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { Roles } from "../common/decorators/roles.decorator";

import { ExpireOffersCron } from "./expire-offers.cron";
import { ArchivePastDeadlineJobsCron } from "./archive-past-deadline-jobs.cron";
import { CleanupUnverifiedAccountsCron } from "./cleanup-unverified-accounts.cron";
import { DigestEmailCron } from "./digest-email.cron";
import { NotificationsRetentionCron } from "./notifications-retention.cron";
import { InterviewReminderCron } from "./interview-reminder.cron";
import { OfferExpiryReminderCron } from "./offer-expiry-reminder.cron";
import { InterviewAutocompleteCron } from "./interview-autocomplete.cron";
import { InterviewStartCron } from "./interview-start.cron";
import { InterviewFeedbackDueCron } from "./interview-feedback-due.cron";

interface CronRunResultDto {
  data: Record<string, unknown>;
}

/**
 * DEV-ONLY: manually trigger a named cron service so the human can verify
 * behavior without waiting for the scheduled time. Disabled in production via
 * a NODE_ENV guard inside the handler.
 */
@ApiTags("admin-cron-debug")
@ApiBearerAuth()
@Controller("admin/cron")
export class CronAdminController {
  constructor(
    private readonly expireOffers: ExpireOffersCron,
    private readonly archiveJobs: ArchivePastDeadlineJobsCron,
    private readonly cleanupUnverified: CleanupUnverifiedAccountsCron,
    private readonly digestEmail: DigestEmailCron,
    private readonly interviewAutocomplete: InterviewAutocompleteCron,
    private readonly interviewStart: InterviewStartCron,
    private readonly notificationsRetention: NotificationsRetentionCron,
    private readonly interviewReminder: InterviewReminderCron,
    private readonly offerExpiryReminder: OfferExpiryReminderCron,
    private readonly interviewFeedbackDue: InterviewFeedbackDueCron,
  ) {}

  @Post("run/:cronName")
  @Roles("admin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "DEV ONLY: manually trigger a named cron service. Returns 403 in production. Cron names: expire-offers, archive-jobs, cleanup-unverified, digest-email, interview-autocomplete, interview-start, notifications-retention, interview-reminder, offer-expiry-reminder, interview-feedback-due.",
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: "Disabled in production" })
  @ApiResponse({ status: 404, description: "Unknown cron name" })
  async run(@Param("cronName") cronName: string): Promise<CronRunResultDto> {
    if (process.env.NODE_ENV === "production") {
      throw new ForbiddenException({
        code: "DISABLED_IN_PROD",
        message: "Manual cron triggers are disabled in production",
      });
    }

    let result: Record<string, unknown>;
    switch (cronName) {
      case "expire-offers":
        result = await this.expireOffers.execute();
        break;
      case "archive-jobs":
      case "archive-past-deadline-jobs":
        result = await this.archiveJobs.execute();
        break;
      case "cleanup-unverified":
      case "cleanup-unverified-accounts":
        result = await this.cleanupUnverified.execute();
        break;
      case "digest-email":
        result = await this.digestEmail.execute();
        break;
      case "notifications-retention":
        result = await this.notificationsRetention.execute();
        break;
      case "interview-reminder":
        result = await this.interviewReminder.execute();
        break;
      case "offer-expiry-reminder":
        result = await this.offerExpiryReminder.execute();
        break;
      case "interview-autocomplete":
        result = await this.interviewAutocomplete.execute();
        break;
      case "interview-start":
        result = await this.interviewStart.execute();
        break;
      case "interview-feedback-due":
        result = await this.interviewFeedbackDue.execute();
        break;
      default:
        throw new NotFoundException({
          code: "UNKNOWN_CRON",
          message: `Unknown cron name: ${cronName}`,
          available: [
            "expire-offers",
            "archive-jobs",
            "cleanup-unverified",
            "digest-email",
            "interview-autocomplete",
            "interview-start",
            "notifications-retention",
            "interview-reminder",
            "offer-expiry-reminder",
            "interview-feedback-due",
          ],
        });
    }

    return { data: result };
  }
}
