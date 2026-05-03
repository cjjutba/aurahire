import { Inject, Injectable } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";

import { AdminStatsRepository } from "../repositories/admin-stats.repository";
import type {
  AdminStatBlockDto,
  AdminStatsOverviewDto,
  BiasCategoryBreakdownDto,
  RecentAuditEntryDto,
  ScoreBandHistogramEntryDto,
} from "../dto/admin-stats-response.dto";

const STATS_CACHE_TTL_MS = 60_000;
const STATS_CACHE_KEY = "admin:stats:overview";
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AdminStatsService {
  constructor(
    private readonly repo: AdminStatsRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async overview(): Promise<AdminStatsOverviewDto> {
    const cached = await this.cache.get<AdminStatsOverviewDto>(STATS_CACHE_KEY);
    if (cached) return cached;

    const now = Date.now();
    const todayStart = new Date(now - (now % DAY_MS));
    const weekStart = new Date(now - 7 * DAY_MS);

    const snapshot = await this.repo.overview({
      todayStart,
      weekStart,
      histogramSinceDays: 30,
      auditLimit: 10,
    });

    const result: AdminStatsOverviewDto = {
      totalUsers: this.block("Total Users", snapshot.totalUsers),
      activeJobs: this.block("Active Jobs", snapshot.activeJobs),
      applicationsToday: this.block("Apps Today", snapshot.applicationsToday),
      applicationsThisWeek: this.block(
        "Apps This Week",
        snapshot.applicationsThisWeek,
      ),
      avgProfileScore: this.block(
        "Avg Profile Score",
        snapshot.avgProfileScore,
      ),
      avgMatchScore: this.block("Avg Match Score", snapshot.avgMatchScore),
      scoreBandHistogram:
        snapshot.scoreBandHistogram as ScoreBandHistogramEntryDto[],
      biasFlagsThisWeek:
        snapshot.biasFlagsThisWeek as BiasCategoryBreakdownDto[],
      recentAuditEvents: snapshot.recentAuditEvents.map((r) => ({
        action: r.action,
        actorType: r.actorType,
        entityType: r.entityType,
        createdAt: r.createdAt.toISOString(),
      })) as RecentAuditEntryDto[],
    };

    await this.cache.set(STATS_CACHE_KEY, result, STATS_CACHE_TTL_MS);
    return result;
  }

  private block(label: string, value: number): AdminStatBlockDto {
    return { label, value, trend: null };
  }
}
