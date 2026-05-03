import { Inject, Injectable } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";
import type { BiasMonitorQuery } from "@aurahire/shared";

import { AdminBiasMonitorRepository } from "../repositories/admin-bias-monitor.repository";
import type {
  BiasMonitorBundleDto,
  FlagsByCategoryDto,
  ScoreBandSliceDto,
} from "../dto/bias-monitor-response.dto";

const CACHE_TTL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_TERMS_LIMIT = 10;
const RECENT_OVERRIDES_LIMIT = 10;

@Injectable()
export class AdminBiasMonitorService {
  constructor(
    private readonly repo: AdminBiasMonitorRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async overview(query: BiasMonitorQuery): Promise<BiasMonitorBundleDto> {
    const to = query.dateTo ? new Date(query.dateTo) : new Date();
    const from = query.dateFrom
      ? new Date(query.dateFrom)
      : new Date(to.getTime() - 30 * DAY_MS);

    const cacheKey = `admin:bias-monitor:${from.toISOString()}|${to.toISOString()}`;
    const cached = await this.cache.get<BiasMonitorBundleDto>(cacheKey);
    if (cached) return cached;

    const [
      flagCounts,
      publishedJobs,
      flagsByCategoryRaw,
      topTerms,
      scoreDistRaw,
      overrides,
      sampleSize,
    ] = await Promise.all([
      this.repo.countFlagsInRange(from, to),
      this.repo.countPublishedJobsInRange(from, to),
      this.repo.flagsByCategory(from, to),
      this.repo.topFlaggedTerms(from, to, TOP_TERMS_LIMIT),
      this.repo.scoreDistributionByBand(from, to),
      this.repo.recentOverrides(from, to, RECENT_OVERRIDES_LIMIT),
      this.repo.sampleSize(from, to),
    ]);

    const total = flagCounts.total;
    const overridden = flagCounts.overridden;
    const resolved = flagCounts.resolved;
    const decided = overridden + resolved;

    const kpis = {
      totalFlags: total,
      flagsPerJob:
        publishedJobs > 0
          ? Math.round((total / publishedJobs) * 100) / 100
          : 0,
      flagsResolvedPct: total > 0 ? Math.round((resolved / total) * 100) : 0,
      overrideRate:
        decided > 0 ? Math.round((overridden / decided) * 100) : 0,
    };

    const flagsByCategory: FlagsByCategoryDto[] = flagsByCategoryRaw.map((r) => ({
      category: r.category,
      count: r.count,
      pct: total > 0 ? Math.round((r.count / total) * 100) : 0,
    }));

    const scoreTotal = scoreDistRaw.reduce((s, r) => s + r.count, 0);
    const scoreMap = new Map(scoreDistRaw.map((r) => [r.band, r.count]));
    const scoreDistributionByBand: ScoreBandSliceDto[] = (
      ["strong", "partial", "limited"] as const
    ).map((band) => {
      const count = scoreMap.get(band) ?? 0;
      return {
        band,
        count,
        pct: scoreTotal > 0 ? Math.round((count / scoreTotal) * 100) : 0,
      };
    });

    const recentOverrides = overrides.map((o) => ({
      flagId: o.flagId,
      term: o.term,
      category: o.category,
      jobId: o.jobId,
      jobTitle: o.jobTitle,
      overriddenBy: o.overriddenBy,
      overrideReason: o.overrideReason,
      overriddenAt: o.overriddenAt.toISOString(),
    }));

    const bundle: BiasMonitorBundleDto = {
      range: { from: from.toISOString(), to: to.toISOString() },
      kpis,
      flagsByCategory,
      topFlaggedTerms: topTerms,
      scoreDistributionByBand,
      recentOverrides,
      sampleSize,
    };

    await this.cache.set(cacheKey, bundle, CACHE_TTL_MS);
    return bundle;
  }
}
