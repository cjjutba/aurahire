import {
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { AuthUser } from "@aurahire/shared";

import { AuditService } from "../../../audit";
import { AUDIT_ACTIONS } from "../../../audit/audit.types";
import {
  AdminCompaniesRepository,
  type AdminCompanyRow,
} from "../repositories/admin-companies.repository";
import type {
  AdminCompanyListEnvelopeDto,
  AdminCompanyOptionsEnvelopeDto,
  AdminCompanyRowDto,
  ListAdminCompaniesQuery,
} from "../dto/admin-companies.dto";

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AdminCompaniesService {
  private readonly logger = new Logger(AdminCompaniesService.name);

  constructor(
    private readonly repo: AdminCompaniesRepository,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListAdminCompaniesQuery): Promise<AdminCompanyListEnvelopeDto> {
    const { rows, total } = await this.repo.list({
      q: query.q,
      page: query.page,
      limit: query.limit,
    });

    return {
      data: rows.map((r) => this.toRowDto(r)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async listOptions(): Promise<AdminCompanyOptionsEnvelopeDto> {
    const rows = await this.repo.listAllForFilters();
    return { data: rows };
  }

  async deleteCompany(
    user: AuthUser,
    id: string,
    requestMeta: RequestMeta = {},
  ): Promise<{ deleted: true; companyId: string }> {
    const company = await this.repo.findById(id);
    if (!company) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Company not found",
      });
    }

    await this.repo.deleteById(id);

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.COMPANY_DELETED,
      entityType: "company",
      entityId: id,
      // Cross-tenant action: companyId left null since the row no longer exists.
      companyId: null,
      details: {
        deletedByAdmin: true,
        companyName: company.name,
      },
      ipAddress: requestMeta.ipAddress ?? null,
      userAgent: requestMeta.userAgent ?? null,
    });

    this.logger.log(
      `Admin ${user.id} deleted company ${id} (${company.name})`,
    );

    return { deleted: true, companyId: id };
  }

  private toRowDto(r: AdminCompanyRow): AdminCompanyRowDto {
    return {
      id: r.id,
      name: r.name,
      industry: r.industry,
      size: r.size,
      website: r.website,
      logoUrl: r.logoUrl,
      headquartersLocation: r.headquartersLocation,
      description: r.description,
      owner: {
        name: r.ownerName,
        email: r.ownerEmail,
      },
      memberCount: r.memberCount,
      jobCount: r.jobCount,
      // Suspension lives behind a deferred schema column; everyone is "active".
      status: "active",
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
