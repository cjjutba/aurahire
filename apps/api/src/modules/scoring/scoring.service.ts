import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  type AuthUser,
  type ParsedResume,
  type ProfileScore as ProfileScoreOutput,
  type MatchScore as MatchScoreOutput,
} from "@aurahire/shared";
import type { ProfileScore as DbProfileScore } from "@aurahire/db";

import { AuditService } from "../../audit";
import { ScoreProfileService } from "../../ai/score-profile.service";
import { ScoreMatchService } from "../../ai/score-match.service";
import { ProfilesRepository } from "../profiles/profiles.repository";
import { ResumesRepository } from "../resumes/resumes.repository";
import { ScoringRepository } from "./scoring.repository";
import type {
  ProfileScoreDto,
  ScoreEvidenceDto,
} from "./dto/profile-score-response.dto";
import type {
  MatchScoreDto,
  MatchComponentDto,
  MatchEvidenceDto,
} from "../applications/dto/application-response.dto";

interface ProfileWeights {
  completeness: number;
  skill_depth: number;
  experience_clarity: number;
  education_quality: number;
}

interface MatchWeights {
  skills: number;
  experience: number;
  education: number;
  cultural_fit: number;
}

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly scoreProfile: ScoreProfileService,
    private readonly scoreMatch: ScoreMatchService,
    private readonly profilesRepo: ProfilesRepository,
    private readonly resumesRepo: ResumesRepository,
    private readonly scoringRepo: ScoringRepository,
    private readonly audit: AuditService,
  ) {}

  async computeProfileScore(
    user: AuthUser,
    requestMeta: RequestMeta = {},
  ): Promise<ProfileScoreDto> {
    if (user.role !== "candidate") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Candidate role required",
      });
    }

    // Defense in depth: this manual check enforces 1/60s PER USER. The
    // ThrottlerGuard on ScoringController.computeProfile enforces 1/60s PER IP.
    // Both layers are valuable — a determined attacker rotating IPs would
    // bypass Throttler but not this user-keyed check.
    const lastScore = await this.scoringRepo.findMostRecentProfileScore(user.id);
    if (lastScore) {
      const elapsedMs = Date.now() - lastScore.createdAt.getTime();
      if (elapsedMs < 60_000) {
        const waitSeconds = Math.ceil((60_000 - elapsedMs) / 1000);
        throw new HttpException(
          {
            code: "RATE_LIMITED",
            message: `Please wait ${waitSeconds}s before recomputing`,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const defaultResume = await this.resumesRepo.findDefaultByCandidateId(user.id);
    if (!defaultResume) {
      throw new BadRequestException({
        code: "NO_DEFAULT_RESUME",
        message: "Upload a resume first",
      });
    }
    if (defaultResume.parseStatus !== "parsed" || !defaultResume.parsedData) {
      throw new BadRequestException({
        code: "RESUME_NOT_PARSED",
        message: "Your resume hasn't been parsed yet. Try re-uploading.",
      });
    }

    const candidateProfile = await this.profilesRepo.findCandidateProfile(user.id);
    if (!candidateProfile) {
      throw new BadRequestException({
        code: "PROFILE_INCOMPLETE",
        message: "Complete onboarding first",
      });
    }
    const desiredRole = candidateProfile.desiredRoles[0] ?? "Software Engineer";
    const desiredSeniority = candidateProfile.desiredSeniority ?? "Mid";

    const config = await this.scoringRepo.getActiveConfig();
    if (!config) {
      throw new ServiceUnavailableException({
        code: "NO_SCORING_CONFIG",
        message: "Scoring is temporarily unavailable",
      });
    }
    const weights = config.profileWeights as ProfileWeights;

    const aiResult = await this.scoreProfile.score({
      parsedResume: defaultResume.parsedData as unknown as ParsedResume,
      desiredRole,
      desiredSeniority,
      weights,
      requestId: `score-profile:${user.id}`,
    });

    const evidenceRows = aiResult.score.components.flatMap((comp) =>
      comp.evidence.map((ev) => ({
        componentName: comp.name,
        excerptText: ev.excerpt,
        excerptSource: ev.source,
        relevance: ev.relevance,
        contributionPoints: null,
      })),
    );

    const { profileScore } = await this.scoringRepo.insertProfileScore(
      {
        candidateId: user.id,
        resumeId: defaultResume.id,
        overallScore: aiResult.score.overall_score,
        band: aiResult.score.band,
        components: aiResult.score.components as unknown as Record<string, unknown>,
        improvementSuggestions: aiResult.score
          .improvement_suggestions as unknown as Record<string, unknown>,
        redactedFields: aiResult.redactedFields,
        promptVersion: aiResult.promptVersion,
        modelUsed: aiResult.model,
        rawOutput: aiResult.score as unknown as Record<string, unknown>,
        latencyMs: aiResult.latencyMs,
        status: "completed",
      },
      evidenceRows,
    );

    await this.audit.log({
      actorId: user.id,
      actorType: "ai",
      action: "score.profile.computed",
      entityType: "profile_score",
      entityId: profileScore.id,
      details: {
        overallScore: profileScore.overallScore,
        band: profileScore.band,
        model: aiResult.model,
        promptVersion: aiResult.promptVersion,
        latencyMs: aiResult.latencyMs,
        redactedFields: aiResult.redactedFields,
        weightsUsed: weights as unknown as Record<string, unknown>,
      },
      ...requestMeta,
    });

    this.logger.log(
      `Profile score computed for ${user.id}: ${profileScore.overallScore}/100 (${profileScore.band})`,
    );

    return this.toDto(profileScore.id, aiResult.score, aiResult, profileScore.createdAt);
  }

  async getProfileScoreMe(user: AuthUser): Promise<ProfileScoreDto | null> {
    if (user.role !== "candidate") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Candidate role required",
      });
    }

    const score = await this.scoringRepo.findMostRecentProfileScore(user.id);
    if (!score) return null;

    return this.fromDbRow(score);
  }

  private toDto(
    scoreId: string,
    score: ProfileScoreOutput,
    aiMeta: { latencyMs: number; model: string; promptVersion: string; redactedFields: string[] },
    createdAt: Date,
  ): ProfileScoreDto {
    return {
      id: scoreId,
      overallScore: score.overall_score,
      band: score.band,
      components: score.components.map((c) => ({
        name: c.name,
        score: c.score,
        max: c.max,
        weight: c.weight,
        explanation: c.explanation,
        evidence: c.evidence.map<ScoreEvidenceDto>((e) => ({
          excerpt: e.excerpt,
          source: e.source,
          relevance: e.relevance,
        })),
      })),
      improvementSuggestions: score.improvement_suggestions.map((s) => ({
        title: s.title,
        description: s.description,
        estimatedImpact: s.estimated_impact,
      })),
      redactedFields: aiMeta.redactedFields,
      promptVersion: aiMeta.promptVersion,
      modelUsed: aiMeta.model,
      latencyMs: aiMeta.latencyMs,
      createdAt: createdAt.toISOString(),
    };
  }

  private fromDbRow(row: DbProfileScore): ProfileScoreDto {
    const components = (row.components as ProfileScoreOutput["components"]) ?? [];
    const suggestions =
      (row.improvementSuggestions as ProfileScoreOutput["improvement_suggestions"]) ?? [];

    return {
      id: row.id,
      overallScore: row.overallScore,
      band: row.band,
      components: components.map((c) => ({
        name: c.name,
        score: c.score,
        max: c.max,
        weight: c.weight,
        explanation: c.explanation,
        evidence: c.evidence.map<ScoreEvidenceDto>((e) => ({
          excerpt: e.excerpt,
          source: e.source,
          relevance: e.relevance,
        })),
      })),
      improvementSuggestions: suggestions.map((s) => ({
        title: s.title,
        description: s.description,
        estimatedImpact: s.estimated_impact,
      })),
      redactedFields: row.redactedFields,
      promptVersion: row.promptVersion,
      modelUsed: row.modelUsed,
      latencyMs: row.latencyMs ?? 0,
      createdAt: row.createdAt.toISOString(),
    };
  }

  // -----------------------------------------------------------------
  // MATCH SCORE — orchestrator called by ApplicationsService.apply()
  // -----------------------------------------------------------------

  async computeMatchScore(
    applicationId: string,
    candidateId: string,
    jobId: string,
    resumeId: string,
    job: {
      title: string;
      department: string | null;
      experienceLevel: string;
      educationRequirement: string | null;
      requiredSkills: string[];
      descriptionPlain: string;
    },
    requestMeta: RequestMeta = {},
  ): Promise<MatchScoreDto> {
    const resume = await this.resumesRepo.findById(resumeId);
    if (!resume || !resume.parsedData) {
      throw new BadRequestException({
        code: "RESUME_NOT_PARSED",
        message: "Resume must be parsed before scoring",
      });
    }

    const config = await this.scoringRepo.getActiveConfig();
    if (!config) {
      throw new ServiceUnavailableException({
        code: "NO_SCORING_CONFIG",
        message: "Scoring is temporarily unavailable",
      });
    }
    const weights = config.matchWeights as MatchWeights;

    const aiResult = await this.scoreMatch.score({
      parsedResume: resume.parsedData as unknown as ParsedResume,
      job,
      weights,
      requestId: `score-match:${applicationId}`,
    });

    const evidenceRows = aiResult.score.components.flatMap((comp) =>
      comp.evidence.map((ev) => ({
        componentName: comp.name,
        excerptText: ev.excerpt,
        excerptSource: ev.source,
        relevance: ev.relevance,
        contributionPoints: ev.contribution_points,
      })),
    );

    const { matchScore } = await this.scoringRepo.insertMatchScore(
      {
        applicationId,
        candidateId,
        jobId,
        resumeId,
        overallScore: aiResult.score.overall_score,
        band: aiResult.score.band,
        components: aiResult.score.components as unknown as Record<string, unknown>,
        redactedFields: aiResult.redactedFields,
        weightsUsed: weights as unknown as Record<string, unknown>,
        promptVersion: aiResult.promptVersion,
        modelUsed: aiResult.model,
        rawOutput: aiResult.score as unknown as Record<string, unknown>,
        latencyMs: aiResult.latencyMs,
        status: "completed",
      },
      evidenceRows,
    );

    await this.audit.log({
      actorId: candidateId,
      actorType: "ai",
      action: "score.match.computed",
      entityType: "match_score",
      entityId: matchScore.id,
      details: {
        applicationId,
        jobId,
        overallScore: matchScore.overallScore,
        band: matchScore.band,
        model: aiResult.model,
        promptVersion: aiResult.promptVersion,
        latencyMs: aiResult.latencyMs,
        redactedFields: aiResult.redactedFields,
        weightsUsed: weights as unknown as Record<string, unknown>,
      },
      ...requestMeta,
    });

    this.logger.log(
      `Match score computed for application ${applicationId}: ${matchScore.overallScore}/100 (${matchScore.band})`,
    );

    return this.matchScoreToDto(
      matchScore.id,
      aiResult.score,
      aiResult,
      matchScore.createdAt,
    );
  }

  async getMatchScoreByApplicationId(
    applicationId: string,
  ): Promise<MatchScoreDto | null> {
    const row = await this.scoringRepo.findMatchScoreByApplicationId(applicationId);
    if (!row) return null;

    const components = (row.components as MatchScoreOutput["components"]) ?? [];
    const raw = row.rawOutput as MatchScoreOutput;
    return {
      id: row.id,
      overallScore: row.overallScore,
      band: row.band,
      components: components.map((c) => ({
        name: c.name,
        score: c.score,
        max: c.max,
        weight: c.weight,
        explanation: c.explanation,
        evidence: c.evidence.map<MatchEvidenceDto>((e) => ({
          excerpt: e.excerpt,
          source: e.source,
          relevance: e.relevance,
          contributionPoints: e.contribution_points,
        })),
      })),
      summary: raw?.summary ?? "",
      redFlags: raw?.red_flags ?? null,
      greenFlags: raw?.green_flags ?? null,
      redactedFields: row.redactedFields,
      promptVersion: row.promptVersion,
      modelUsed: row.modelUsed,
      latencyMs: row.latencyMs ?? 0,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private matchScoreToDto(
    scoreId: string,
    score: MatchScoreOutput,
    aiMeta: { latencyMs: number; model: string; promptVersion: string; redactedFields: string[] },
    createdAt: Date,
  ): MatchScoreDto {
    return {
      id: scoreId,
      overallScore: score.overall_score,
      band: score.band,
      components: score.components.map<MatchComponentDto>((c) => ({
        name: c.name,
        score: c.score,
        max: c.max,
        weight: c.weight,
        explanation: c.explanation,
        evidence: c.evidence.map<MatchEvidenceDto>((e) => ({
          excerpt: e.excerpt,
          source: e.source,
          relevance: e.relevance,
          contributionPoints: e.contribution_points,
        })),
      })),
      summary: score.summary,
      redFlags: score.red_flags ?? null,
      greenFlags: score.green_flags ?? null,
      redactedFields: aiMeta.redactedFields,
      promptVersion: aiMeta.promptVersion,
      modelUsed: aiMeta.model,
      latencyMs: aiMeta.latencyMs,
      createdAt: createdAt.toISOString(),
    };
  }
}
