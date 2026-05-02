import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import type { AuthUser } from "@aurahire/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";

import { UpdateRecruiterAboutDto } from "./dto/about.dto";
import { UpdateRecruiterCompanyDto } from "./dto/company.dto";
import { UpdateRecruiterFocusDto } from "./dto/focus.dto";
import { RecruiterProfileEnvelopeDto } from "./dto/recruiter-profile-response.dto";
import { RecruiterProfilesService } from "./recruiter-profiles.service";

@ApiTags("recruiter-profiles")
@ApiBearerAuth()
@Controller("recruiter-profiles")
export class RecruiterProfilesController {
  constructor(private readonly service: RecruiterProfilesService) {}

  @Get("me")
  @Roles("recruiter")
  @ApiOperation({ summary: "Get the authenticated recruiter's full profile + company" })
  @ApiResponse({ status: 200, type: RecruiterProfileEnvelopeDto })
  @ApiResponse({ status: 403, description: "Not a recruiter" })
  async getMe(@CurrentUser() user: AuthUser): Promise<RecruiterProfileEnvelopeDto> {
    const data = await this.service.getMe(user);
    return { data };
  }

  @Patch("about")
  @HttpCode(HttpStatus.OK)
  @Roles("recruiter")
  @ApiOperation({ summary: "Onboarding step 1: about you" })
  @ApiResponse({ status: 200, type: RecruiterProfileEnvelopeDto })
  async updateAbout(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateRecruiterAboutDto,
    @Req() req: FastifyRequest,
  ): Promise<RecruiterProfileEnvelopeDto> {
    const data = await this.service.updateAbout(user, dto, this.requestMeta(req));
    return { data };
  }

  @Patch("company")
  @HttpCode(HttpStatus.OK)
  @Roles("recruiter")
  @ApiOperation({ summary: "Onboarding step 2: company details" })
  @ApiResponse({ status: 200, type: RecruiterProfileEnvelopeDto })
  async updateCompany(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateRecruiterCompanyDto,
    @Req() req: FastifyRequest,
  ): Promise<RecruiterProfileEnvelopeDto> {
    const data = await this.service.updateCompany(user, dto, this.requestMeta(req));
    return { data };
  }

  @Patch("focus")
  @HttpCode(HttpStatus.OK)
  @Roles("recruiter")
  @ApiOperation({
    summary: "Onboarding step 3 (final): hiring focus — flips profile_completed=true",
  })
  @ApiResponse({ status: 200, type: RecruiterProfileEnvelopeDto })
  async updateFocus(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateRecruiterFocusDto,
    @Req() req: FastifyRequest,
  ): Promise<RecruiterProfileEnvelopeDto> {
    const data = await this.service.updateFocus(user, dto, this.requestMeta(req));
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
