import {
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import type { ListAdminAuditQuery } from "@aurahire/shared";

import {
  AdminAuditRepository,
  type AuditJoinedRow,
} from "../repositories/admin-audit.repository";
import type {
  AuditEntryDetailDto,
  AuditEntryRowDto,
  AuditListEnvelopeDto,
} from "../dto/audit-response.dto";

const EXPORT_MAX_ROWS = 10_000;
const SNIPPET_MAX_CHARS = 200;

@Injectable()
export class AdminAuditService {
  constructor(private readonly repo: AdminAuditRepository) {}

  async list(query: ListAdminAuditQuery): Promise<AuditListEnvelopeDto> {
    const { rows, total } = await this.repo.list({
      actorId: query.actorId,
      q: query.q,
      entityType: query.entityType,
      action: query.action,
      actorType: query.actorType,
      companyId: query.companyId,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
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

  async getById(id: string): Promise<AuditEntryDetailDto> {
    const row = await this.repo.findById(id);
    if (!row)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Audit entry not found",
      });
    return this.toDetailDto(row);
  }

  /** For CSV export. Returns the rows + a CSV string. */
  async exportCsv(
    query: Omit<ListAdminAuditQuery, "page" | "limit">,
  ): Promise<{
    csv: string;
    filename: string;
    rowCount: number;
  }> {
    const result = await this.repo.listAll(
      {
        actorId: query.actorId,
        q: query.q,
        entityType: query.entityType,
        action: query.action,
        actorType: query.actorType,
        companyId: query.companyId,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      },
      EXPORT_MAX_ROWS,
    );

    if (result.truncated) {
      throw new PayloadTooLargeException({
        code: "EXPORT_TOO_LARGE",
        message: `Export exceeds ${EXPORT_MAX_ROWS} rows; narrow filters first`,
        rowCount: result.rowCount,
      });
    }

    const header = [
      "timestamp",
      "action",
      "actor_type",
      "actor_id",
      "actor_name",
      "actor_email",
      "company_id",
      "company_name",
      "entity_type",
      "entity_id",
      "details",
      "ip_address",
      "user_agent",
    ];
    const lines = [header.join(",")];

    for (const r of result.rows) {
      const cells = [
        r.log.createdAt.toISOString(),
        r.log.action,
        r.log.actorType,
        r.log.actorId ?? "",
        r.actor?.fullName ?? "",
        r.actor?.email ?? "",
        r.company?.id ?? "",
        r.company?.name ?? "",
        r.log.entityType,
        r.log.entityId,
        JSON.stringify(r.log.details ?? {}),
        r.log.ipAddress ?? "",
        r.log.userAgent ?? "",
      ];
      lines.push(cells.map(this.csvEscape).join(","));
    }

    const today = new Date().toISOString().slice(0, 10);
    return {
      csv: lines.join("\n"),
      filename: `audit-export-${today}.csv`,
      rowCount: result.rowCount,
    };
  }

  private toRowDto(r: AuditJoinedRow): AuditEntryRowDto {
    const detailsJson = JSON.stringify(r.log.details ?? {});
    const detailsSnippet =
      detailsJson.length > SNIPPET_MAX_CHARS
        ? `${detailsJson.slice(0, SNIPPET_MAX_CHARS - 3)}...`
        : detailsJson;
    return {
      id: r.log.id,
      action: r.log.action,
      actorType: r.log.actorType,
      actor: r.actor
        ? {
            id: r.actor.id,
            fullName: r.actor.fullName,
            email: r.actor.email,
            role: r.actor.role,
          }
        : null,
      company: r.company
        ? {
            id: r.company.id,
            name: r.company.name,
            logoUrl: r.company.logoUrl,
          }
        : null,
      entityType: r.log.entityType,
      entityId: r.log.entityId,
      detailsSnippet,
      createdAt: r.log.createdAt.toISOString(),
    };
  }

  private toDetailDto(r: AuditJoinedRow): AuditEntryDetailDto {
    return {
      ...this.toRowDto(r),
      details: (r.log.details as Record<string, unknown>) ?? {},
      ipAddress: r.log.ipAddress,
      userAgent: r.log.userAgent,
    };
  }

  private csvEscape(value: string): string {
    if (value === "") return "";
    if (
      value.includes(",") ||
      value.includes('"') ||
      value.includes("\n") ||
      value.includes("\r")
    ) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
