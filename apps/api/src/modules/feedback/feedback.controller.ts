import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import type { AuthUser } from "@aurahire/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";

import { CreateFeedbackDto } from "./dto/create-feedback.dto";
import { FeedbackEnvelopeDto } from "./dto/feedback-response.dto";
import { FeedbackService } from "./feedback.service";

@ApiTags("feedback")
@ApiBearerAuth()
@Controller("feedback")
export class FeedbackController {
  constructor(private readonly service: FeedbackService) {}

  @Post()
  @Roles("candidate", "recruiter", "admin")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Submit in-app feedback (any signed-in user).",
    description:
      "Captures type, optional severity (bug only), subject, message, plus auto-context (page URL, user agent, app version). Surfaces in /admin/feedback.",
  })
  @ApiResponse({ status: 201, type: FeedbackEnvelopeDto })
  async submit(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateFeedbackDto,
    @Req() req: FastifyRequest,
  ): Promise<FeedbackEnvelopeDto> {
    const reqWithCtx = req as FastifyRequest & { activeCompanyId?: string };
    const activeCompanyId = reqWithCtx.activeCompanyId ?? null;
    return this.service.submit(user, activeCompanyId, dto, {
      ipAddress: req.ip ?? null,
      userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
    });
  }
}
