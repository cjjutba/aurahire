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

    const [
      totalUsers,
      activeJobs,
      applicationsToday,
      applicationsThisWeek,
      avgProfileScore,
      avgMatchScore,
      scoreBandHistogram,
      biasFlagsThisWeek,
      recentAuditEvents,
    ] = await Promise.all([
      this.repo.countUsers(),
      this.repo.countActiveJobs(),
      this.repo.countApplicationsSince(todayStart),
      this.repo.countApplicationsSince(weekStart),
      this.repo.avgProfileScore(),
      this.repo.avgMatchScore(),
      this.repo.scoreBandHistogram(30),
      this.repo.biasFlagsThisWeek(),
      this.repo.recentAuditEvents(10),
    ]);

    const result: AdminStatsOverviewDto = {
      totalUsers: this.block("Total Users", totalUsers),
      activeJobs: this.block("Active Jobs", activeJobs),
      applicationsToday: this.block("Apps Today", applicationsToday),
      applicationsThisWeek: this.block("Apps This Week", applicationsThisWeek),
      avgProfileScore: this.block("Avg Profile Score", avgProfileScore),
      avgMatchScore: this.block("Avg Match Score", avgMatchScore),
      scoreBandHistogram: scoreBandHistogram as ScoreBandHistogramEntryDto[],
      biasFlagsThisWeek: biasFlagsThisWeek as BiasCategoryBreakdownDto[],
      recentAuditEvents: recentAuditEvents.map((r) => ({
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
