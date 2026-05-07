import {
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
import { Throttle } from "@nestjs/throttler";
import type { FastifyRequest } from "fastify";
import type { AuthUser } from "@aurahire/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";

import { ProfileScoreEnvelopeDto } from "./dto/profile-score-response.dto";
import {
  MatchScorePreviewEnvelopeDto,
  MatchScorePreviewListEnvelopeDto,
} from "./dto/match-preview-response.dto";
import { ScoringService } from "./scoring.service";

@ApiTags("scoring")
@ApiBearerAuth()
@Controller("scoring")
export class ScoringController {
  constructor(private readonly service: ScoringService) {}

  @Post("profile/compute")
  @Roles("candidate")
  @Throttle({ profileCompute: { limit: 1, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Compute the candidate's Profile Score from default resume + preferences",
    description:
      "Triggers a fresh AI scoring run. Rate-limited at TWO layers: ThrottlerGuard (1/60s per IP) + a per-user manual check on profile_scores.created_at (1/60s per user). Both layers are intentional — defense in depth. Cost: ~$0.001 per call. Inserts a new row in profile_scores; existing scores are preserved as history.",
  })
  @ApiResponse({ status: 201, description: "Score computed", type: ProfileScoreEnvelopeDto })
  @ApiResponse({ status: 400, description: "Missing prerequisite (resume, parse, or preferences)" })
  @ApiResponse({ status: 429, description: "Rate-limited; try again in a minute" })
  @ApiResponse({ status: 503, description: "AI service temporarily unavailable" })
  async computeProfileScore(
    @CurrentUser() user: AuthUser,
    @Req() req: FastifyRequest,
  ): Promise<ProfileScoreEnvelopeDto> {
    const data = await this.service.computeProfileScore(user, this.requestMeta(req));
    return { data };
  }

  @Get("profile/me")
  @Roles("candidate")
  @ApiOperation({
    summary: "Get the candidate's most recent Profile Score (or null if none)",
  })
  @ApiResponse({ status: 200, type: ProfileScoreEnvelopeDto })
  async getProfileScoreMe(
    @CurrentUser() user: AuthUser,
  ): Promise<ProfileScoreEnvelopeDto> {
    const data = await this.service.getProfileScoreMe(user);
    return { data };
  }

  // ─────────────────────────────────────────────────────────────────────
  // MATCH-SCORE PREVIEWS — pre-application "See my match" + recommendations
  // ─────────────────────────────────────────────────────────────────────

  @Post("match-preview/:jobId")
  @Roles("candidate")
  @Throttle({ matchPreview: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Compute or fetch a match preview for the candidate against this job",
    description:
      "Idempotent per (candidate, job, current default resume). Returns the cached preview if one already exists for this resume version. Rate-limited to 5/60s per IP. Cost: ~$0.001 per fresh compute.",
  })
  @ApiResponse({ status: 201, type: MatchScorePreviewEnvelopeDto })
  @ApiResponse({ status: 400, description: "Missing prerequisite (resume, parse, or job)" })
  @ApiResponse({ status: 429, description: "Rate-limited; try again in a minute" })
  async computeMatchPreview(
    @CurrentUser() user: AuthUser,
    @Param("jobId") jobId: string,
  ): Promise<MatchScorePreviewEnvelopeDto> {
    const data = await this.service.computeMatchPreview(user, jobId, {
      source: "candidate",
    });
    return { data };
  }

  @Get("match-preview/:jobId")
  @Roles("candidate")
  @ApiOperation({
    summary: "Read-only fetch of an existing match preview for this job",
  })
  @ApiResponse({ status: 200, type: MatchScorePreviewEnvelopeDto })
  async getMatchPreview(
    @CurrentUser() user: AuthUser,
    @Param("jobId") jobId: string,
  ): Promise<MatchScorePreviewEnvelopeDto> {
    const data = await this.service.getMatchPreviewByJob(user, jobId);
    return { data };
  }

  @Get("match-previews")
  @Roles("candidate")
  @ApiOperation({
    summary:
      "List the candidate's match previews ordered by score — drives the Recommended-for-you feed",
  })
  @ApiResponse({ status: 200, type: MatchScorePreviewListEnvelopeDto })
  async listMatchPreviews(
    @CurrentUser() user: AuthUser,
  ): Promise<MatchScorePreviewListEnvelopeDto> {
    const data = await this.service.listMatchPreviewsForCandidate(user, 25);
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
