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
  @ApiOperation({ summary: "Create a new job (status='draft')" })
  @ApiResponse({ status: 201, type: JobResponseEnvelopeDto })
  @ApiResponse({ status: 400, description: "Onboarding incomplete OR validation failed" })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateJobDto,
    @Req() req: FastifyRequest,
  ): Promise<JobResponseEnvelopeDto> {
    const data = await this.service.create(user, dto, this.requestMeta(req));
    return { data };
  }

  @Patch(":id")
  @ApiBearerAuth()
  @Roles("recruiter")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update a job (recruiter must own it)" })
  @ApiResponse({ status: 200, type: JobResponseEnvelopeDto })
  @ApiResponse({ status: 404, description: "Job not found OR not owned" })
  async update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateJobDto,
    @Req() req: FastifyRequest,
  ): Promise<JobResponseEnvelopeDto> {
    const data = await this.service.update(user, id, dto, this.requestMeta(req));
    return { data };
  }

  @Post(":id/publish")
  @ApiBearerAuth()
  @Roles("recruiter")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Publish a draft job (NAIVE — bias check wraps this in Slice 2.7)",
  })
  @ApiResponse({ status: 200, type: JobResponseEnvelopeDto })
  @ApiResponse({ status: 400, description: "Job is not in 'draft' status" })
  @ApiResponse({ status: 404, description: "Job not found OR not owned" })
  async publish(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Req() req: FastifyRequest,
  ): Promise<JobResponseEnvelopeDto> {
    const data = await this.service.publish(user, id, this.requestMeta(req));
    return { data };
  }

  @Post(":id/archive")
  @ApiBearerAuth()
  @Roles("recruiter")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Archive a job" })
  @ApiResponse({ status: 200, type: JobResponseEnvelopeDto })
  @ApiResponse({ status: 404, description: "Job not found OR not owned" })
  async archive(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Req() req: FastifyRequest,
  ): Promise<JobResponseEnvelopeDto> {
    const data = await this.service.archive(user, id, this.requestMeta(req));
    return { data };
  }

  // -------------------------------------------- RECRUITER LIST + DETAIL

  @Get("mine")
  @ApiBearerAuth()
  @Roles("recruiter")
  @ApiOperation({
    summary: "List own jobs (any status); paginated. Supports ?include=stats for per-job aggregates.",
  })
  @ApiQuery({ name: "include", required: false, enum: ["stats"] })
  @ApiResponse({ status: 200, type: JobListResponseDto })
  async listMine(
    @CurrentUser() user: AuthUser,
    @Query() query: ListJobsQueryDto,
  ): Promise<JobListResponseDto> {
    return this.service.listMine(user, query);
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
  @ApiOperation({ summary: "Recruiter view of own job (any status)" })
  @ApiResponse({ status: 200, type: JobResponseEnvelopeDto })
  @ApiResponse({ status: 404, description: "Job not found OR not owned" })
  async getForRecruiter(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ): Promise<JobResponseEnvelopeDto> {
    const data = await this.service.getForRecruiter(user, id);
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
