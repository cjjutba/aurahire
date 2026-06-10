import { Inject, Injectable } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";
import type { AnalyticsQuery } from "@aurahire/shared";

import { AdminAnalyticsRepository } from "../repositories/admin-analytics.repository";
import type {
  AnalyticsBundleDto,
  AnalyticsChartsDto,
  AnalyticsKpisDto,
} from "../dto/analytics-response.dto";

const CACHE_TTL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AdminAnalyticsService {
  constructor(
    private readonly repo: AdminAnalyticsRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async overview(query: AnalyticsQuery): Promise<AnalyticsBundleDto> {
    const to = query.dateTo ? new Date(query.dateTo) : new Date();
    const from = query.dateFrom
      ? new Date(query.dateFrom)
      : new Date(to.getTime() - 30 * DAY_MS);

    const cacheKey = `admin:analytics:${from.toISOString()}|${to.toISOString()}`;
    const cached = await this.cache.get<AnalyticsBundleDto>(cacheKey);
    if (cached) return cached;

    const periodMs = to.getTime() - from.getTime();
    const periodDays = Math.max(1, periodMs / DAY_MS);

    const [
      totalUsers,
      newUsersThisPeriod,
      activeJobs,
      apsInPeriod,
      timeToHire,
    ] = await Promise.all([
      this.repo.totalUsers(),
      this.repo.newUsersInRange(from, to),
      this.repo.activeJobs(),
      this.repo.applicationsCountInRange(from, to),
      this.repo.medianTimeToHireDays(from, to),
    ]);

    const priorTotal = totalUsers - newUsersThisPeriod;
    const growthPct =
      priorTotal > 0
        ? Math.round((newUsersThisPeriod / priorTotal) * 1000) / 10
        : 0;
    const avgApplicationsPerDay =
      Math.round((apsInPeriod / periodDays) * 10) / 10;

    const kpis: AnalyticsKpisDto = {
      totalUsers,
      newUsersThisPeriod,
      growthPct,
      activeJobs,
      avgApplicationsPerDay,
      avgTimeToHireDays: timeToHire,
    };

    const [userGrowthRows, jobsRows, appsRows, scoreDist, aiProc, topRec] =
      await Promise.all([
        this.repo.userGrowthByDay(from, to),
        this.repo.jobsByDay(from, to),
        this.repo.applicationsByDay(from, to),
        this.repo.scoreDistribution(from, to),
        this.repo.aiProcessingTimeByDay(from, to),
        this.repo.topRecruiters(10),
      ]);

    const charts: AnalyticsChartsDto = {
      userGrowth: this.pivotByRole(userGrowthRows),
      jobsOverTime: this.pivotByJobStatus(jobsRows),
      applicationsByStatus: this.pivotByApplicationStatus(appsRows),
      scoreDistribution: this.fillBuckets(scoreDist),
      aiProcessingTime: aiProc,
      topRecruiters: topRec,
    };

    const bundle: AnalyticsBundleDto = {
      range: { from: from.toISOString(), to: to.toISOString() },
      kpis,
      charts,
    };

    await this.cache.set(cacheKey, bundle, CACHE_TTL_MS);
    return bundle;
  }

  // -----------------------------------------------------------------
  // PRIVATE - pivots from "long" SQL output to "wide" chart shape
  // -----------------------------------------------------------------

  private pivotByRole(
    rows: Array<{ date: string; role: string; count: number }>,
  ): Array<{
    date: string;
    candidate: number;
    recruiter: number;
    admin: number;
  }> {
    const byDate = new Map<
      string,
      { candidate: number; recruiter: number; admin: number }
    >();
    for (const r of rows) {
      const entry = byDate.get(r.date) ?? {
        candidate: 0,
        recruiter: 0,
        admin: 0,
      };
      if (r.role === "candidate") entry.candidate = r.count;
      else if (r.role === "recruiter") entry.recruiter = r.count;
      else if (r.role === "admin") entry.admin = r.count;
      byDate.set(r.date, entry);
    }
    return Array.from(byDate.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private pivotByJobStatus(
    rows: Array<{ date: string; status: string; count: number }>,
  ): Array<{
    date: string;
    draft: number;
    published: number;
    archived: number;
  }> {
    const byDate = new Map<
      string,
      { draft: number; published: number; archived: number }
    >();
    for (const r of rows) {
      const entry = byDate.get(r.date) ?? {
        draft: 0,
        published: 0,
        archived: 0,
      };
      if (r.status === "draft") entry.draft = r.count;
      else if (r.status === "published") entry.published = r.count;
      else if (r.status === "archived") entry.archived = r.count;
      byDate.set(r.date, entry);
    }
    return Array.from(byDate.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private pivotByApplicationStatus(
    rows: Array<{ date: string; status: string; count: number }>,
  ): Array<{
    date: string;
    applied: number;
    interview: number;
    offer: number;
    hired: number;
    rejected: number;
    withdrawn: number;
  }> {
    // Per thesis panel revision (May 2026): "screening" stage removed.
    const STATUSES = [
      "applied",
      "interview",
      "offer",
      "hired",
      "rejected",
      "withdrawn",
    ] as const;
    type StatusKey = (typeof STATUSES)[number];
    const empty = (): Record<StatusKey, number> =>
      Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<
        StatusKey,
        number
      >;
    const byDate = new Map<string, Record<StatusKey, number>>();
    for (const r of rows) {
      const entry = byDate.get(r.date) ?? empty();
      if ((STATUSES as readonly string[]).includes(r.status)) {
        entry[r.status as StatusKey] = r.count;
      }
      byDate.set(r.date, entry);
    }
    return Array.from(byDate.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private fillBuckets(
    rows: Array<{ bucket: string; count: number }>,
  ): Array<{ bucket: string; count: number }> {
    const order = [
      "0-9",
      "10-19",
      "20-29",
      "30-39",
      "40-49",
      "50-59",
      "60-69",
      "70-79",
      "80-89",
      "90-100",
    ];
    const map = new Map(rows.map((r) => [r.bucket, r.count]));
    return order.map((b) => ({ bucket: b, count: map.get(b) ?? 0 }));
  }
}
