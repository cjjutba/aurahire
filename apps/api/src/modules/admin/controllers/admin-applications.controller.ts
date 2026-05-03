import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { Roles } from "../../../common/decorators/roles.decorator";

import { ListAdminApplicationsQueryDto } from "../dto/list-applications-query.dto";
import {
  AdminApplicationDetailEnvelopeDto,
  AdminApplicationListEnvelopeDto,
} from "../dto/admin-application-response.dto";
import { AdminApplicationsService } from "../services/admin-applications.service";

@ApiTags("admin-applications")
@ApiBearerAuth()
@Controller("admin/applications")
export class AdminApplicationsController {
  constructor(private readonly service: AdminApplicationsService) {}

  @Get()
  @Roles("admin")
  @ApiOperation({
    summary:
      "Filter + list all applications across the system (cached 30s)",
  })
  @ApiResponse({ status: 200, type: AdminApplicationListEnvelopeDto })
  async list(
    @Query() query: ListAdminApplicationsQueryDto,
  ): Promise<AdminApplicationListEnvelopeDto> {
    return this.service.list(query);
  }

  @Get(":id")
  @Roles("admin")
  @ApiOperation({
    summary:
      "Full admin detail for an application — includes raw AI output, parsed resume + redactedFields list, and the audit trail",
  })
  @ApiResponse({ status: 200, type: AdminApplicationDetailEnvelopeDto })
  @ApiResponse({ status: 404, description: "Application not found" })
  async getById(
    @Param("id") id: string,
  ): Promise<AdminApplicationDetailEnvelopeDto> {
    const data = await this.service.getById(id);
    return { data };
  }
}
