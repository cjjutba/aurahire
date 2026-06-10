import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
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

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";

import { UpdateCandidatePersonalDto } from "./dto/personal.dto";
import { UpdateCandidatePreferencesDto } from "./dto/preferences.dto";
import { CandidateProfileEnvelopeDto } from "./dto/candidate-profile-response.dto";
import { CompleteOnboardingEnvelopeDto } from "./dto/complete-onboarding-response.dto";
import { OnboardingSkippedAnalyzingDto } from "./dto/onboarding-skipped.dto";
import { CandidateProfilesService } from "./candidate-profiles.service";

@ApiTags("candidate-profiles")
@ApiBearerAuth()
@Controller("candidate-profiles")
export class CandidateProfilesController {
  private readonly logger = new Logger(CandidateProfilesController.name);

  constructor(private readonly service: CandidateProfilesService) {}

  @Get("me")
  @Roles("candidate")
  @ApiOperation({ summary: "Get the authenticated candidate's full profile" })
  @ApiResponse({ status: 200, type: CandidateProfileEnvelopeDto })
  async getMe(
    @CurrentUser() user: AuthUser,
  ): Promise<CandidateProfileEnvelopeDto> {
    const data = await this.service.getMe(user);

    // Phase 1 Task 12 - backfill guard. Legacy candidates (completed
    // onboarding before the proactive-system rollout) may have
    // profile_completed=true but no profile_scores row. Fire and forget
    // an idempotent backfill enqueue so their score eventually appears
    // without trapping the dashboard response on a queue/db hiccup.
    void this.service.enqueueProfileScoreIfMissing(user.id).catch((err) => {
      this.logger.warn(
        `enqueueProfileScoreIfMissing failed for ${user.id}: ${(err as Error).message}`,
      );
    });

    return { data };
  }

  @Patch("personal")
  @HttpCode(HttpStatus.OK)
  @Roles("candidate")
  @ApiOperation({
    summary:
      "Onboarding step 2: personal info (name, phone, location, headline)",
  })
  @ApiResponse({ status: 200, type: CandidateProfileEnvelopeDto })
  async updatePersonal(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCandidatePersonalDto,
    @Req() req: FastifyRequest,
  ): Promise<CandidateProfileEnvelopeDto> {
    const data = await this.service.updatePersonal(
      user,
      dto,
      this.requestMeta(req),
    );
    return { data };
  }

  @Patch("preferences")
  @HttpCode(HttpStatus.OK)
  @Roles("candidate")
  @ApiOperation({ summary: "Onboarding step 6: job preferences" })
  @ApiResponse({ status: 200, type: CandidateProfileEnvelopeDto })
  async updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCandidatePreferencesDto,
    @Req() req: FastifyRequest,
  ): Promise<CandidateProfileEnvelopeDto> {
    const data = await this.service.updatePreferences(
      user,
      dto,
      this.requestMeta(req),
    );
    return { data };
  }

  @Post("complete")
  @HttpCode(HttpStatus.OK)
  @Roles("candidate")
  @ApiOperation({
    summary: "Mark candidate onboarding complete (sets profile_completed=true)",
    description: "Called by the wizard's final-step submit. Idempotent.",
  })
  @ApiResponse({ status: 200, type: CandidateProfileEnvelopeDto })
  async complete(
    @CurrentUser() user: AuthUser,
    @Req() req: FastifyRequest,
  ): Promise<CandidateProfileEnvelopeDto> {
    const data = await this.service.complete(user, this.requestMeta(req));
    return { data };
  }

  @Patch("me/complete-onboarding")
  @HttpCode(HttpStatus.OK)
  @Roles("candidate")
  @ApiOperation({
    summary: "Complete onboarding (sets profile_completed = true)",
    description:
      "Validates per-step onboarding minimums (personal name, at least one experience/education/3 skills, desired roles), marks the profile complete, then synchronously runs the Profile Score compute and enqueues the match-preview precompute job. Returns the score + the precompute job id so the analyzing screen can hand off to the dashboard with a populated stat. AI failures are surfaced in `errors.profileScore` rather than as HTTP errors - the candidate is never trapped in onboarding limbo.",
  })
  @ApiResponse({ status: 200, type: CompleteOnboardingEnvelopeDto })
  async completeOnboarding(
    @CurrentUser() user: AuthUser,
    @Req() req: FastifyRequest,
  ): Promise<CompleteOnboardingEnvelopeDto> {
    const data = await this.service.completeOnboarding(
      user,
      this.requestMeta(req),
    );
    return { data };
  }

  @Post("me/onboarding/skipped-analyzing")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("candidate")
  @ApiOperation({
    summary: "Record that the candidate skipped the analyzing screen",
    description:
      "Pure telemetry. Writes an audit row capturing whether the Profile Score had landed and how many match-preview events had streamed in by the time of the skip. Returns 204.",
  })
  @ApiResponse({ status: 204, description: "Skip recorded" })
  async recordOnboardingSkipped(
    @CurrentUser() user: AuthUser,
    @Body() dto: OnboardingSkippedAnalyzingDto,
    @Req() req: FastifyRequest,
  ): Promise<void> {
    await this.service.recordOnboardingSkipped(
      user,
      { scoreReady: dto.scoreReady, previewsReady: dto.previewsReady },
      this.requestMeta(req),
    );
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
