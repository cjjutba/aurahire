import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import type { AuthUser, FeedbackStatus } from "@aurahire/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";

import { ListFeedbackQueryDto } from "./dto/list-feedback-query.dto";
import { UpdateFeedbackDto } from "./dto/update-feedback.dto";
import {
  FeedbackEnvelopeDto,
  FeedbackListEnvelopeDto,
} from "./dto/feedback-response.dto";
import { FeedbackService } from "./feedback.service";

interface StatusCountsEnvelope {
  data: Record<FeedbackStatus, number>;
}

@ApiTags("admin-feedback")
@ApiBearerAuth()
@Controller("admin/feedback")
export class AdminFeedbackController {
  constructor(private readonly service: FeedbackService) {}

  @Get()
  @Roles("admin")
  @ApiOperation({ summary: "List feedback (filterable + paginated)" })
  @ApiResponse({ status: 200, type: FeedbackListEnvelopeDto })
  async list(
    @Query() query: ListFeedbackQueryDto,
  ): Promise<FeedbackListEnvelopeDto> {
    return this.service.listForAdmin(query);
  }

  @Get("status-counts")
  @Roles("admin")
  @ApiOperation({
    summary: "Get count of feedback rows by status (for header badges)",
  })
  @ApiResponse({ status: 200 })
  async statusCounts(): Promise<StatusCountsEnvelope> {
    return { data: await this.service.statusCounts() };
  }

  @Get(":id")
  @Roles("admin")
  @ApiOperation({ summary: "Get a single feedback entry with full message" })
  @ApiResponse({ status: 200, type: FeedbackEnvelopeDto })
  async getById(@Param("id") id: string): Promise<FeedbackEnvelopeDto> {
    return this.service.getByIdForAdmin(id);
  }

  @Patch(":id")
  @Roles("admin")
  @ApiOperation({
    summary: "Update feedback status and/or admin note",
    description:
      "Sets resolvedAt + resolvedBy when status moves to 'resolved' or 'dismissed'; clears them on revert.",
  })
  @ApiResponse({ status: 200, type: FeedbackEnvelopeDto })
  async update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateFeedbackDto,
    @Req() req: FastifyRequest,
  ): Promise<FeedbackEnvelopeDto> {
    return this.service.updateForAdmin(user, id, dto, {
      ipAddress: req.ip ?? null,
      userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
    });
  }
}
