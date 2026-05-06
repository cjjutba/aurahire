import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import type { AuthUser } from "@aurahire/shared";

import {
  ActiveCompany,
  type ActiveCompanyContext,
} from "../../common/decorators/active-company.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";

import { CreateJobDto } from "./dto/create-job.dto";
import { UpdateJobDto } from "./dto/update-job.dto";
import { ListJobsQueryDto } from "./dto/list-jobs-query.dto";
import {
  JobResponseEnvelopeDto,
} from "./dto/job-response.dto";
import { JobListResponseDto } from "./dto/job-list-response.dto";
import { JobsService } from "./jobs.service";

@ApiTags("jobs")
@Controller("jobs")
export class JobsController {
  constructor(private readonly service: JobsService) {}

  // ---------------------------------- CREATE / UPDATE / PUBLISH / ARCHIVE

  @Post()
  @ApiBearerAuth()
  @Roles("recruiter")
  @ApiOperation({ summary: "Create a new job (status='draft') in the caller's active company" })
  @ApiResponse({ status: 201, type: JobResponseEnvelopeDto })
  @ApiResponse({ status: 400, description: "Onboarding incomplete OR validation failed" })
  async create(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Body() dto: CreateJobDto,
    @Req() req: FastifyRequest,
  ): Promise<JobResponseEnvelopeDto> {
    const data = await this.service.create(
      user,
      activeCompany.companyId,
      dto,
      this.requestMeta(req),
    );
    return { data };
  }

  @Patch(":id")
  @ApiBearerAuth()
  @Roles("recruiter")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update a job (must belong to the caller's active company)" })
  @ApiResponse({ status: 200, type: JobResponseEnvelopeDto })
  @ApiResponse({ status: 404, description: "Job not found OR not owned by active company" })
  async update(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Param("id") id: string,
    @Body() dto: UpdateJobDto,
    @Req() req: FastifyRequest,
  ): Promise<JobResponseEnvelopeDto> {
    const data = await this.service.update(
      user,
      activeCompany.companyId,
      id,
      dto,
      this.requestMeta(req),
    );
    return { data };
  }

  @Post(":id/publish")
  @ApiBearerAuth()
  @Roles("recruiter")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Publish a draft job (gated on bias-flag resolution)",
  })
  @ApiResponse({ status: 200, type: JobResponseEnvelopeDto })
  @ApiResponse({ status: 400, description: "Job is not in 'draft' status" })
  @ApiResponse({ status: 404, description: "Job not found OR not owned by active company" })
  async publish(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Param("id") id: string,
    @Req() req: FastifyRequest,
  ): Promise<JobResponseEnvelopeDto> {
    const data = await this.service.publish(
      user,
      activeCompany.companyId,
      id,
      this.requestMeta(req),
    );
    return { data };
  }

  @Post(":id/archive")
  @ApiBearerAuth()
  @Roles("recruiter")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Archive a job" })
  @ApiResponse({ status: 200, type: JobResponseEnvelopeDto })
  @ApiResponse({ status: 404, description: "Job not found OR not owned by active company" })
  async archive(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Param("id") id: string,
    @Req() req: FastifyRequest,
  ): Promise<JobResponseEnvelopeDto> {
    const data = await this.service.archive(
      user,
      activeCompany.companyId,
      id,
      this.requestMeta(req),
    );
    return { data };
  }

  // -------------------------------------------- RECRUITER LIST + DETAIL

  /**
   * Phase 2c: URL preserved as `/jobs/mine` for frontend stability — the
   * recruiter UI ships against this path and Phase 3 will reconsider the
   * URL semantics. The implementation is now company-scoped: returns
   * every job owned by the caller's active company, regardless of which
   * member created it. The "mine" in the URL is a legacy artifact of the
   * single-tenant origin; functionally it now means "the active company's
   * jobs."
   */
  @Get("mine")
  @ApiBearerAuth()
  @Roles("recruiter")
  @ApiOperation({
    summary:
      "List jobs owned by the caller's active company (any status); paginated. Supports ?include=stats.",
  })
  @ApiQuery({ name: "include", required: false, enum: ["stats"] })
  @ApiResponse({ status: 200, type: JobListResponseDto })
  async listForActiveCompany(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Query() query: ListJobsQueryDto,
  ): Promise<JobListResponseDto> {
    return this.service.listForActiveCompany(user, activeCompany.companyId, query);
  }

  // Candidate list comes BEFORE parameterized GETs to avoid `for-candidate`
  // being matched as `:id`.
  @Get("for-candidate")
  @ApiBearerAuth()
  @Roles("candidate")
  @ApiOperation({
    summary:
      "Candidate list of published jobs (sprint: same as public; Slice 2.6 enriches with match score)",
  })
  @ApiResponse({ status: 200, type: JobListResponseDto })
  async listForCandidate(@Query() query: ListJobsQueryDto): Promise<JobListResponseDto> {
    return this.service.listForCandidate(query);
  }

  @Get(":id/for-recruiter")
  @ApiBearerAuth()
  @Roles("recruiter")
  @ApiOperation({
    summary: "Recruiter view of a job owned by the active company (any status)",
  })
  @ApiResponse({ status: 200, type: JobResponseEnvelopeDto })
  @ApiResponse({ status: 404, description: "Job not found OR not owned by active company" })
  async getForRecruiter(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Param("id") id: string,
  ): Promise<JobResponseEnvelopeDto> {
    const data = await this.service.getForRecruiter(user, activeCompany.companyId, id);
    return { data };
  }

  @Get(":id/for-candidate")
  @ApiBearerAuth()
  @Roles("candidate")
  @ApiOperation({
    summary:
      "Candidate detail (sprint: same as public; Slice 2.6 enriches with match score)",
  })
  @ApiResponse({ status: 200, type: JobResponseEnvelopeDto })
  async getForCandidate(@Param("id") id: string): Promise<JobResponseEnvelopeDto> {
    const data = await this.service.getForCandidate(id);
    return { data };
  }

  // -------------------------------------------------- PUBLIC LIST + DETAIL

  @Get()
  @Public()
  @ApiOperation({ summary: "Public list of published jobs (paginated, filterable)" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "q", required: false, type: String })
  @ApiQuery({ name: "mode", required: false, enum: ["remote", "hybrid", "on-site"] })
  @ApiQuery({ name: "experienceLevel", required: false })
  @ApiQuery({ name: "locationCountry", required: false })
  @ApiQuery({ name: "sort", required: false, enum: ["recent", "best-match", "salary-high"] })
  @ApiResponse({ status: 200, type: JobListResponseDto })
  async listPublic(@Query() query: ListJobsQueryDto): Promise<JobListResponseDto> {
    return this.service.listPublic(query);
  }

  @Get(":id")
  @Public()
  @ApiOperation({ summary: "Public detail (only published jobs)" })
  @ApiResponse({ status: 200, type: JobResponseEnvelopeDto })
  @ApiResponse({ status: 404, description: "Job not published or doesn't exist" })
  async getPublic(@Param("id") id: string): Promise<JobResponseEnvelopeDto> {
    const data = await this.service.getPublic(id);
    return { data };
  }

  // -------------------------------------------------------------- PRIVATE

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
