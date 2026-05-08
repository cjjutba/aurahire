import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  ONVIEW_DAILY_CAP,
  type AuthUser,
  type ParsedResume,
  type ProfileScore as ProfileScoreOutput,
  type MatchScore as MatchScoreOutput,
} from "@aurahire/shared";
import type {
  ProfileScore as DbProfileScore,
  MatchScorePreview as DbMatchScorePreview,
} from "@aurahire/db";
import type Redis from "ioredis";

import { AuditService } from "../../audit";
import { CACHE_REDIS, CacheService, TTL_SECONDS, TAGS } from "../../cache";
import { ScoreProfileService } from "../../ai/score-profile.service";
import { ScoreMatchService } from "../../ai/score-match.service";
import { EventsService } from "../../realtime";
import { JobsRepository } from "../jobs/jobs.repository";
import { ProfilesRepository } from "../profiles/profiles.repository";
import { ResumesRepository } from "../resumes/resumes.repository";
import { ScoringRepository } from "./scoring.repository";
import type { ProfileScoreRecomputeReason } from "../../queue/profile-score-queue.service";
import type {
  ProfileScoreDto,
  ScoreEvidenceDto,
} from "./dto/profile-score-response.dto";
import type {
  MatchScoreDto,
  MatchComponentDto,
  MatchEvidenceDto,
} from "../applications/dto/application-response.dto";
import type { MatchScorePreviewDto } from "./dto/match-preview-response.dto";
import { MatchPreviewRateLimitException } from "./dto/match-preview-rate-limit.exception";

type MatchPreviewSource = "system" | "candidate" | "candidate_view";

/**
 * Redis TTL (seconds) for the on-view daily counter.
 *
 * 90,000s ≈ 25h — slightly more than a calendar day so the key safely
 * outlives the UTC date boundary it's bucketed under. Date-bucketed keys
 * expire on their own; this TTL is a belt-and-suspenders cleanup so a
 * disconnected user's stale key doesn't accumulate indefinitely.
 */
const ONVIEW_COUNTER_TTL_SECONDS = 90_000;

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

interface BandThresholds {
  strong: number;
  partial: number;
}

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Derive overall score from per-component scores.
 *
 * Returns the weighted sum normalized to 0..100 by component maxes. With
 * configured weights summing to 100 (enforced by the Zod validator), this is
 * just the score sum — but the normalization makes it robust to any AI
 * deviation from the configured maxes and prevents silent clamping when
 * sums overflow.
 */
export function deriveOverallScore(
  components: ReadonlyArray<{ score: number; max: number }>,
): number {
  const maxSum = components.reduce((acc, c) => acc + (Number(c.max) || 0), 0);
  if (maxSum <= 0) return 0;
  const scoreSum = components.reduce(
    (acc, c) =>
      acc + Math.max(0, Math.min(Number(c.max) || 0, Number(c.score) || 0)),
    0,
  );
  return Math.round((scoreSum / maxSum) * 100);
}

/**
 * Override AI-returned `max` / `weight` with the configured weights and clamp
 * each `score` into `[0, configuredMax]`. The AI sometimes invents its own
 * maxes when the prompt is ambiguous; this enforces the AI-output ↔
 * configured-weights contract before persistence so the breakdown always
 * reconciles with the headline.
 */
export function normalizeComponentsToWeights<
  C extends { name: string; score: number; max: number; weight: number },
>(
  components: ReadonlyArray<C>,
  weights: Record<string, number>,
): C[] {
  return components.map((c) => {
    const configuredMax = weights[c.name] ?? c.max;
    return {
      ...c,
      max: configuredMax,
      weight: configuredMax,
      score: Math.max(0, Math.min(configuredMax, Number(c.score) || 0)),
    };
  });
}

/**
 * Strict-sum reconciliation: derive component.score from the sum of evidence
 * contribution_points, quantizing each to the nearest 5 and clamping to
 * [0, component.max]. Forces evidence.relevance to match the sign of the
 * (quantized) contribution.
 *
 * Returns the reconciled component plus residuals for audit:
 *   - residual = ai_score - derived_score (zero when AI was honest)
 *   - quantizationDeltas: per-evidence deltas where the AI's number was rounded
 *
 * The AI's `score` field is discarded by the engine; only `derived` ships.
 */
export function reconcileEvidenceContributions<
  C extends {
    name: string;
    score: number;
    max: number;
    evidence: Array<{
      excerpt: string;
      source: string;
      relevance: "positive" | "negative" | "neutral";
      contribution_points: number;
    }>;
  },
>(
  component: C,
): {
  component: C;
  residual: number;
  quantizationDeltas: Array<{ evidenceIndex: number; original: number; quantized: number }>;
} {
  const aiScore = component.score;
  const quantizationDeltas: Array<{ evidenceIndex: number; original: number; quantized: number }> = [];

  const reconciled = component.evidence.map((ev, evidenceIndex) => {
    const original = Number(ev.contribution_points) || 0;
    const quantized = Math.round(original / 5) * 5;
    if (quantized !== original) {
      quantizationDeltas.push({ evidenceIndex, original, quantized });
    }
    const relevance: "positive" | "negative" | "neutral" =
      quantized > 0 ? "positive" : quantized < 0 ? "negative" : "neutral";
    return { ...ev, contribution_points: quantized, relevance };
  });

  const derivedRaw = reconciled.reduce((sum, ev) => sum + ev.contribution_points, 0);
  const derived = Math.max(0, Math.min(component.max, derivedRaw));

  return {
    component: { ...component, score: derived, evidence: reconciled },
    residual: aiScore - derived,
    quantizationDeltas,
  };
}

/**
 * Closed set of audit-log identifiers for calibration warnings.
 * Tasks 12-14 read this union exhaustively from the bias-monitor
 * aggregator; widening here is a deliberate vocabulary change.
 */
export type CalibrationWarningReason =
  | "ceiling_with_thin_evidence"
  | "deduction_without_negative_evidence";

/**
 * Surface known model-misbehavior patterns as advisory warnings.
 * Warnings do NOT auto-adjust the score — they're written to the audit
 * row's `details.calibrationWarnings` array and aggregated in
 * /admin/bias-monitor's "Scoring Quality" panel for human review.
 *
 * Two heuristics:
 *   1. ceiling_with_thin_evidence — Component scored at max but the model
 *      only cited one positive evidence item. The prompt v1.2.0 rule
 *      requires at least two positives at ceiling.
 *   2. deduction_without_negative_evidence — Component below max but no
 *      evidence row carries a negative contribution. The deduction has no
 *      visible justification.
 */
export function detectCalibrationWarnings<C extends {
  name: string;
  score: number;
  max: number;
  evidence: Array<{
    excerpt: string;
    source: string;
    relevance: "positive" | "negative" | "neutral";
    contribution_points: number;
  }>;
}>(component: C): Array<{ componentName: string; reason: CalibrationWarningReason }> {
  const warnings: Array<{ componentName: string; reason: CalibrationWarningReason }> = [];

  if (component.score === component.max) {
    const positives = component.evidence.filter((e) => e.relevance === "positive");
    if (positives.length < 2) {
      warnings.push({
        componentName: component.name,
        reason: "ceiling_with_thin_evidence",
      });
    }
  }

  if (component.score < component.max) {
    const negatives = component.evidence.filter((e) => e.relevance === "negative");
    if (negatives.length === 0) {
      warnings.push({
        componentName: component.name,
        reason: "deduction_without_negative_evidence",
      });
    }
  }

  return warnings;
}

export function deriveBand(
  score: number,
  thresholds: BandThresholds,
): "strong" | "partial" | "limited" {
  if (score >= thresholds.strong) return "strong";
  if (score >= thresholds.partial) return "partial";
  return "limited";
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly scoreProfile: ScoreProfileService,
    private readonly scoreMatch: ScoreMatchService,
    private readonly jobsRepo: JobsRepository,
    private readonly profilesRepo: ProfilesRepository,
    private readonly resumesRepo: ResumesRepository,
    private readonly scoringRepo: ScoringRepository,
    private readonly audit: AuditService,
    private readonly cacheService: CacheService,
    @Inject(CACHE_REDIS) private readonly redis: Redis,
    private readonly events: EventsService,
  ) {}

  /**
   * User-facing entry point for `POST /scoring/profile/compute`. Enforces the
   * candidate role + per-user rate limit, resolves the candidate's current
   * default resume, and delegates the actual AI run to `computeProfileScore`.
   *
   * The queue-driven recompute path (Task 9 processor) calls
   * `computeProfileScore` directly with an explicit `(candidateId, resumeId)`
   * pair — system-driven recomputes don't need the user-keyed rate limit
   * because BullMQ already collapses duplicate jobs by jobId at enqueue time.
   */
  async computeProfileScoreForUser(
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

    return this.computeProfileScore(user.id, defaultResume.id, {
      reason: "manual_recompute",
      requestMeta,
    });
  }

  /**
   * Core Profile Score compute — runs the AI, persists a fresh
   * `profile_scores` row, writes the audit row, busts the candidate's
   * profile-score cache. Used by both the user-facing wrapper above and the
   * queue-driven recompute processor (Task 9).
   *
   * `options.reason` is folded into the audit row's `details` so analysts can
   * distinguish a manual user click from a system-triggered recompute
   * (resume change / preferences edit / profile edit).
   */
  async computeProfileScore(
    candidateId: string,
    resumeId: string,
    options: {
      reason?: ProfileScoreRecomputeReason;
      requestMeta?: RequestMeta;
    } = {},
  ): Promise<ProfileScoreDto> {
    const reason: ProfileScoreRecomputeReason = options.reason ?? "manual_recompute";
    const requestMeta = options.requestMeta ?? {};

    const resume = await this.resumesRepo.findById(resumeId);
    if (!resume || resume.candidateId !== candidateId) {
      throw new BadRequestException({
        code: "RESUME_NOT_FOUND",
        message: "Resume not found for this candidate",
      });
    }
    if (resume.parseStatus !== "parsed" || !resume.parsedData) {
      throw new BadRequestException({
        code: "RESUME_NOT_PARSED",
        message: "Your resume hasn't been parsed yet. Try re-uploading.",
      });
    }

    const candidateProfile = await this.profilesRepo.findCandidateProfile(candidateId);
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
    const bandThresholds = config.bandThresholds as BandThresholds;

    const aiResult = await this.scoreProfile.score({
      parsedResume: resume.parsedData as unknown as ParsedResume,
      desiredRole,
      desiredSeniority,
      weights,
      requestId: `score-profile:${candidateId}`,
    });

    // Engine-enforced arithmetic: components are normalized against the
    // configured weights (so a model that fabricates its own maxes can't
    // smuggle out-of-bounds scores), then overall = Σ component.score
    // normalized to 0..100. The AI's overall_score / band are kept in
    // raw_output for audit but never surface to clients or downstream logic.
    const normalizedProfileComponents = normalizeComponentsToWeights(
      aiResult.score.components,
      weights as unknown as Record<string, number>,
    );

    // Strict-sum reconciliation: component.score becomes the (quantized, clamped)
    // sum of evidence contribution_points. The AI's score field is discarded;
    // residuals + quantization deltas + calibration warnings flow into the audit row.
    const reconciliations = normalizedProfileComponents.map((c) =>
      reconcileEvidenceContributions(c),
    );
    const reconciledProfileComponents = reconciliations.map((r) => r.component);
    const scoreResiduals = reconciliations
      .filter((r) => r.residual !== 0)
      .map((r) => ({
        componentName: r.component.name,
        aiScore: r.component.score + r.residual,
        derivedScore: r.component.score,
      }));
    const evidenceQuantizationResiduals = reconciliations.flatMap((r) =>
      r.quantizationDeltas.map((d) => ({
        componentName: r.component.name,
        evidenceIndex: d.evidenceIndex,
        original: d.original,
        quantized: d.quantized,
      })),
    );
    const calibrationWarnings = reconciledProfileComponents.flatMap((c) =>
      detectCalibrationWarnings(c),
    );

    const derivedOverall = deriveOverallScore(reconciledProfileComponents);
    const derivedBand = deriveBand(derivedOverall, bandThresholds);

    const evidenceRows = reconciledProfileComponents.flatMap((comp) =>
      comp.evidence.map((ev) => ({
        componentName: comp.name,
        excerptText: ev.excerpt,
        excerptSource: ev.source,
        relevance: ev.relevance,
        contributionPoints: ev.contribution_points,
      })),
    );

    const { profileScore } = await this.scoringRepo.insertProfileScore(
      {
        candidateId,
        resumeId: resume.id,
        overallScore: derivedOverall,
        band: derivedBand,
        components: reconciledProfileComponents as unknown as Record<string, unknown>,
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
      actorId: candidateId,
      actorType: "ai",
      action: "score.profile.computed",
      entityType: "profile_score",
      entityId: profileScore.id,
      details: {
        reason,
        overallScore: profileScore.overallScore,
        band: profileScore.band,
        model: aiResult.model,
        promptVersion: aiResult.promptVersion,
        latencyMs: aiResult.latencyMs,
        redactedFields: aiResult.redactedFields,
        weightsUsed: weights as unknown as Record<string, unknown>,
        scoreResiduals,
        evidenceQuantizationResiduals,
        calibrationWarnings,
      },
      ...requestMeta,
    });

    await this.cacheService.bustTag(TAGS.profileScore(candidateId));

    // Realtime: notify the candidate's user room so dashboards / score-ring
    // widgets refresh without a manual reload. Reason flows through so the
    // UI can decide whether to surface "we recomputed because your resume
    // changed" copy vs. the manual-button confirmation.
    this.events.emitProfileScoreUpdated({
      candidateId,
      resumeId: resume.id,
      overallScore: profileScore.overallScore,
      band: profileScore.band,
      reason,
      updatedAt: profileScore.createdAt.toISOString(),
    });

    this.logger.log(
      `Profile score computed for ${candidateId} (reason=${reason}): ${profileScore.overallScore}/100 (${profileScore.band})`,
    );

    return this.toDto(
      profileScore.id,
      {
        ...aiResult.score,
        components: reconciledProfileComponents,
      } as ProfileScoreOutput,
      aiResult,
      profileScore.createdAt,
      derivedOverall,
      derivedBand,
    );
  }

  async getProfileScoreMe(user: AuthUser): Promise<ProfileScoreDto | null> {
    if (user.role !== "candidate") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Candidate role required",
      });
    }

    return this.cacheService.getOrSet<ProfileScoreDto | null>({
      key: `profile-score:${user.id}`,
      ttlSeconds: TTL_SECONDS.warm,
      tags: [TAGS.profileScore(user.id)],
      telemetryName: "profile-score:read",
      load: async () => {
        const score = await this.scoringRepo.findMostRecentProfileScore(user.id);
        if (!score) return null;

        return this.fromDbRow(score);
      },
    });
  }

  private toDto(
    scoreId: string,
    score: ProfileScoreOutput,
    aiMeta: { latencyMs: number; model: string; promptVersion: string; redactedFields: string[] },
    createdAt: Date,
    overallOverride?: number,
    bandOverride?: "strong" | "partial" | "limited",
  ): ProfileScoreDto {
    return {
      id: scoreId,
      overallScore: overallOverride ?? score.overall_score,
      band: bandOverride ?? score.band,
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
      /**
       * Tenant context for the audit row. Applications are *always* under a
       * company-owned job, so this is non-null in practice. Kept optional to
       * keep call sites that pre-date Phase 2c building until they're
       * threaded through.
       */
      companyId?: string | null;
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
    const bandThresholds = config.bandThresholds as BandThresholds;

    // Promotion path — if the candidate ran "See my match" or we
    // auto-pre-computed during resume parse for the same (candidate, job,
    // resume) triple, reuse the already-paid-for AI result instead of
    // burning a fresh OpenAI call. Apply becomes effectively instant.
    const preview = await this.scoringRepo.findMatchPreview(
      candidateId,
      jobId,
      resumeId,
    );

    let aiResult: Awaited<ReturnType<typeof this.scoreMatch.score>>;
    let promotedFromPreviewId: string | null = null;
    if (preview) {
      aiResult = {
        score: preview.rawOutput as unknown as MatchScoreOutput,
        redactedFields: preview.redactedFields,
        promptVersion: preview.promptVersion,
        model: preview.modelUsed,
        latencyMs: preview.latencyMs ?? 0,
      };
      promotedFromPreviewId = preview.id;
      this.logger.log(
        `Promoting preview ${preview.id} for application ${applicationId} (skipping fresh AI call)`,
      );
    } else {
      aiResult = await this.scoreMatch.score({
        parsedResume: resume.parsedData as unknown as ParsedResume,
        job,
        weights,
        requestId: `score-match:${applicationId}`,
      });
    }

    // Engine-enforced arithmetic — see deriveOverallScore note above.
    const normalizedMatchComponents = normalizeComponentsToWeights(
      aiResult.score.components,
      weights as unknown as Record<string, number>,
    );

    // Strict-sum reconciliation — mirrors the pattern in computeProfileScore.
    // component.score becomes the (quantized, clamped) sum of evidence
    // contribution_points; AI's score is discarded; residuals + warnings
    // flow into the audit row.
    const matchReconciliations = normalizedMatchComponents.map((c) =>
      reconcileEvidenceContributions(c),
    );
    const reconciledMatchComponents = matchReconciliations.map((r) => r.component);
    const matchScoreResiduals = matchReconciliations
      .filter((r) => r.residual !== 0)
      .map((r) => ({
        componentName: r.component.name,
        aiScore: r.component.score + r.residual,
        derivedScore: r.component.score,
      }));
    const matchEvidenceQuantizationResiduals = matchReconciliations.flatMap((r) =>
      r.quantizationDeltas.map((d) => ({
        componentName: r.component.name,
        evidenceIndex: d.evidenceIndex,
        original: d.original,
        quantized: d.quantized,
      })),
    );
    const matchCalibrationWarnings = reconciledMatchComponents.flatMap((c) =>
      detectCalibrationWarnings(c),
    );

    const derivedOverall = deriveOverallScore(reconciledMatchComponents);
    const derivedBand = deriveBand(derivedOverall, bandThresholds);

    const evidenceRows = reconciledMatchComponents.flatMap((comp) =>
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
        overallScore: derivedOverall,
        band: derivedBand,
        components: reconciledMatchComponents as unknown as Record<string, unknown>,
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
      companyId: job.companyId ?? null,
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
        promotedFromPreviewId,
        scoreResiduals: matchScoreResiduals,
        evidenceQuantizationResiduals: matchEvidenceQuantizationResiduals,
        calibrationWarnings: matchCalibrationWarnings,
      },
      ...requestMeta,
    });

    this.logger.log(
      `Match score computed for application ${applicationId}: ${matchScore.overallScore}/100 (${matchScore.band})`,
    );

    return this.matchScoreToDto(
      matchScore.id,
      {
        ...aiResult.score,
        components: reconciledMatchComponents,
      } as MatchScoreOutput,
      aiResult,
      matchScore.createdAt,
      derivedOverall,
      derivedBand,
    );
  }

  /**
   * Synchronous preview-promotion fast-path used by ApplicationsService.apply().
   *
   * If a preview already exists for this exact (candidate, job, resume) triple,
   * materialize it as a real `match_scores` row tied to the new application —
   * no OpenAI call, no queue, no shimmer on the detail page. Returns null when
   * no preview is available, in which case the caller should defer to the
   * async worker.
   *
   * Internally this delegates to `computeMatchScore`, which takes the same
   * promotion branch; the upfront preview lookup here is the gate that lets us
   * stay in the request thread without risking a fresh AI call when the
   * preview is missing.
   */
  async tryPromoteMatchPreview(
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
      companyId?: string | null;
    },
    requestMeta: RequestMeta = {},
  ): Promise<MatchScoreDto | null> {
    const preview = await this.scoringRepo.findMatchPreview(
      candidateId,
      jobId,
      resumeId,
    );
    if (!preview) return null;

    return this.computeMatchScore(
      applicationId,
      candidateId,
      jobId,
      resumeId,
      job,
      requestMeta,
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

  // -----------------------------------------------------------------
  // MATCH-SCORE PREVIEWS — pre-application "See my match" + auto-precompute
  // -----------------------------------------------------------------

  /**
   * Compute a match-score preview for the current candidate against `jobId`
   * using the candidate's default resume. Idempotent per (candidate, job,
   * resume) — repeated calls for the same triple UPSERT and bump the row's
   * createdAt. Skips computation entirely if a fresh preview already exists.
   */
  async computeMatchPreview(
    user: AuthUser,
    jobId: string,
    options: { source: "candidate" | "system"; force?: boolean } = {
      source: "candidate",
    },
  ): Promise<MatchScorePreviewDto> {
    if (user.role !== "candidate") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Candidate role required",
      });
    }

    return this.computeMatchPreviewInternal(user.id, jobId, options.source, {
      force: options.force ?? false,
    });
  }

  /**
   * On-view auto-compute used by the buttonless candidate job-detail page.
   *
   * Behavior contract (Phase 1 proactive system):
   *   1. If a preview row already exists for `(candidateId, jobId, current
   *      default resume)`, return it immediately — no AI call, and no
   *      increment to the daily counter (cache hit cost is zero).
   *   2. Otherwise check the per-UTC-day counter
   *      `scoring:onview:{candidateId}:{YYYY-MM-DD}`. Atomic INCR; first
   *      hit sets EXPIRE to ~25h. If the resulting count exceeds
   *      `ONVIEW_DAILY_CAP`, throw `MatchPreviewRateLimitException` (429
   *      with `code: DAILY_AI_LIMIT`).
   *   3. Otherwise compute the preview and persist with
   *      `source = 'candidate_view'` so audit/analytics can distinguish
   *      this path from the legacy "candidate" (manual button) and
   *      "system" (top-N precompute) sources.
   *
   * The counter increment intentionally lives BEFORE the AI call so a
   * misconfigured client cannot burn budget by issuing 1000 concurrent
   * requests.
   */
  async computeMatchPreviewOnView(
    user: AuthUser,
    jobId: string,
  ): Promise<MatchScorePreviewDto> {
    // Defense in depth: controller carries `@Roles('candidate')`, but the
    // service layer also enforces the role contract so any future caller
    // (queue worker, internal job, test harness) cannot skip the check.
    // Mirrors the pattern used by `computeMatchPreview`, `computeProfileScore`,
    // etc. above.
    if (user.role !== "candidate") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Candidate role required",
      });
    }
    const candidateId = user.id;

    // 1. Resolve the candidate's current default resume.
    const defaultResume = await this.resumesRepo.findDefaultByCandidateId(candidateId);
    if (!defaultResume) {
      throw new BadRequestException({
        code: "NO_DEFAULT_RESUME",
        message: "Upload a resume first",
      });
    }
    if (defaultResume.parseStatus !== "parsed" || !defaultResume.parsedData) {
      throw new BadRequestException({
        code: "RESUME_NOT_PARSED",
        message: "Your resume hasn't been parsed yet. Try again in a moment.",
      });
    }

    // 2. Cache-hit short-circuit — return without touching the daily counter.
    const existing = await this.scoringRepo.findMatchPreview(
      candidateId,
      jobId,
      defaultResume.id,
    );
    if (existing) {
      return this.matchPreviewRowToDto(existing);
    }

    // 3. Daily rate-limit gate. UTC date bucket so all candidates roll over
    // at the same wall-clock instant; cleaner audit story than per-user TZ.
    const today = new Date().toISOString().slice(0, 10);
    const key = `scoring:onview:${candidateId}:${today}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      // Best-effort TTL — if EXPIRE fails the key still gets a fresh INCR
      // tomorrow under a different date-bucketed name, so we don't bail.
      await this.redis.expire(key, ONVIEW_COUNTER_TTL_SECONDS);
    }
    if (count > ONVIEW_DAILY_CAP) {
      throw new MatchPreviewRateLimitException(ONVIEW_DAILY_CAP);
    }

    // 4. Defer to the shared compute path with the on-view source tag.
    return this.computeMatchPreviewInternal(
      candidateId,
      jobId,
      "candidate_view",
      { force: false, defaultResume },
    );
  }

  private async computeMatchPreviewInternal(
    candidateId: string,
    jobId: string,
    source: MatchPreviewSource,
    options: {
      force: boolean;
      /**
       * Already-loaded default resume. The on-view path resolves it earlier
       * (so the cache-hit short-circuit can run before the rate-limit
       * counter); pass it through to avoid a second round-trip.
       */
      defaultResume?: Awaited<
        ReturnType<ResumesRepository["findDefaultByCandidateId"]>
      >;
    } = { force: false },
  ): Promise<MatchScorePreviewDto> {
    const defaultResume =
      options.defaultResume ??
      (await this.resumesRepo.findDefaultByCandidateId(candidateId));
    if (!defaultResume) {
      throw new BadRequestException({
        code: "NO_DEFAULT_RESUME",
        message: "Upload a resume first",
      });
    }
    if (defaultResume.parseStatus !== "parsed" || !defaultResume.parsedData) {
      throw new BadRequestException({
        code: "RESUME_NOT_PARSED",
        message: "Your resume hasn't been parsed yet. Try again in a moment.",
      });
    }

    const job = await this.jobsRepo.findById(jobId);
    if (!job) {
      throw new BadRequestException({
        code: "NOT_FOUND",
        message: "Job not found",
      });
    }
    if (job.status !== "published") {
      throw new BadRequestException({
        code: "JOB_NOT_PUBLISHED",
        message: "Match preview is only available for published jobs",
      });
    }

    // Short-circuit: if a preview already exists for this (candidate, job,
    // resume), return it instead of paying for another AI call. Pass
    // force:true to override.
    if (!options.force) {
      const existing = await this.scoringRepo.findMatchPreview(
        candidateId,
        jobId,
        defaultResume.id,
      );
      if (existing) {
        return this.matchPreviewRowToDto(existing);
      }
    }

    const config = await this.scoringRepo.getActiveConfig();
    if (!config) {
      throw new ServiceUnavailableException({
        code: "NO_SCORING_CONFIG",
        message: "Scoring is temporarily unavailable",
      });
    }
    const weights = config.matchWeights as MatchWeights;
    const bandThresholds = config.bandThresholds as BandThresholds;

    const aiResult = await this.scoreMatch.score({
      parsedResume: defaultResume.parsedData as unknown as ParsedResume,
      job: {
        title: job.title,
        department: job.department,
        experienceLevel: job.experienceLevel,
        educationRequirement: job.educationRequirement,
        requiredSkills: job.requiredSkills,
        descriptionPlain: job.descriptionPlain,
      },
      weights,
      requestId: `match-preview:${candidateId}:${jobId}`,
    });

    const normalizedPreviewComponents = normalizeComponentsToWeights(
      aiResult.score.components,
      weights as unknown as Record<string, number>,
    );

    // Strict-sum reconciliation — same pattern as computeProfileScore /
    // computeMatchScore. component.score becomes the (quantized, clamped)
    // sum of evidence contribution_points; AI's score is discarded.
    const previewReconciliations = normalizedPreviewComponents.map((c) =>
      reconcileEvidenceContributions(c),
    );
    const reconciledPreviewComponents = previewReconciliations.map((r) => r.component);
    const previewScoreResiduals = previewReconciliations
      .filter((r) => r.residual !== 0)
      .map((r) => ({
        componentName: r.component.name,
        aiScore: r.component.score + r.residual,
        derivedScore: r.component.score,
      }));
    const previewEvidenceQuantizationResiduals = previewReconciliations.flatMap((r) =>
      r.quantizationDeltas.map((d) => ({
        componentName: r.component.name,
        evidenceIndex: d.evidenceIndex,
        original: d.original,
        quantized: d.quantized,
      })),
    );
    const previewCalibrationWarnings = reconciledPreviewComponents.flatMap((c) =>
      detectCalibrationWarnings(c),
    );

    const derivedOverall = deriveOverallScore(reconciledPreviewComponents);
    const derivedBand = deriveBand(derivedOverall, bandThresholds);

    const preview = await this.scoringRepo.upsertMatchPreview({
      candidateId,
      jobId,
      resumeId: defaultResume.id,
      overallScore: derivedOverall,
      band: derivedBand,
      components: reconciledPreviewComponents as unknown as Record<string, unknown>,
      redactedFields: aiResult.redactedFields,
      weightsUsed: weights as unknown as Record<string, unknown>,
      promptVersion: aiResult.promptVersion,
      modelUsed: aiResult.model,
      rawOutput: aiResult.score as unknown as Record<string, unknown>,
      latencyMs: aiResult.latencyMs,
      source,
    });

    // Three-way mapping:
    //   - `candidate`      (legacy manual button click) → user
    //   - `candidate_view` (AI compute on candidate's behalf at page-view) → ai
    //   - `system`         (cron precompute) → system
    // Aligns with `score.profile.computed` and `score.match.computed`, which
    // both log `actorType: "ai"` for AI-driven writes regardless of whether a
    // human triggered the request. The legacy "candidate" branch is kept for
    // historical rows that flowed through that path before the buttonless
    // redesign — no new writes should land on `source = "candidate"`.
    const actorType = (() => {
      switch (source) {
        case "candidate":
          return "user";
        case "candidate_view":
          return "ai";
        case "system":
          return "system";
      }
    })();

    await this.audit.log({
      actorId: candidateId,
      actorType,
      action: "score.match.preview.computed",
      entityType: "match_score_preview",
      entityId: preview.id,
      companyId: job.companyId,
      details: {
        jobId,
        resumeId: defaultResume.id,
        overallScore: preview.overallScore,
        band: preview.band,
        model: aiResult.model,
        promptVersion: aiResult.promptVersion,
        latencyMs: aiResult.latencyMs,
        source,
        scoreResiduals: previewScoreResiduals,
        evidenceQuantizationResiduals: previewEvidenceQuantizationResiduals,
        calibrationWarnings: previewCalibrationWarnings,
      },
    });

    // Realtime: notify the candidate's user room so the recommended-jobs
    // feed and any open job-detail page can render the new preview without
    // a refresh. Source travels with the payload so the UI can distinguish
    // an on-view auto-compute from a top-N precompute landing in the feed.
    this.events.emitMatchPreviewCreated({
      candidateId,
      jobId,
      resumeId: defaultResume.id,
      source: preview.source,
      overallScore: preview.overallScore,
      band: preview.band,
      createdAt: preview.createdAt.toISOString(),
    });

    this.logger.log(
      `Match preview computed for candidate ${candidateId} × job ${jobId}: ${preview.overallScore}/100 (${preview.band}, source=${source})`,
    );

    return this.matchPreviewRowToDto(preview);
  }

  /**
   * Read-only fetch of an existing preview for a (candidate, job) pair.
   * Returns the latest preview regardless of resume version — the UI uses
   * this to decide whether to render "See my match" or the existing score.
   */
  async getMatchPreviewByJob(
    user: AuthUser,
    jobId: string,
  ): Promise<MatchScorePreviewDto | null> {
    if (user.role !== "candidate") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Candidate role required",
      });
    }
    const row = await this.scoringRepo.findLatestMatchPreviewForJob(
      user.id,
      jobId,
    );
    if (!row) return null;
    return this.matchPreviewRowToDto(row);
  }

  /**
   * List a candidate's previews ordered by score for the "Recommended for
   * you" feed. Joins job + company so the UI can render rich rows in one
   * round-trip.
   */
  async listMatchPreviewsForCandidate(
    user: AuthUser,
    limit = 25,
  ): Promise<MatchScorePreviewDto[]> {
    if (user.role !== "candidate") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Candidate role required",
      });
    }
    const rows = await this.scoringRepo.listMatchPreviewsForCandidate(
      user.id,
      limit,
    );
    if (rows.length === 0) return [];

    const jobIds = Array.from(new Set(rows.map((r) => r.jobId)));
    const jobs = await Promise.all(
      jobIds.map((id) => this.jobsRepo.findByIdWithCompany(id)),
    );
    const jobsById = new Map(
      jobs
        .filter((j): j is NonNullable<typeof j> => !!j)
        .map((j) => [j.id, j]),
    );

    return rows.map((row) => {
      const j = jobsById.get(row.jobId);
      const dto = this.matchPreviewRowToDto(row);
      if (j) {
        dto.job = {
          id: j.id,
          title: j.title,
          company: {
            id: j.company.id,
            name: j.company.name,
            logoUrl: j.company.logoUrl ?? null,
          },
        };
      }
      return dto;
    });
  }

  /**
   * Service hook fired by the resumes module when the candidate's default
   * resume changes. Stale previews scored against the old resume are
   * deleted so the recommended feed only shows results scored against the
   * candidate's current default resume.
   */
  async invalidatePreviewsForResume(resumeId: string): Promise<void> {
    const deleted = await this.scoringRepo.deleteMatchPreviewsByResume(resumeId);
    if (deleted > 0) {
      this.logger.log(
        `Invalidated ${deleted} match preview(s) for resume ${resumeId}`,
      );
    }
  }

  private matchPreviewRowToDto(row: DbMatchScorePreview): MatchScorePreviewDto {
    const components = (row.components as MatchScoreOutput["components"]) ?? [];
    return {
      id: row.id,
      jobId: row.jobId,
      resumeId: row.resumeId,
      overallScore: row.overallScore,
      band: row.band,
      components: components.map<MatchComponentDto>((c) => ({
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
      redactedFields: row.redactedFields,
      promptVersion: row.promptVersion,
      modelUsed: row.modelUsed,
      latencyMs: row.latencyMs ?? 0,
      source: row.source,
      createdAt: row.createdAt.toISOString(),
      job: null,
    };
  }

  private matchScoreToDto(
    scoreId: string,
    score: MatchScoreOutput,
    aiMeta: { latencyMs: number; model: string; promptVersion: string; redactedFields: string[] },
    createdAt: Date,
    overallOverride?: number,
    bandOverride?: "strong" | "partial" | "limited",
  ): MatchScoreDto {
    return {
      id: scoreId,
      overallScore: overallOverride ?? score.overall_score,
      band: bandOverride ?? score.band,
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
