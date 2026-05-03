import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { FastifyReply } from "fastify";

import { Roles } from "../../../common/decorators/roles.decorator";

import { ListAdminAuditQueryDto } from "../dto/list-audit-query.dto";
import {
  AuditEntryEnvelopeDto,
  AuditListEnvelopeDto,
} from "../dto/audit-response.dto";
import { AdminAuditService } from "../services/admin-audit.service";

@ApiTags("admin-audit")
@ApiBearerAuth()
@Controller("admin/audit")
export class AdminAuditController {
  constructor(private readonly service: AdminAuditService) {}

  @Get()
  @Roles("admin")
  @ApiOperation({ summary: "Filter + list audit log entries" })
  @ApiResponse({ status: 200, type: AuditListEnvelopeDto })
  async list(
    @Query() query: ListAdminAuditQueryDto,
  ): Promise<AuditListEnvelopeDto> {
    return this.service.list(query);
  }

  // CRITICAL: this MUST come before @Get(":id") so "export.csv"
  // isn't matched as :id.
  @Get("export.csv")
  @Roles("admin")
  @ApiOperation({
    summary: "Export filtered audit log as CSV (max 10,000 rows)",
  })
  @ApiResponse({ status: 200, description: "CSV stream" })
  @ApiResponse({ status: 413, description: "Export exceeds 10,000 rows" })
  async exportCsv(
    @Query() query: ListAdminAuditQueryDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<string> {
    const { page: _p, limit: _l, ...rest } = query;
    void _p;
    void _l;
    const { csv, filename } = await this.service.exportCsv(rest);

    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${filename}"`);

    return csv;
  }

  @Get(":id")
  @Roles("admin")
  @ApiOperation({ summary: "Get a single audit entry (full details JSONB)" })
  @ApiResponse({ status: 200, type: AuditEntryEnvelopeDto })
  @ApiResponse({ status: 404 })
  async getById(@Param("id") id: string): Promise<AuditEntryEnvelopeDto> {
    const data = await this.service.getById(id);
    return { data };
  }
}
