import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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

import { ListAdminJobsQueryDto } from "../dto/list-jobs-query.dto";
import {
  AdminJobEnvelopeDto,
  AdminJobListEnvelopeDto,
} from "../dto/admin-job-response.dto";
import { AdminJobsService } from "../services/admin-jobs.service";

@ApiTags("admin-jobs")
@ApiBearerAuth()
@Controller("admin/jobs")
export class AdminJobsController {
  constructor(private readonly service: AdminJobsService) {}

  @Get()
  @Roles("admin")
  @ApiOperation({ summary: "List/filter all jobs across the system" })
  @ApiResponse({ status: 200, type: AdminJobListEnvelopeDto })
  async list(
    @Query() query: ListAdminJobsQueryDto,
  ): Promise<AdminJobListEnvelopeDto> {
    return this.service.list(query);
  }

  @Get(":id")
  @Roles("admin")
  @ApiOperation({ summary: "Admin view of a job (any status, any recruiter)" })
  @ApiResponse({ status: 200, type: AdminJobEnvelopeDto })
  async getById(@Param("id") id: string): Promise<AdminJobEnvelopeDto> {
    const data = await this.service.getById(id);
    return { data };
  }

  @Post(":id/archive")
  @Roles("admin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Archive a job (admin bypasses ownership)" })
  @ApiResponse({ status: 200, type: AdminJobEnvelopeDto })
  async archive(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Req() req: FastifyRequest,
  ): Promise<AdminJobEnvelopeDto> {
    const data = await this.service.archive(actor, id, this.requestMeta(req));
    return { data };
  }

  private requestMeta(req: FastifyRequest): {
    ipAddress: string | null;
    userAgent: string | null;
  } {
    return {
      ipAddress: req.ip ?? null,
      userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
    };
  }
}
