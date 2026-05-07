import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { AuthUser } from "@aurahire/shared";
import type { BiasFlag } from "@aurahire/db";

import { AuditService } from "../../audit";
import { DetectBiasService } from "../../ai/detect-bias.service";
import { EventsService } from "../../realtime";
import { JobsRepository } from "../jobs/jobs.repository";
import { ScoringRepository } from "../scoring/scoring.repository";
import { BiasRepository } from "./bias.repository";
import type {
  BiasFlagDto,
  CheckBiasResponseBodyDto,
} from "./dto/bias-response.dto";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_CALLS = 10;

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class BiasService {
  private readonly logger = new Logger(BiasService.name);
  private readonly rateLimitTracker = new Map<string, number[]>();

  constructor(
    private readonly detectBias: DetectBiasService,
    private readonly biasRepo: BiasRepository,
    private readonly jobsRepo: JobsRepository,
    private readonly scoringRepo: ScoringRepository,
    private readonly audit: AuditService,
    private readonly events: EventsService,
  ) {}

  // -----------------------------------------------------------------
  // STATELESS PREVIEW (used by debounced editor)
  // -----------------------------------------------------------------

  async check(
    user: AuthUser,
    text: string,
    customTermsOverride: string[] | undefined,
  ): Promise<CheckBiasResponseBodyDto> {
    if (user.role !== "recruiter" && user.role !== "admin") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter or admin role required",
      });
    }

    this.assertRateLimit(user.id);

    const customTerms =
      customTermsOverride ?? (await this.loadCustomFlaggedTerms());

    const result = await this.detectBias.check({
      text,
      customFlaggedTerms: customTerms,
      requestId: `bias-check:${user.id}`,
    });

    return {
      flags: result.flags.map((f) => ({
        term: f.term,
        category: f.category,
        severity: f.severity,
        explanation: f.explanation,
        suggestion: f.suggestion,
        positionStart: f.position_start,
        positionEnd: f.position_end,
      })),
      latencyMs: result.latencyMs,
      promptVersion: result.promptVersion,
      modelUsed: result.model,
    };
  }

  // -----------------------------------------------------------------
  // STATEFUL SCAN (persists into bias_flags)
  // -----------------------------------------------------------------

  async scanJob(
    user: AuthUser,
    companyId: string,
    jobId: string,
    requestMeta: RequestMeta = {},
  ): Promise<BiasFlagDto[]> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }

    const job = await this.jobsRepo.findById(jobId);
    if (!job || job.companyId !== companyId) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Job not found" });
    }

    const customTerms = await this.loadCustomFlaggedTerms();

    const aiResult = await this.detectBias.check({
      text: job.descriptionPlain,
      customFlaggedTerms: customTerms,
      requestId: `bias-scan:${jobId}`,
    });

    await this.biasRepo.deleteFlaggedByJobId(jobId);

    const newRows = aiResult.flags.map((f) => ({
      jobId,
      term: f.term,
      category: f.category,
      severity: f.severity,
      suggestion: f.suggestion,
      positionStart: f.position_start,
      positionEnd: f.position_end,
      status: "flagged" as const,
      promptVersion: aiResult.promptVersion,
      modelUsed: aiResult.model,
    }));

    const inserted = await this.biasRepo.insertMany(newRows);

    for (const row of inserted) {
      this.events.emitBiasFlagCreated({
        flagId: row.id,
        jobId: row.jobId,
        term: row.term,
        category: row.category,
        createdAt:
          row.createdAt instanceof Date
            ? row.createdAt.toISOString()
            : new Date(row.createdAt).toISOString(),
      });
    }

    const explanationByTerm = new Map(
      aiResult.flags.map((f) => [f.term.toLowerCase(), f.explanation]),
    );

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "job.bias_check_run",
      entityType: "job",
      entityId: jobId,
      companyId,
      details: {
        flagCount: inserted.length,
        categories: inserted.map((r) => r.category),
        promptVersion: aiResult.promptVersion,
        model: aiResult.model,
        latencyMs: aiResult.latencyMs,
      },
      ...requestMeta,
    });

    return inserted.map((row) =>
      this.toDto(row, explanationByTerm.get(row.term.toLowerCase()) ?? null),
    );
  }

  // -----------------------------------------------------------------
  // OVERRIDE
  // -----------------------------------------------------------------

  async override(
    user: AuthUser,
    companyId: string,
    jobId: string,
    flagId: string,
    reason: string,
    requestMeta: RequestMeta = {},
  ): Promise<BiasFlagDto> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }

    const job = await this.jobsRepo.findById(jobId);
    if (!job || job.companyId !== companyId) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Job not found" });
    }

    const flag = await this.biasRepo.findById(flagId);
    if (!flag || flag.jobId !== jobId) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Flag not found" });
    }

    if (flag.status !== "flagged") {
      throw new BadRequestException({
        code: "FLAG_NOT_OVERRIDABLE",
        message: `Flag status is '${flag.status}', cannot override`,
      });
    }

    const updated = await this.biasRepo.markOverridden(flagId, user.id, reason);

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "bias_flag.overridden",
      entityType: "bias_flag",
      entityId: flagId,
      companyId,
      details: {
        jobId,
        term: flag.term,
        category: flag.category,
        reasonSnippet: reason.slice(0, 200),
      },
      ...requestMeta,
    });

    return this.toDto(updated, null);
  }

  // -----------------------------------------------------------------
  // LIST
  // -----------------------------------------------------------------

  async listForJob(
    user: AuthUser,
    companyId: string | null,
    jobId: string,
  ): Promise<BiasFlagDto[]> {
    if (user.role !== "recruiter" && user.role !== "admin") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter or admin role required",
      });
    }

    const job = await this.jobsRepo.findById(jobId);
    if (!job) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Job not found" });
    }
    // Recruiters scope to their active company; admins (companyId === null)
    // bypass the tenant check since they act across tenants.
    if (user.role === "recruiter" && job.companyId !== companyId) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Job not found" });
    }

    const rows = await this.biasRepo.findByJobId(jobId);
    return rows.map((row) => this.toDto(row, null));
  }

  // -----------------------------------------------------------------
  // INTERNAL: used by JobsService.publish() to gate
  // -----------------------------------------------------------------

  async findFlagged(jobId: string): Promise<BiasFlagDto[]> {
    const rows = await this.biasRepo.findFlagged(jobId);
    return rows.map((row) => this.toDto(row, null));
  }

  // -----------------------------------------------------------------
  // PRIVATE
  // -----------------------------------------------------------------

  private async loadCustomFlaggedTerms(): Promise<string[]> {
    const config = await this.scoringRepo.getActiveConfig();
    return config?.customFlaggedTerms ?? [];
  }

  private assertRateLimit(userId: string): void {
    const now = Date.now();
    const calls = this.rateLimitTracker.get(userId) ?? [];
    const recentCalls = calls.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recentCalls.length >= RATE_LIMIT_MAX_CALLS) {
      throw new HttpException(
        {
          code: "RATE_LIMITED",
          message: "Too many bias checks; slow down",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recentCalls.push(now);
    this.rateLimitTracker.set(userId, recentCalls);
  }

  private toDto(row: BiasFlag, explanation: string | null): BiasFlagDto {
    return {
      id: row.id,
      jobId: row.jobId,
      term: row.term,
      category: row.category,
      severity: row.severity,
      suggestion: row.suggestion,
      positionStart: row.positionStart,
      positionEnd: row.positionEnd,
      status: row.status,
      overrideReason: row.overrideReason,
      overriddenBy: row.overriddenBy,
      overriddenAt: row.overriddenAt ? row.overriddenAt.toISOString() : null,
      promptVersion: row.promptVersion,
      modelUsed: row.modelUsed,
      createdAt: row.createdAt.toISOString(),
      explanation,
    };
  }
}
