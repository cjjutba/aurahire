import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import type { AuthUser } from "@aurahire/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ProfilesService } from "../profiles/profiles.service";
import { ProfileResponseEnvelopeDto } from "../profiles/dto/profile-response.dto";
import { InitCandidateProfileDto } from "../profiles/dto/init-candidate-profile.dto";
import { InitRecruiterProfileDto } from "../profiles/dto/init-recruiter-profile.dto";

@ApiTags("auth")
@ApiBearerAuth()
@Controller("auth")
export class AuthController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Post("register-candidate")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Initialize a candidate profile after Supabase signUp",
    description:
      "Frontend calls this AFTER supabase.auth.signUp() succeeds. The JWT identifies the new user; this endpoint creates profiles + candidate_profiles rows.",
  })
  @ApiResponse({ status: 201, type: ProfileResponseEnvelopeDto })
  @ApiResponse({ status: 401, description: "Missing or invalid token" })
  @ApiResponse({ status: 409, description: "Profile already exists for this user" })
  async registerCandidate(
    @CurrentUser() user: AuthUser,
    @Body() dto: InitCandidateProfileDto,
    @Req() req: FastifyRequest,
  ): Promise<ProfileResponseEnvelopeDto> {
    const data = await this.profilesService.initCandidateProfile(
      user.id,
      user.email,
      dto,
      {
        ipAddress: req.ip ?? null,
        userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
      },
    );
    return { data };
  }

  @Post("register-recruiter")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Initialize a recruiter profile + company after Supabase signUp",
    description:
      "Frontend calls this AFTER supabase.auth.signUp() succeeds. Creates profiles + recruiter_profiles + companies rows in a single transaction.",
  })
  @ApiResponse({ status: 201, type: ProfileResponseEnvelopeDto })
  @ApiResponse({ status: 401, description: "Missing or invalid token" })
  @ApiResponse({ status: 409, description: "Profile already exists for this user" })
  async registerRecruiter(
    @CurrentUser() user: AuthUser,
    @Body() dto: InitRecruiterProfileDto,
    @Req() req: FastifyRequest,
  ): Promise<ProfileResponseEnvelopeDto> {
    const data = await this.profilesService.initRecruiterProfile(
      user.id,
      user.email,
      dto,
      {
        ipAddress: req.ip ?? null,
        userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
      },
    );
    return { data };
  }
}
