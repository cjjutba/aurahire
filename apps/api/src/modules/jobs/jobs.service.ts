import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  forwardRef,
} from "@nestjs/common";
import type { AuthUser } from "@aurahire/shared";

import { CacheService, TTL_SECONDS, TAGS } from "../../cache";
import { AuditService } from "../../audit";
import { ProfilesRepository } from "../profiles/profiles.repository";
import { BiasService } from "../bias/bias.service";
import {
  JobsRepository,
  type JobWithCompany,
  type ListJobsFilters,
  type JobStats,
} from "./jobs.repository";
import type { CreateJobDto } from "./dto/create-job.dto";
import type { UpdateJobDto } from "./dto/update-job.dto";
import type { ListJobsQueryDto } from "./dto/list-jobs-query.dto";
import type { JobResponseDto } from "./dto/job-response.dto";

@Injectable()
export class JobsService {
  constructor(
    private readonly repo: JobsRepository,
    private readonly profilesRepo: ProfilesRepository,
    @Inject(forwardRef(() => BiasService))
    private readonly biasService: BiasService,
    private readonly audit: AuditService,
    private readonly cacheService: CacheService,
  ) {}

  // ---------------------------------------------------------------- CREATE

  async create(
    user: AuthUser,
    companyId: string,
    dto: CreateJobDto,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<JobResponseDto> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }

    const recruiterProfile = await this.profilesRepo.findRecruiterProfile(
      user.id,
    );
    if (!recruiterProfile) {
      throw new BadRequestException({
        code: "RECRUITER_PROFILE_MISSING",
        message: "Complete onboarding before posting jobs",
      });
    }
    if (!recruiterProfile.profileCompleted) {
      throw new BadRequestException({
        code: "ONBOARDING_INCOMPLETE",
        message: "Finish onboarding before posting jobs",
      });
    }

    // recruiter_id is kept on jobs as audit trail (the *creator*); company_id
    // is the access-control axis. ActiveCompanyGuard already verified that
    // the caller is an active member of `companyId`, so no further check.
    const job = await this.repo.insert({
      recruiterId: user.id,
      companyId,
      title: dto.title,
      department: dto.department ?? null,
      employmentType: dto.employmentType,
      workMode: dto.workMode,
      locationCity: dto.locationCity ?? null,
      locationRegion: dto.locationRegion ?? null,
      locationCountry: dto.locationCountry ?? null,
      salaryMin: dto.salaryMin != null ? String(dto.salaryMin) : null,
      salaryMax: dto.salaryMax != null ? String(dto.salaryMax) : null,
      salaryCurrency: dto.salaryCurrency,
      description: dto.description,
      descriptionPlain: dto.descriptionPlain,
      requiredSkills: dto.requiredSkills,
      experienceLevel: dto.experienceLevel,
      educationRequirement: dto.educationRequirement ?? null,
      applicationDeadline: dto.applicationDeadline ?? null,
      status: "draft",
    });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "job.created",
      entityType: "job",
      entityId: job.id,
      companyId,
      details: { title: job.title },
      ...requestMeta,
    });

    await this.invalidateAfterWrite({ companyId, jobId: job.id });

    // Atomic create-and-publish: if the recruiter requested immediate
    // publish, transition the job in the same request. On bias-flag failure
    // publish() throws 422 with the flags; we let that propagate (the job
    // stays as a draft so the recruiter can resolve flags and retry).
    if (dto.publishImmediately) {
      return this.publish(user, companyId, job.id, requestMeta);
    }

    return this.toResponse(await this.requireJobWithCompany(job.id));
  }

  // ---------------------------------------------------------------- UPDATE

  async update(
    user: AuthUser,
    companyId: string,
    id: string,
    dto: UpdateJobDto,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<JobResponseDto> {
    await this.assertCompanyOwnership(companyId, id);

    const patch: Partial<Parameters<JobsRepository["update"]>[1]> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.department !== undefined) patch.department = dto.department ?? null;
    if (dto.employmentType !== undefined)
      patch.employmentType = dto.employmentType;
    if (dto.workMode !== undefined) patch.workMode = dto.workMode;
    if (dto.locationCity !== undefined)
      patch.locationCity = dto.locationCity ?? null;
    if (dto.locationRegion !== undefined)
      patch.locationRegion = dto.locationRegion ?? null;
    if (dto.locationCountry !== undefined)
      patch.locationCountry = dto.locationCountry ?? null;
    if (dto.salaryMin !== undefined)
      patch.salaryMin = dto.salaryMin != null ? String(dto.salaryMin) : null;
    if (dto.salaryMax !== undefined)
      patch.salaryMax = dto.salaryMax != null ? String(dto.salaryMax) : null;
    if (dto.salaryCurrency !== undefined)
      patch.salaryCurrency = dto.salaryCurrency;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.descriptionPlain !== undefined)
      patch.descriptionPlain = dto.descriptionPlain;
    if (dto.requiredSkills !== undefined)
      patch.requiredSkills = dto.requiredSkills;
    if (dto.experienceLevel !== undefined)
      patch.experienceLevel = dto.experienceLevel;
    if (dto.educationRequirement !== undefined)
      patch.educationRequirement = dto.educationRequirement ?? null;
    if (dto.applicationDeadline !== undefined)
      patch.applicationDeadline = dto.applicationDeadline ?? null;

    await this.repo.update(id, patch);

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "job.updated",
      entityType: "job",
      entityId: id,
      companyId,
      ...requestMeta,
    });

    await this.invalidateAfterWrite({ companyId, jobId: id });

    return this.toResponse(await this.requireJobWithCompany(id));
  }

  // ---------------------------------------------------- PUBLISH / ARCHIVE

  async publish(
    user: AuthUser,
    companyId: string,
    id: string,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<JobResponseDto> {
    const job = await this.assertCompanyOwnership(companyId, id);

    if (job.status !== "draft") {
      throw new BadRequestException({
        code: "INVALID_STATUS_TRANSITION",
        message: `Cannot publish a job in status '${job.status}'`,
      });
    }

    // Run a fresh bias scan; persists into bias_flags
    await this.biasService.scanJob(user, companyId, id, requestMeta);

    // Severity-aware gate: only medium/high bias flags block publish.
    // Low-severity flags are informational - they persist into bias_flags for
    // the audit trail and surface in the editor preview, but the recruiter
    // can publish without an override. This matches the "info / warning /
    // error" calibration in the v1.2.0 prompt: low = soft phrasing in
    // friendly context, medium/high = established coded language with
    // documented exclusionary effect.
    const unresolved = await this.biasService.findFlagged(id);
    const gating = unresolved.filter(
      (f) => f.severity === "medium" || f.severity === "high",
    );
    if (gating.length > 0) {
      throw new UnprocessableEntityException({
        code: "BIAS_CHECK_REQUIRED",
        message: `${gating.length} bias flag${gating.length === 1 ? "" : "s"} require${gating.length === 1 ? "s" : ""} override or edit before publish`,
        flags: gating,
      });
    }

    await this.repo.update(id, {
      status: "published",
      publishedAt: new Date(),
    });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "job.published",
      entityType: "job",
      entityId: id,
      companyId,
      ...requestMeta,
    });

    await this.invalidateAfterWrite({ companyId, jobId: id });

    return this.toResponse(await this.requireJobWithCompany(id));
  }

  async archive(
    user: AuthUser,
    companyId: string,
    id: string,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<JobResponseDto> {
    await this.assertCompanyOwnership(companyId, id);

    await this.repo.update(id, { status: "archived" });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "job.archived",
      entityType: "job",
      entityId: id,
      companyId,
      ...requestMeta,
    });

    await this.invalidateAfterWrite({ companyId, jobId: id });

    return this.toResponse(await this.requireJobWithCompany(id));
  }

  // -------------------------------------------- PUBLIC LIST + DETAIL (cached)

  async listPublic(query: ListJobsQueryDto): Promise<{
    data: JobResponseDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const cacheKey = `jobs:public:list:${this.serializeQuery(query)}`;
    return this.cacheService.getOrSet({
      key: cacheKey,
      ttlSeconds: TTL_SECONDS.hot,
      tags: [TAGS.jobsPublic()],
      telemetryName: "jobs:public:list",
      load: async () => {
        const filters: ListJobsFilters = {
          q: query.q,
          mode: query.mode,
          experienceLevel: query.experienceLevel,
          locationCountry: query.locationCountry,
          status: "published",
          sort: query.sort === "recent-activity" ? "recent" : query.sort,
          page: query.page,
          limit: query.limit,
        };
        const { rows, total } = await this.repo.list(filters);
        return {
          data: rows.map((r) => this.toResponse(r)),
          meta: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / query.limit)),
          },
        };
      },
    });
  }

  async getPublic(id: string): Promise<JobResponseDto> {
    return this.cacheService.getOrSet<JobResponseDto>({
      key: `jobs:public:detail:${id}`,
      ttlSeconds: TTL_SECONDS.hot,
      tags: [TAGS.jobsPublic(), TAGS.jobDetail(id)],
      telemetryName: "jobs:public:detail",
      load: async () => {
        const row = await this.repo.findByIdWithCompany(id);
        if (!row || row.status !== "published") {
          throw new NotFoundException({
            code: "NOT_FOUND",
            message: "Job not found",
          });
        }
        return this.toResponse(row);
      },
    });
  }

  // ---------------------------------- RECRUITER LIST + DETAIL (active company)

  async listForActiveCompany(
    user: AuthUser,
    companyId: string,
    query: ListJobsQueryDto,
  ): Promise<{
    data: JobResponseDto[] | (JobResponseDto & { stats: JobStats })[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }

    const cacheKey = `jobs:company:${companyId}:list:${this.serializeQuery(query)}:inc=${query.include ?? "none"}`;

    return this.cacheService.getOrSet({
      key: cacheKey,
      ttlSeconds: TTL_SECONDS.hot,
      tags: [TAGS.companyJobs(companyId)],
      telemetryName: "jobs:company:list",
      load: async () => {
        if (query.include === "stats") {
          const sort: "recent" | "recent-activity" =
            query.sort === "recent-activity" ? "recent-activity" : "recent";
          const { rows, total } = await this.repo.listForCompanyWithStats(
            companyId,
            {
              page: query.page,
              limit: query.limit,
              status: query.status,
              sort,
            },
          );
          return {
            data: rows.map((r) => ({ ...this.toResponse(r), stats: r.stats })),
            meta: {
              page: query.page,
              limit: query.limit,
              total,
              totalPages: Math.max(1, Math.ceil(total / query.limit)),
            },
          };
        }
        const filters: ListJobsFilters = {
          q: query.q,
          mode: query.mode,
          experienceLevel: query.experienceLevel,
          locationCountry: query.locationCountry,
          sort: query.sort === "recent-activity" ? "recent" : query.sort,
          page: query.page,
          limit: query.limit,
          companyId,
          status: query.status,
        };
        const { rows, total } = await this.repo.list(filters);
        return {
          data: rows.map((r) => this.toResponse(r)),
          meta: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / query.limit)),
          },
        };
      },
    });
  }

  async getForRecruiter(
    user: AuthUser,
    companyId: string,
    id: string,
  ): Promise<JobResponseDto> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }
    const row = await this.assertCompanyOwnership(companyId, id);
    const withCompany = await this.repo.findByIdWithCompany(row.id);
    if (!withCompany) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Job not found",
      });
    }
    return this.toResponse(withCompany);
  }

  // ---------------------------------------------------- CANDIDATE LIST + DETAIL
  // Sprint = same shape as public; Slice 2.6 enriches with match score.

  async listForCandidate(
    user: AuthUser,
    query: ListJobsQueryDto,
  ): Promise<ReturnType<JobsService["listPublic"]>> {
    // When the candidate requests excludeApplied, we need a candidate-specific
    // cache key (keyed by user.id) so two candidates don't share the same
    // cached list. We also tag with applicationsCandidate so that when the
    // candidate applies to a new job their cached list is busted immediately.
    const excludeCandidateApplied = query.excludeApplied ? user.id : undefined;
    const cacheKey = excludeCandidateApplied
      ? `jobs:candidate:list:${excludeCandidateApplied}:${this.serializeQuery(query)}`
      : `jobs:public:list:${this.serializeQuery(query)}`;
    const tags = excludeCandidateApplied
      ? [TAGS.jobsPublic(), TAGS.applicationsCandidate(user.id)]
      : [TAGS.jobsPublic()];

    return this.cacheService.getOrSet({
      key: cacheKey,
      ttlSeconds: TTL_SECONDS.hot,
      tags,
      telemetryName: "jobs:candidate:list",
      load: async () => {
        const filters: ListJobsFilters = {
          q: query.q,
          mode: query.mode,
          experienceLevel: query.experienceLevel,
          locationCountry: query.locationCountry,
          status: "published",
          sort: query.sort === "recent-activity" ? "recent" : query.sort,
          page: query.page,
          limit: query.limit,
          excludeCandidateApplied,
        };
        const { rows, total } = await this.repo.list(filters);
        return {
          data: rows.map((r) => this.toResponse(r)),
          meta: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / query.limit)),
          },
        };
      },
    });
  }

  async getForCandidate(id: string): Promise<JobResponseDto> {
    return this.getPublic(id);
  }

  // -------------------------------------------------------------- PRIVATE

  /**
   * Verify a job exists AND belongs to the active company. The
   * `ActiveCompanyGuard` already verified the caller is a member of
   * `companyId`; this check stops members of *other* companies from
   * reaching jobs they don't own. NotFound (not Forbidden) so we don't
   * leak the existence of jobs in other tenants.
   */
  private async assertCompanyOwnership(companyId: string, id: string) {
    const job = await this.repo.findById(id);
    if (!job || job.companyId !== companyId) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Job not found",
      });
    }
    return job;
  }

  private async requireJobWithCompany(id: string): Promise<JobWithCompany> {
    const row = await this.repo.findByIdWithCompany(id);
    if (!row) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Job not found",
      });
    }
    return row;
  }

  private async invalidateAfterWrite(opts: {
    companyId: string;
    jobId?: string;
  }): Promise<void> {
    const tags: string[] = [
      TAGS.jobsPublic(),
      TAGS.companyJobs(opts.companyId),
    ];
    if (opts.jobId) tags.push(TAGS.jobDetail(opts.jobId));
    await this.cacheService.bustTags(tags);
  }

  private serializeQuery(q: ListJobsQueryDto): string {
    return [
      `p=${q.page}`,
      `l=${q.limit}`,
      `q=${q.q ?? ""}`,
      `m=${q.mode ?? ""}`,
      `e=${q.experienceLevel ?? ""}`,
      `c=${q.locationCountry ?? ""}`,
      `s=${q.sort ?? "recent"}`,
      `xa=${q.excludeApplied ? "1" : "0"}`,
    ].join("|");
  }

  private toResponse(row: JobWithCompany): JobResponseDto {
    return {
      id: row.id,
      title: row.title,
      department: row.department,
      employmentType: row.employmentType,
      workMode: row.workMode,
      locationCity: row.locationCity,
      locationRegion: row.locationRegion,
      locationCountry: row.locationCountry,
      salaryMin: row.salaryMin != null ? Number(row.salaryMin) : null,
      salaryMax: row.salaryMax != null ? Number(row.salaryMax) : null,
      salaryCurrency: row.salaryCurrency ?? "USD",
      description: row.description,
      descriptionPlain: row.descriptionPlain,
      requiredSkills: row.requiredSkills,
      experienceLevel: row.experienceLevel,
      educationRequirement: row.educationRequirement,
      applicationDeadline: row.applicationDeadline
        ? row.applicationDeadline.toString()
        : null,
      status: row.status,
      viewCount: row.viewCount,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      company: {
        id: row.company.id,
        name: row.company.name,
        industry: row.company.industry,
        logoUrl: row.company.logoUrl,
      },
    };
  }
}
