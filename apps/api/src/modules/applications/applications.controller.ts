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
import { Roles } from "../../common/decorators/roles.decorator";

import { ApplyToJobDto } from "./dto/apply.dto";
import { RecentApplicationsQueryDto } from "./dto/recent-applications-query.dto";
import { UpdateApplicationStatusDto } from "./dto/update-status.dto";
import { UpdateApplicationNotesDto } from "./dto/update-notes.dto";
import {
  ApplicationEnvelopeDto,
  ApplicationListEnvelopeDto,
  SignedDownloadEnvelopeDto,
} from "./dto/application-response.dto";
import { ApplicationsService } from "./applications.service";

@ApiTags("applications")
@ApiBearerAuth()
@Controller("applications")
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  @Post()
  @Roles("candidate")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Apply to a job (creates application + computes match score)",
    description:
      "Synchronous. Takes ~10-15s due to AI scoring. Frontend should display AI Shimmer.",
  })
  @ApiResponse({ status: 201, type: ApplicationEnvelopeDto })
  @ApiResponse({ status: 409, description: "Already applied to this job" })
  async apply(
    @CurrentUser() user: AuthUser,
    @Body() dto: ApplyToJobDto,
    @Req() req: FastifyRequest,
  ): Promise<ApplicationEnvelopeDto> {
    const data = await this.service.apply(user, dto, this.requestMeta(req));
    return { data };
  }

  @Get("mine")
  @Roles("candidate")
  @ApiOperation({ summary: "List own applications" })
  @ApiResponse({ status: 200, type: ApplicationListEnvelopeDto })
  async listMine(
    @CurrentUser() user: AuthUser,
  ): Promise<ApplicationListEnvelopeDto> {
    const data = await this.service.listMine(user);
    return { data };
  }

  // CRITICAL: declare the literal "recruiter-stats" + "recruiter-analytics" routes
  // BEFORE @Get(":id") so they aren't matched as ids.

  @Get("recruiter-stats")
  @Roles("recruiter")
  @ApiOperation({
    summary: "4-KPI dashboard summary for the current recruiter",
  })
  async recruiterStats(@CurrentUser() user: AuthUser): Promise<{
    data: {
      activeJobs: number;
      totalApplications: number;
      pendingReviews: number;
      avgMatchScore: number;
    };
  }> {
    const data = await this.service.recruiterStats(user);
    return { data };
  }

  @Get("recruiter-analytics")
  @Roles("recruiter")
  @ApiOperation({
    summary: "Recruiter-scoped analytics bundle: KPIs + top jobs by app count + status breakdown",
  })
  async recruiterAnalytics(@CurrentUser() user: AuthUser): Promise<{
    data: {
      kpis: {
        activeJobs: number;
        totalApplications: number;
        pendingReviews: number;
        avgMatchScore: number;
      };
      topJobs: Array<{ jobId: string; title: string; status: string; applicationCount: number; avgScore: number }>;
      applicationsByStatus: Array<{ status: string; count: number }>;
    };
  }> {
    const data = await this.service.recruiterAnalytics(user);
    return { data };
  }

  @Get("recent")
  @Roles("recruiter")
  @ApiOperation({
    summary: "Recent applications across all of this recruiter's jobs",
  })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, type: ApplicationListEnvelopeDto })
  async recent(
    @CurrentUser() user: AuthUser,
    @Query() query: RecentApplicationsQueryDto,
  ): Promise<ApplicationListEnvelopeDto> {
    const data = await this.service.recentForRecruiter(user, query.limit);
    return { data };
  }

  @Get("by-job/:jobId")
  @Roles("recruiter")
  @ApiOperation({ summary: "List applications for a job (recruiter must own it)" })
  @ApiResponse({ status: 200, type: ApplicationListEnvelopeDto })
  async listForJob(
    @CurrentUser() user: AuthUser,
    @Param("jobId") jobId: string,
  ): Promise<ApplicationListEnvelopeDto> {
    const data = await this.service.listForJob(user, jobId);
    return { data };
  }

  @Get(":id")
  @Roles("candidate", "recruiter", "admin")
  @ApiOperation({ summary: "Get application detail" })
  @ApiResponse({ status: 200, type: ApplicationEnvelopeDto })
  async getById(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ): Promise<ApplicationEnvelopeDto> {
    const data = await this.service.getById(user, id);
    return { data };
  }

  @Patch(":id/status")
  @Roles("recruiter")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Move application through status state machine" })
  @ApiResponse({ status: 200, type: ApplicationEnvelopeDto })
  @ApiResponse({ status: 400, description: "Invalid status transition" })
  async updateStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateApplicationStatusDto,
    @Req() req: FastifyRequest,
  ): Promise<ApplicationEnvelopeDto> {
    const data = await this.service.updateStatus(user, id, dto, this.requestMeta(req));
    return { data };
  }

  @Patch(":id/notes")
  @Roles("recruiter")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update recruiter notes on an application" })
  @ApiResponse({ status: 200, type: ApplicationEnvelopeDto })
  async updateNotes(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateApplicationNotesDto,
    @Req() req: FastifyRequest,
  ): Promise<ApplicationEnvelopeDto> {
    const data = await this.service.updateNotes(user, id, dto, this.requestMeta(req));
    return { data };
  }

  @Post(":id/withdraw")
  @Roles("candidate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Withdraw own application" })
  @ApiResponse({ status: 200, type: ApplicationEnvelopeDto })
  async withdraw(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Req() req: FastifyRequest,
  ): Promise<ApplicationEnvelopeDto> {
    const data = await this.service.withdraw(user, id, this.requestMeta(req));
    return { data };
  }

  @Get(":id/resume-download")
  @Roles("candidate", "recruiter", "admin")
  @ApiOperation({
    summary: "1-hour signed URL for the candidate's resume in the context of this application",
    description: "Recruiters who own the job can download; candidates can download own.",
  })
  @ApiResponse({ status: 200, type: SignedDownloadEnvelopeDto })
  async resumeDownload(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ): Promise<SignedDownloadEnvelopeDto> {
    const data = await this.service.getResumeDownload(user, id);
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
