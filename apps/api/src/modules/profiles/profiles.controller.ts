import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
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
import { SkipActiveCompany } from "../../common/decorators/skip-active-company.decorator";

import { MembershipsListEnvelopeDto } from "./dto/membership-response.dto";
import { ProfileResponseEnvelopeDto } from "./dto/profile-response.dto";
import { UpdateMyProfileDto } from "./dto/update-my-profile.dto";
import { ProfilesService } from "./profiles.service";

@ApiTags("profiles")
@ApiBearerAuth()
@Controller("profiles")
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get("me")
  @SkipActiveCompany()
  @ApiOperation({
    summary: "Get the current user's profile + role-specific subprofile",
  })
  @ApiResponse({ status: 200, type: ProfileResponseEnvelopeDto })
  @ApiResponse({ status: 401, description: "Missing or invalid token" })
  @ApiResponse({ status: 404, description: "Profile not yet initialized" })
  async getMe(
    @CurrentUser() user: AuthUser,
  ): Promise<ProfileResponseEnvelopeDto> {
    const data = await this.profilesService.getMe(user);
    return { data };
  }

  @Get("me/memberships")
  @SkipActiveCompany()
  @ApiOperation({
    summary:
      "List the caller's active company memberships (used by the sidebar switcher)",
  })
  @ApiResponse({ status: 200, type: MembershipsListEnvelopeDto })
  async getMyMemberships(
    @CurrentUser() user: AuthUser,
  ): Promise<MembershipsListEnvelopeDto> {
    const data = await this.profilesService.getMyMemberships(user);
    return { data };
  }

  @Patch("me")
  @SkipActiveCompany()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Phase 2b: only `lastActiveCompanyId` is editable here; full profile editing lands in Phase 5.",
  })
  @ApiResponse({ status: 200, type: ProfileResponseEnvelopeDto })
  @ApiResponse({
    status: 400,
    description: "Not a member of the target company",
  })
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMyProfileDto,
    @Req() req: FastifyRequest,
  ): Promise<ProfileResponseEnvelopeDto> {
    const data = await this.profilesService.updateMyProfile(
      user,
      dto,
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
