import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  forwardRef,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";
import type { AuthUser } from "@aurahire/shared";

import { AuditService } from "../../audit";
import { ProfilesRepository } from "../profiles/profiles.repository";
import { BiasService } from "../bias/bias.service";
import { JobsRepository, type JobWithCompany, type ListJobsFilters, type JobStats } from "./jobs.repository";
import type { CreateJobDto } from "./dto/create-job.dto";
import type { UpdateJobDto } from "./dto/update-job.dto";
import type { ListJobsQueryDto } from "./dto/list-jobs-query.dto";
import type { JobResponseDto } from "./dto/job-response.dto";

const PUBLIC_CACHE_TTL_MS = 60_000;

@Injectable()
export class JobsService {
  constructor(
    private readonly repo: JobsRepository,
    private readonly profilesRepo: ProfilesRepository,
    @Inject(forwardRef(() => BiasService))
    private readonly biasService: BiasService,
    private readonly audit: AuditService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  // ---------------------------------------------------------------- CREATE

  async create(
    user: AuthUser,
    dto: CreateJobDto,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<JobResponseDto> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Recruiter role required" });
    }

    const recruiterProfile = await this.profilesRepo.findRecruiterProfile(user.id);
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

    const job = await this.repo.insert({
      recruiterId: user.id,
      companyId: recruiterProfile.companyId,
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
      details: { title: job.title },
      ...requestMeta,
    });

    await this.invalidatePublicCache();

    return this.toResponse(await this.requireJobWithCompany(job.id));
  }

  // ---------------------------------------------------------------- UPDATE

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateJobDto,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<JobResponseDto> {
    await this.assertOwnership(user, id);

    const patch: Partial<Parameters<JobsRepository["update"]>[1]> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.department !== undefined) patch.department = dto.department ?? null;
    if (dto.employmentType !== undefined) patch.employmentType = dto.employmentType;
    if (dto.workMode !== undefined) patch.workMode = dto.workMode;
    if (dto.locationCity !== undefined) patch.locationCity = dto.locationCity ?? null;
    if (dto.locationRegion !== undefined) patch.locationRegion = dto.locationRegion ?? null;
    if (dto.locationCountry !== undefined) patch.locationCountry = dto.locationCountry ?? null;
    if (dto.salaryMin !== undefined)
      patch.salaryMin = dto.salaryMin != null ? String(dto.salaryMin) : null;
    if (dto.salaryMax !== undefined)
      patch.salaryMax = dto.salaryMax != null ? String(dto.salaryMax) : null;
    if (dto.salaryCurrency !== undefined) patch.salaryCurrency = dto.salaryCurrency;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.descriptionPlain !== undefined) patch.descriptionPlain = dto.descriptionPlain;
    if (dto.requiredSkills !== undefined) patch.requiredSkills = dto.requiredSkills;
    if (dto.experienceLevel !== undefined) patch.experienceLevel = dto.experienceLevel;
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
      ...requestMeta,
    });

    await this.invalidatePublicCache();

    return this.toResponse(await this.requireJobWithCompany(id));
  }

  // ---------------------------------------------------- PUBLISH / ARCHIVE

  async publish(
    user: AuthUser,
    id: string,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<JobResponseDto> {
    const job = await this.assertOwnership(user, id);

    if (job.status !== "draft") {
      throw new BadRequestException({
        code: "INVALID_STATUS_TRANSITION",
        message: `Cannot publish a job in status '${job.status}'`,
      });
    }

    // Run a fresh bias scan; persists into bias_flags
    await this.biasService.scanJob(user, id, requestMeta);

    // Block publish if any flagged rows remain (recruiter must override or edit)
    const unresolved = await this.biasService.findFlagged(id);
    if (unresolved.length > 0) {
      throw new UnprocessableEntityException({
        code: "BIAS_CHECK_REQUIRED",
        message: `${unresolved.length} bias flag${unresolved.length === 1 ? "" : "s"} require${unresolved.length === 1 ? "s" : ""} override or edit before publish`,
        flags: unresolved,
      });
    }

    await this.repo.update(id, { status: "published", publishedAt: new Date() });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "job.published",
      entityType: "job",
      entityId: id,
      ...requestMeta,
    });

    await this.invalidatePublicCache();

    return this.toResponse(await this.requireJobWithCompany(id));
  }

  async archive(
    user: AuthUser,
    id: string,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<JobResponseDto> {
    await this.assertOwnership(user, id);

    await this.repo.update(id, { status: "archived" });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "job.archived",
      entityType: "job",
      entityId: id,
      ...requestMeta,
    });

    await this.invalidatePublicCache();

    return this.toResponse(await this.requireJobWithCompany(id));
  }

  // -------------------------------------------- PUBLIC LIST + DETAIL (cached)

  async listPublic(query: ListJobsQueryDto): Promise<{
    data: JobResponseDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const cacheKey = `jobs:public:${this.serializeQuery(query)}`;
    const cached = await this.cache.get<{
      data: JobResponseDto[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>(cacheKey);
    if (cached) return cached;

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
    const result = {
      data: rows.map((r) => this.toResponse(r)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };

    await this.cache.set(cacheKey, result, PUBLIC_CACHE_TTL_MS);
    return result;
  }

  async getPublic(id: string): Promise<JobResponseDto> {
    const cacheKey = `jobs:public:${id}`;
    const cached = await this.cache.get<JobResponseDto>(cacheKey);
    if (cached) return cached;

    const row = await this.repo.findByIdWithCompany(id);
    if (!row || row.status !== "published") {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Job not found" });
    }

    const result = this.toResponse(row);
    await this.cache.set(cacheKey, result, PUBLIC_CACHE_TTL_MS);
    return result;
  }

  // ---------------------------------- RECRUITER LIST + DETAIL (own jobs)

  async listMine(user: AuthUser, query: ListJobsQueryDto): Promise<{
    data: JobResponseDto[] | (JobResponseDto & { stats: JobStats })[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Recruiter role required" });
    }

    if (query.include === "stats") {
      const sort: "recent" | "recent-activity" =
        query.sort === "recent-activity" ? "recent-activity" : "recent";
      const { rows, total } = await this.repo.listMineWithStats(user.id, {
        page: query.page,
        limit: query.limit,
        status: query.status,
        sort,
      });
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
      recruiterId: user.id,
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
  }

  async getForRecruiter(user: AuthUser, id: string): Promise<JobResponseDto> {
    const row = await this.assertOwnership(user, id);
    const withCompany = await this.repo.findByIdWithCompany(row.id);
    if (!withCompany) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Job not found" });
    }
    return this.toResponse(withCompany);
  }

  // ---------------------------------------------------- CANDIDATE LIST + DETAIL
  // Sprint = same shape as public; Slice 2.6 enriches with match score.

  async listForCandidate(query: ListJobsQueryDto): Promise<ReturnType<JobsService["listPublic"]>> {
    return this.listPublic(query);
  }

  async getForCandidate(id: string): Promise<JobResponseDto> {
    return this.getPublic(id);
  }

  // -------------------------------------------------------------- PRIVATE

  private async assertOwnership(user: AuthUser, id: string) {
    if (user.role !== "recruiter") {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Job not found" });
    }
    const job = await this.repo.findById(id);
    if (!job || job.recruiterId !== user.id) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Job not found" });
    }
    return job;
  }

  private async requireJobWithCompany(id: string): Promise<JobWithCompany> {
    const row = await this.repo.findByIdWithCompany(id);
    if (!row) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Job not found" });
    }
    return row;
  }

  private async invalidatePublicCache(): Promise<void> {
    // Sprint: rely on the 60s TTL for eventual consistency.
    // Slice 3.7 (Redis-backed cache) will introduce keyset tracking for
    // granular per-key invalidation.
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
      applicationDeadline: row.applicationDeadline ? row.applicationDeadline.toString() : null,
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
