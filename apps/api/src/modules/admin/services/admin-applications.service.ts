import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";
import type { ListAdminApplicationsQuery } from "@aurahire/shared";

import { AdminApplicationsRepository } from "../repositories/admin-applications.repository";
import type {
  AdminApplicationDetailDto,
  AdminApplicationListEnvelopeDto,
  AdminApplicationListRowDto,
  AdminEvidenceDto,
  AdminMatchScoreDto,
  AdminScoreComponentDto,
} from "../dto/admin-application-response.dto";

const LIST_CACHE_TTL_MS = 30_000;

interface ScoreRow {
  id: string;
  overallScore: number;
  band: string;
  components: unknown;
  redactedFields: string[];
  weightsUsed: unknown;
  promptVersion: string;
  modelUsed: string;
  latencyMs: number | null;
  rawOutput: unknown;
  createdAt: Date;
}

interface EvidenceRow {
  componentName: string;
  excerptText: string;
  excerptSource: string | null;
  relevance: string;
  contributionPoints: number | null;
}

@Injectable()
export class AdminApplicationsService {
  constructor(
    private readonly repo: AdminApplicationsRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  // ---------------------------------------------------------------------------
  // LIST
  // ---------------------------------------------------------------------------

  async list(
    query: ListAdminApplicationsQuery,
  ): Promise<AdminApplicationListEnvelopeDto> {
    const cacheKey = this.cacheKey(query);
    const cached =
      await this.cache.get<AdminApplicationListEnvelopeDto>(cacheKey);
    if (cached) return cached;

    const { rows, total } = await this.repo.list({
      jobId: query.jobId,
      candidateId: query.candidateId,
      status: query.status,
      minScore: query.minScore,
      maxScore: query.maxScore,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      q: query.q,
      page: query.page,
      limit: query.limit,
    });

    const data: AdminApplicationListRowDto[] = rows.map((r) => ({
      id: r.application.id,
      status: r.application.status,
      appliedAt: r.application.appliedAt.toISOString(),
      candidate: {
        id: r.candidate.id,
        fullName: r.candidate.fullName,
        email: r.candidate.email,
      },
      job: {
        id: r.job.id,
        title: r.job.title,
        companyName: r.company.name,
        recruiterName: r.recruiter.fullName,
      },
      overallScore: r.matchScore?.overallScore ?? null,
      band: r.matchScore?.band ?? null,
      hasRedactions: (r.matchScore?.redactedFields?.length ?? 0) > 0,
    }));

    const result: AdminApplicationListEnvelopeDto = {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };

    await this.cache.set(cacheKey, result, LIST_CACHE_TTL_MS);
    return result;
  }

  // ---------------------------------------------------------------------------
  // DETAIL
  // ---------------------------------------------------------------------------

  async getById(id: string): Promise<AdminApplicationDetailDto> {
    const application = await this.repo.findApplication(id);
    if (!application) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Application not found",
      });
    }

    const [candidate, job, resume, scoreBundle] = await Promise.all([
      this.repo.findCandidateProfile(application.candidateId),
      this.repo.findJobWithCompanyAndRecruiter(application.jobId),
      this.repo.findResume(application.resumeId),
      this.repo.findMatchScoreByApplicationId(application.id),
    ]);

    if (!candidate)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Candidate missing",
      });
    if (!job)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Job missing",
      });
    if (!resume)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Resume missing",
      });

    const auditTrail = await this.repo.findAuditTrail(
      application.id,
      scoreBundle?.score.id ?? null,
    );

    const matchScoreDto: AdminMatchScoreDto | null = scoreBundle
      ? this.toMatchScoreDto(scoreBundle.score, scoreBundle.evidence)
      : null;

    return {
      id: application.id,
      status: application.status,
      coverLetter: application.coverLetter,
      recruiterNotes: application.recruiterNotes,
      appliedAt: application.appliedAt.toISOString(),
      statusUpdatedAt: application.statusUpdatedAt.toISOString(),
      candidate: {
        id: candidate.id,
        fullName: candidate.fullName,
        email: candidate.email,
        phone: candidate.phone,
        headline: null,
      },
      job: {
        id: job.id,
        title: job.title,
        descriptionPlain: job.descriptionPlain,
        requiredSkills: job.requiredSkills,
        experienceLevel: job.experienceLevel,
        educationRequirement: job.educationRequirement,
        recruiter: job.recruiter,
        company: job.company,
      },
      matchScore: matchScoreDto,
      resume: {
        id: resume.id,
        filename: resume.filename,
        parseStatus: resume.parseStatus,
        parsedData: (resume.parsedData as Record<string, unknown>) ?? null,
        uploadedAt: resume.createdAt.toISOString(),
      },
      auditTrail: auditTrail.map((a) => ({
        id: a.id,
        action: a.action,
        actorType: a.actorType,
        actorId: a.actorId,
        entityType: a.entityType,
        entityId: a.entityId,
        details: a.details,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // PRIVATE
  // ---------------------------------------------------------------------------

  private cacheKey(query: ListAdminApplicationsQuery): string {
    return [
      "admin:applications:list",
      `j=${query.jobId ?? ""}`,
      `c=${query.candidateId ?? ""}`,
      `s=${query.status ?? ""}`,
      `min=${query.minScore ?? ""}`,
      `max=${query.maxScore ?? ""}`,
      `df=${query.dateFrom ?? ""}`,
      `dt=${query.dateTo ?? ""}`,
      `q=${query.q ?? ""}`,
      `p=${query.page}`,
      `l=${query.limit}`,
    ].join("|");
  }

  private toMatchScoreDto(
    score: ScoreRow,
    _evidence: EvidenceRow[],
  ): AdminMatchScoreDto {
    // The components JSONB stores the AI's per-component breakdown shape:
    //   [{ name, score, max, weight, explanation, evidence: [...] }, ...]
    // Evidence inside the JSONB matches what's in evidence_excerpts; we surface
    // the JSONB directly (preserves contribution_points + relevance verbatim).
    const componentsRaw =
      (score.components as Array<{
        name: string;
        score: number;
        max: number;
        weight: number;
        explanation: string;
        evidence: Array<{
          excerpt: string;
          source: string;
          relevance: "positive" | "negative" | "neutral";
          contribution_points: number | null;
        }>;
      }>) ?? [];

    const components: AdminScoreComponentDto[] = componentsRaw.map((c) => ({
      name: c.name,
      score: c.score,
      max: c.max,
      weight: c.weight,
      explanation: c.explanation,
      evidence: (c.evidence ?? []).map<AdminEvidenceDto>((e) => ({
        excerpt: e.excerpt,
        source: e.source ?? null,
        relevance: e.relevance,
        contributionPoints: e.contribution_points,
      })),
    }));

    // Surface raw output's red/green flags + summary (not in components JSONB).
    const raw = score.rawOutput as {
      summary?: string;
      red_flags?: string[] | null;
      green_flags?: string[] | null;
    } | null;

    return {
      id: score.id,
      overallScore: score.overallScore,
      band: score.band,
      components,
      summary: raw?.summary ?? "",
      redFlags: raw?.red_flags ?? null,
      greenFlags: raw?.green_flags ?? null,
      redactedFields: score.redactedFields,
      weightsUsed: (score.weightsUsed as Record<string, unknown>) ?? {},
      promptVersion: score.promptVersion,
      modelUsed: score.modelUsed,
      latencyMs: score.latencyMs,
      rawOutput: (score.rawOutput as Record<string, unknown>) ?? {},
      createdAt: score.createdAt.toISOString(),
    };
  }
}
