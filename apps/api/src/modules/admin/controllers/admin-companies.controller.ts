import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import type { AuthUser } from "@aurahire/shared";

import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";

import {
  AdminCompanyListEnvelopeDto,
  AdminCompanyOptionsEnvelopeDto,
  ListAdminCompaniesQueryDto,
} from "../dto/admin-companies.dto";
import { AdminCompaniesService } from "../services/admin-companies.service";

@ApiTags("admin-companies")
@ApiBearerAuth()
@Controller("admin/companies")
export class AdminCompaniesController {
  constructor(private readonly service: AdminCompaniesService) {}

  @Get()
  @Roles("admin")
  @ApiOperation({
    summary: "List every company across all tenants (cross-tenant admin view)",
  })
  @ApiResponse({ status: 200, type: AdminCompanyListEnvelopeDto })
  async list(
    @Query() query: ListAdminCompaniesQueryDto,
  ): Promise<AdminCompanyListEnvelopeDto> {
    return this.service.list(query);
  }

  @Get("options")
  @Roles("admin")
  @ApiOperation({
    summary: "Lightweight company list for filter dropdowns (id + name + logoUrl)",
  })
  @ApiResponse({ status: 200, type: AdminCompanyOptionsEnvelopeDto })
  async options(): Promise<AdminCompanyOptionsEnvelopeDto> {
    return this.service.listOptions();
  }

  @Delete(":id")
  @Roles("admin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Cross-tenant company deletion. Cascades to memberships, jobs, applications.",
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async deleteCompany(
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: FastifyRequest,
  ): Promise<{ data: { deleted: true; companyId: string } }> {
    const data = await this.service.deleteCompany(user, id, {
      ipAddress: req.ip ?? null,
      userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
    });
    return { data };
  }
}
