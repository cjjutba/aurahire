import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type {
  AuthUser,
  BandThresholds,
  MatchWeights,
  PreviewImpactInput,
  UpdateScoringConfigInput,
} from "@aurahire/shared";

import { AuditService } from "../../../audit";
import { AUDIT_ACTIONS } from "../../../audit/audit.types";
import { CacheService, TTL_SECONDS, TAGS } from "../../../cache";
import {
  AdminConfigRepository,
  type ScoringConfigWithUpdatedBy,
} from "../repositories/admin-config.repository";
import type {
  PreviewImpactDataDto,
  ScoringConfigDto,
  TopMoverDto,
} from "../dto/scoring-config-response.dto";

const REQUIRED_PII_FIELDS = ["name", "email", "phone", "address"] as const;
const TOP_MOVERS_LIMIT = 5;

@Injectable()
export class AdminConfigService {
  private readonly logger = new Logger(AdminConfigService.name);

  constructor(
    private readonly repo: AdminConfigRepository,
    private readonly audit: AuditService,
    private readonly cacheService: CacheService,
  ) {}

  // -----------------------------------------------------------------
  // GET
  // -----------------------------------------------------------------

  async getActive(): Promise<ScoringConfigDto> {
    return this.cacheService.getOrSet<ScoringConfigDto>({
      key: "scoring-config:active",
      ttlSeconds: TTL_SECONDS.cool, // 1 hour
      tags: [TAGS.scoringConfigActive()],
      telemetryName: "scoring-config",
      load: async () => {
        const row = await this.repo.getActive();
        if (!row) {
          throw new NotFoundException({
            code: "NO_ACTIVE_CONFIG",
            message: "No active scoring config exists. Run pre-flight seed.",
          });
        }
        return this.toDto(row);
      },
    });
  }

  // -----------------------------------------------------------------
  // UPDATE
  // -----------------------------------------------------------------

  async update(
    actor: AuthUser,
    dto: UpdateScoringConfigInput,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<ScoringConfigDto> {
    if (dto.piiRedactionEnabled === false) {
      throw new BadRequestException({
        code: "PII_REDACTION_LOCKED",
        message: "PII redaction cannot be disabled in this system",
      });
    }
    if (dto.piiFieldsRedacted) {
      const missing = REQUIRED_PII_FIELDS.filter(
        (f) => !dto.piiFieldsRedacted!.includes(f),
      );
      if (missing.length > 0) {
        throw new BadRequestException({
          code: "PII_FIELD_REQUIRED",
          message: `Cannot remove required PII fields: ${missing.join(", ")}`,
          missing,
        });
      }
    }

    let dedupedTerms: string[] | undefined;
    if (dto.customFlaggedTerms) {
      const seen = new Set<string>();
      dedupedTerms = [];
      for (const term of dto.customFlaggedTerms) {
        const key = term.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        dedupedTerms.push(term.trim());
      }
    }

    const current = await this.repo.getActive();
    if (!current) {
      throw new NotFoundException({
        code: "NO_ACTIVE_CONFIG",
        message: "No active scoring config exists",
      });
    }

    const patch: Record<string, unknown> = {};
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const changedFields: string[] = [];

    function diff<T>(
      field: string,
      currentVal: T,
      newVal: T | undefined,
    ): void {
      if (newVal === undefined) return;
      if (JSON.stringify(currentVal) === JSON.stringify(newVal)) return;
      patch[field] = newVal;
      before[field] = currentVal;
      after[field] = newVal;
      changedFields.push(field);
    }

    diff("matchWeights", current.matchWeights, dto.matchWeights);
    diff("profileWeights", current.profileWeights, dto.profileWeights);
    diff("bandThresholds", current.bandThresholds, dto.bandThresholds);
    diff(
      "biasCategoriesEnabled",
      current.biasCategoriesEnabled,
      dto.biasCategoriesEnabled,
    );
    diff("customFlaggedTerms", current.customFlaggedTerms, dedupedTerms);
    diff("piiFieldsRedacted", current.piiFieldsRedacted, dto.piiFieldsRedacted);
    // piiRedactionEnabled never moves off `true` per the guard above

    if (changedFields.length === 0) {
      throw new BadRequestException({
        code: "NO_CHANGE",
        message: "No fields differ from the current config",
      });
    }

    const updated = await this.repo.update(current.id, patch, actor.id);

    await this.audit.log({
      actorId: actor.id,
      actorType: "user",
      action: AUDIT_ACTIONS.SCORING_CONFIG_UPDATED,
      entityType: "scoring_config",
      entityId: updated.id,
      details: { changedFields, before, after } as Record<string, unknown>,
      ...requestMeta,
    });

    await this.cacheService.bustTag(TAGS.scoringConfigActive());

    this.logger.log(
      `scoring_config updated by ${actor.id}: ${changedFields.join(", ")}`,
    );

    const fresh = await this.repo.getActive();
    if (!fresh) throw new Error("Lost active config after update");
    return this.toDto(fresh);
  }

  // -----------------------------------------------------------------
  // PREVIEW IMPACT (deterministic re-weighting, no AI)
  // -----------------------------------------------------------------

  async previewImpact(dto: PreviewImpactInput): Promise<PreviewImpactDataDto> {
    const samples = await this.repo.sampleRecentMatchScores(dto.sampleSize);

    if (samples.length === 0) {
      const empty = { strong: 0, partial: 0, limited: 0, avgScore: 0 };
      return {
        sampledCount: 0,
        current: { ...empty },
        proposed: { ...empty },
        delta: { ...empty },
        examples: [],
      };
    }

    const current = await this.repo.getActive();
    if (!current) {
      throw new NotFoundException({
        code: "NO_ACTIVE_CONFIG",
        message: "No active scoring config exists",
      });
    }
    const effectiveMatchWeights =
      dto.proposedConfig.matchWeights ?? (current.matchWeights as MatchWeights);
    const effectiveBandThresholds =
      dto.proposedConfig.bandThresholds ??
      (current.bandThresholds as BandThresholds);

    const recomputations = samples.map((s) => {
      const currentScore = s.matchScore.overallScore;
      const currentBand = s.matchScore.band;
      const proposedScore = this.recomputeOverallScore(
        s.matchScore.components,
        effectiveMatchWeights,
      );
      const proposedBand = this.computeBand(
        proposedScore,
        effectiveBandThresholds,
      );

      return {
        sample: s,
        currentScore,
        proposedScore,
        currentBand,
        proposedBand,
        delta: proposedScore - currentScore,
      };
    });

    const currentDist = this.buildDistribution(
      recomputations.map((r) => ({
        score: r.currentScore,
        band: r.currentBand,
      })),
    );
    const proposedDist = this.buildDistribution(
      recomputations.map((r) => ({
        score: r.proposedScore,
        band: r.proposedBand,
      })),
    );

    const delta = {
      strong: proposedDist.strong - currentDist.strong,
      partial: proposedDist.partial - currentDist.partial,
      limited: proposedDist.limited - currentDist.limited,
      avgScore:
        Math.round((proposedDist.avgScore - currentDist.avgScore) * 10) / 10,
    };

    const examples: TopMoverDto[] = recomputations
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, TOP_MOVERS_LIMIT)
      .map((r) => ({
        applicationId: r.sample.matchScore.applicationId,
        candidateName: r.sample.candidate.fullName,
        jobTitle: r.sample.job.title,
        currentScore: r.currentScore,
        proposedScore: r.proposedScore,
        currentBand: r.currentBand,
        proposedBand: r.proposedBand,
      }));

    return {
      sampledCount: samples.length,
      current: currentDist,
      proposed: proposedDist,
      delta,
      examples,
    };
  }

  // -----------------------------------------------------------------
  // PRIVATE
  // -----------------------------------------------------------------

  private recomputeOverallScore(
    componentsRaw: unknown,
    weights: MatchWeights,
  ): number {
    const components =
      (componentsRaw as Array<{
        name: string;
        score: number;
        max: number;
      }>) ?? [];

    let total = 0;
    for (const c of components) {
      const weight = weights[c.name as keyof MatchWeights];
      if (weight === undefined || c.max <= 0) continue;
      const normalized = c.score / c.max;
      total += normalized * weight;
    }
    return Math.round(Math.max(0, Math.min(100, total)));
  }

  private computeBand(
    score: number,
    thresholds: BandThresholds,
  ): "strong" | "partial" | "limited" {
    if (score >= thresholds.strong) return "strong";
    if (score >= thresholds.partial) return "partial";
    return "limited";
  }

  private buildDistribution(rows: Array<{ score: number; band: string }>): {
    strong: number;
    partial: number;
    limited: number;
    avgScore: number;
  } {
    let strong = 0;
    let partial = 0;
    let limited = 0;
    let sum = 0;
    for (const r of rows) {
      sum += r.score;
      if (r.band === "strong") strong++;
      else if (r.band === "partial") partial++;
      else limited++;
    }
    const avgScore =
      rows.length > 0 ? Math.round((sum / rows.length) * 10) / 10 : 0;
    return { strong, partial, limited, avgScore };
  }

  private toDto(row: ScoringConfigWithUpdatedBy): ScoringConfigDto {
    return {
      id: row.id,
      matchWeights: row.matchWeights as ScoringConfigDto["matchWeights"],
      profileWeights: row.profileWeights as ScoringConfigDto["profileWeights"],
      bandThresholds: row.bandThresholds as ScoringConfigDto["bandThresholds"],
      biasCategoriesEnabled: row.biasCategoriesEnabled,
      customFlaggedTerms: row.customFlaggedTerms,
      piiRedactionEnabled: row.piiRedactionEnabled,
      piiFieldsRedacted: row.piiFieldsRedacted,
      updatedBy: row.updatedByProfile,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
