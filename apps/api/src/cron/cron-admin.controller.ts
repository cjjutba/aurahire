import {
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { Roles } from "../common/decorators/roles.decorator";

import { ExpireOffersCron } from "./expire-offers.cron";
import { ArchivePastDeadlineJobsCron } from "./archive-past-deadline-jobs.cron";
import { CleanupUnverifiedAccountsCron } from "./cleanup-unverified-accounts.cron";

interface CronRunResultDto {
  data: { affectedRows: number; durationMs: number };
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
  ) {}

  @Post("run/:cronName")
  @Roles("admin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "DEV ONLY: manually trigger a named cron service. Returns 403 in production. Cron names: expire-offers, archive-jobs, cleanup-unverified.",
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

    let result: { affectedRows: number; durationMs: number };
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
      default:
        throw new NotFoundException({
          code: "UNKNOWN_CRON",
          message: `Unknown cron name: ${cronName}`,
          available: ["expire-offers", "archive-jobs", "cleanup-unverified"],
        });
    }

    return { data: result };
  }
}
