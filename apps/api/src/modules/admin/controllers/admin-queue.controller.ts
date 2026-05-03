import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import type { AuthUser } from "@aurahire/shared";

import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";

import { EnqueueRescoreBatchDto } from "../dto/enqueue-rescore.dto";
import {
  EnqueueRescoreBatchResponseDto,
  QueueJobStatusResponseDto,
} from "../dto/queue-job-status-response.dto";
import { AdminQueueService } from "../services/admin-queue.service";

@ApiTags("admin-queue")
@ApiBearerAuth()
@Controller("admin/queue")
export class AdminQueueController {
  constructor(private readonly service: AdminQueueService) {}

  @Post("rescore-batch")
  @Roles("admin")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      "Enqueue a rescore-batch background job that recomputes the last N match scores using current weights",
  })
  @ApiResponse({ status: 202, type: EnqueueRescoreBatchResponseDto })
  async enqueueRescoreBatch(
    @CurrentUser() user: AuthUser,
    @Body() dto: EnqueueRescoreBatchDto,
    @Req() req: FastifyRequest,
  ): Promise<EnqueueRescoreBatchResponseDto> {
    const data = await this.service.enqueueRescoreBatch(user, dto, this.requestMeta(req));
    return { data };
  }

  @Get("jobs/:queueJobId/status")
  @Roles("admin")
  @ApiOperation({
    summary:
      "Poll the status of a queued background job. Route is /admin/queue/jobs/:queueJobId/status to avoid collision with /admin/jobs/:id (3.1 job moderation).",
  })
  @ApiResponse({ status: 200, type: QueueJobStatusResponseDto })
  async getJobStatus(@Param("queueJobId") queueJobId: string): Promise<QueueJobStatusResponseDto> {
    const data = await this.service.getJobStatus(queueJobId);
    return { data };
  }

  private requestMeta(req: FastifyRequest): {
    ipAddress: string | null;
    userAgent: string | null;
  } {
    return {
      ipAddress: req.ip ?? null,
      userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
    };
  }
}
