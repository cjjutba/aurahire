import { Injectable, NotFoundException } from "@nestjs/common";
import type { AuthUser, ListAdminJobsQuery } from "@aurahire/shared";

import { AuditService, AUDIT_ACTIONS } from "../../../audit";
import { ApplicationsRepository } from "../../applications/applications.repository";
import { BiasRepository } from "../../bias/bias.repository";
import { JobsRepository } from "../../jobs/jobs.repository";
import type {
  AdminJobBiasFlagDto,
  AdminJobDetailDto,
  AdminJobDto,
  AdminJobListEnvelopeDto,
} from "../dto/admin-job-response.dto";

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AdminJobsService {
  constructor(
    private readonly jobsRepo: JobsRepository,
    private readonly biasRepo: BiasRepository,
    private readonly applicationsRepo: ApplicationsRepository,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListAdminJobsQuery): Promise<AdminJobListEnvelopeDto> {
    const { rows, total } = await this.jobsRepo.listForAdmin({
      status: query.status,
      recruiterId: query.recruiterId,
      hasBiasFlags: query.hasBiasFlags,
      q: query.q,
      page: query.page,
      limit: query.limit,
    });

    const items: AdminJobDto[] = await Promise.all(
      rows.map(async (r) => {
        const [biasFlags, applicationsCount] = await Promise.all([
          this.biasRepo.findByJobId(r.id),
          this.applicationsRepo.countByJobId(r.id),
        ]);

        return {
          id: r.id,
          title: r.title,
          department: r.department,
          status: r.status,
          employmentType: r.employmentType,
          workMode: r.workMode,
          experienceLevel: r.experienceLevel,
          publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
          createdAt: r.createdAt.toISOString(),
          recruiter: {
            id: r.recruiter.id,
            fullName: r.recruiter.fullName,
            email: r.recruiter.email,
          },
          company: { id: r.company.id, name: r.company.name },
          biasFlagsCount: biasFlags.length,
          applicationsCount,
        };
      }),
    );

    return {
      data: items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getById(id: string): Promise<AdminJobDetailDto> {
    const row = await this.jobsRepo.findByIdWithCompanyAndRecruiter(id);
    if (!row)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Job not found",
      });

    const [biasFlags, applicationsCount] = await Promise.all([
      this.biasRepo.findByJobId(id),
      this.applicationsRepo.countByJobId(id),
    ]);

    return {
      id: row.id,
      title: row.title,
      department: row.department,
      status: row.status,
      employmentType: row.employmentType,
      workMode: row.workMode,
      experienceLevel: row.experienceLevel,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      recruiter: {
        id: row.recruiter.id,
        fullName: row.recruiter.fullName,
        email: row.recruiter.email,
      },
      company: { id: row.company.id, name: row.company.name },
      biasFlagsCount: biasFlags.length,
      applicationsCount,
      description: row.description,
      descriptionPlain: row.descriptionPlain,
      requiredSkills: row.requiredSkills,
      biasFlags: biasFlags.map((f) => ({
        id: f.id,
        term: f.term,
        category: f.category,
        severity: f.severity,
        status: f.status,
        overrideReason: f.overrideReason,
        overriddenAt: f.overriddenAt ? f.overriddenAt.toISOString() : null,
        createdAt: f.createdAt.toISOString(),
      })) as AdminJobBiasFlagDto[],
    };
  }

  async archive(
    actor: AuthUser,
    id: string,
    meta: RequestMeta = {},
  ): Promise<AdminJobDetailDto> {
    const row = await this.jobsRepo.findById(id);
    if (!row)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Job not found",
      });

    if (row.status === "archived") {
      return this.getById(id);
    }

    await this.jobsRepo.update(id, { status: "archived" });

    await this.audit.log({
      actorId: actor.id,
      actorType: "user",
      action: AUDIT_ACTIONS.JOB_ARCHIVED_BY_ADMIN,
      entityType: "job",
      entityId: id,
      details: {
        previousStatus: row.status,
        recruiterId: row.recruiterId,
      },
      ...meta,
    });

    return this.getById(id);
  }
}
