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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import type { AuthUser } from "@aurahire/shared";

import {
  ActiveCompany,
  type ActiveCompanyContext,
} from "../../common/decorators/active-company.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";

import { CheckBiasDto } from "./dto/check-bias.dto";
import { OverrideBiasFlagDto } from "./dto/override-flag.dto";
import {
  BiasFlagEnvelopeDto,
  BiasFlagsListEnvelopeDto,
  CheckBiasResponseDto,
  ScanJobBiasEnvelopeDto,
} from "./dto/bias-response.dto";
import { BiasService } from "./bias.service";

@ApiTags("bias")
@ApiBearerAuth()
@Controller("bias")
export class BiasController {
  constructor(private readonly service: BiasService) {}

  @Post("check")
  @Roles("recruiter", "admin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Stateless bias scan — does NOT persist; used by debounced editor preview",
  })
  @ApiResponse({ status: 200, type: CheckBiasResponseDto })
  @ApiResponse({
    status: 429,
    description: "Rate-limited (max 10 calls/min/user)",
  })
  async check(
    @CurrentUser() user: AuthUser,
    @Body() dto: CheckBiasDto,
  ): Promise<CheckBiasResponseDto> {
    const data = await this.service.check(
      user,
      dto.text,
      dto.customFlaggedTermsOverride,
    );
    return { data };
  }

  @Post("jobs/:jobId/scan")
  @Roles("recruiter")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Run bias scan on a job's persisted description; replaces existing 'flagged' rows",
  })
  @ApiResponse({ status: 200, type: ScanJobBiasEnvelopeDto })
  @ApiResponse({
    status: 404,
    description: "Job not found OR not owned by active company",
  })
  async scanJob(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Param("jobId") jobId: string,
    @Req() req: FastifyRequest,
  ): Promise<ScanJobBiasEnvelopeDto> {
    const data = await this.service.scanJob(
      user,
      activeCompany.companyId,
      jobId,
      this.requestMeta(req),
    );
    return { data };
  }

  @Get("jobs/:jobId/flags")
  @Roles("recruiter", "admin")
  @ApiOperation({ summary: "List persisted bias flags for a job (any status)" })
  @ApiResponse({ status: 200, type: BiasFlagsListEnvelopeDto })
  async listForJob(
    @CurrentUser() user: AuthUser,
    @Req() req: FastifyRequest,
    @Param("jobId") jobId: string,
  ): Promise<BiasFlagsListEnvelopeDto> {
    // Admins reach this with no active company resolved (their `req.activeCompanyId`
    // is undefined). Recruiters always have one (ActiveCompanyGuard ran). Pass
    // null for admins so `listForJob` skips the company-scope check.
    const reqWithCtx = req as FastifyRequest & { activeCompanyId?: string };
    const companyId = reqWithCtx.activeCompanyId ?? null;
    const data = await this.service.listForJob(user, companyId, jobId);
    return { data };
  }

  @Post("jobs/:jobId/flags/:flagId/override")
  @Roles("recruiter")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Override a bias flag with a written reason (≥10 chars); status → overridden",
  })
  @ApiResponse({ status: 200, type: BiasFlagEnvelopeDto })
  @ApiResponse({ status: 400, description: "Flag not in 'flagged' status" })
  @ApiResponse({
    status: 404,
    description: "Job/flag not found OR not owned by active company",
  })
  async override(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Param("jobId") jobId: string,
    @Param("flagId") flagId: string,
    @Body() dto: OverrideBiasFlagDto,
    @Req() req: FastifyRequest,
  ): Promise<BiasFlagEnvelopeDto> {
    const data = await this.service.override(
      user,
      activeCompany.companyId,
      jobId,
      flagId,
      dto.reason,
      this.requestMeta(req),
    );
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
