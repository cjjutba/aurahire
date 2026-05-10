import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
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

import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";

import { UpdateScoringConfigDto } from "../dto/update-scoring-config.dto";
import { PreviewImpactDto } from "../dto/preview-impact.dto";
import {
  PreviewImpactEnvelopeDto,
  ScoringConfigEnvelopeDto,
} from "../dto/scoring-config-response.dto";
import { AdminConfigService } from "../services/admin-config.service";

@ApiTags("admin-config")
@ApiBearerAuth()
@Controller("admin/scoring-config")
export class AdminConfigController {
  constructor(private readonly service: AdminConfigService) {}

  @Get()
  @Roles("admin")
  @ApiOperation({ summary: "Get the active scoring configuration" })
  @ApiResponse({ status: 200, type: ScoringConfigEnvelopeDto })
  async getActive(): Promise<ScoringConfigEnvelopeDto> {
    const data = await this.service.getActive();
    return { data };
  }

  @Patch()
  @Roles("admin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Update the active scoring configuration (in-place); audits the diff",
  })
  @ApiResponse({ status: 200, type: ScoringConfigEnvelopeDto })
  @ApiResponse({
    status: 400,
    description: "Validation failed (sums, band order, locked fields)",
  })
  async update(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateScoringConfigDto,
    @Req() req: FastifyRequest,
  ): Promise<ScoringConfigEnvelopeDto> {
    const data = await this.service.update(user, dto, this.requestMeta(req));
    return { data };
  }

  @Post("preview-impact")
  @Roles("admin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Re-weight the last N match scores using proposed weights/thresholds; pure arithmetic, no AI calls",
  })
  @ApiResponse({ status: 200, type: PreviewImpactEnvelopeDto })
  async previewImpact(
    @Body() dto: PreviewImpactDto,
  ): Promise<PreviewImpactEnvelopeDto> {
    const data = await this.service.previewImpact(dto);
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
