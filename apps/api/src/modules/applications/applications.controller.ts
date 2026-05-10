import {
  Body,
  Controller,
  Delete,
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
import { Roles } from "../../common/decorators/roles.decorator";

import { ApplyToJobDto } from "./dto/apply.dto";
import { RecentApplicationsQueryDto } from "./dto/recent-applications-query.dto";
import { RecruiterApplicationsListQueryDto } from "./dto/recruiter-applications-list-query.dto";
import { RecruiterStatsQueryDto } from "./dto/recruiter-stats-query.dto";
import { ShortlistQueryDto } from "./dto/shortlist-query.dto";
import { UpdateApplicationStatusDto } from "./dto/update-status.dto";
import { UpdateApplicationNotesDto } from "./dto/update-notes.dto";
import { WithdrawApplicationDto } from "./dto/withdraw-application.dto";
import {
  ApplicationDto,
  ApplicationEnvelopeDto,
  ApplicationListEnvelopeDto,
  RecruiterAnalyticsEnvelopeDto,
  RecruiterStatsEnvelopeDto,
  ShortlistListEnvelopeDto,
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
    summary: "Dashboard summary for the active company (range-filterable)",
  })
  @ApiQuery({
    name: "range",
    required: false,
    enum: ["7d", "30d", "90d", "all"],
  })
  @ApiResponse({ status: 200, type: RecruiterStatsEnvelopeDto })
  async recruiterStats(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Query() query: RecruiterStatsQueryDto,
  ): Promise<RecruiterStatsEnvelopeDto> {
    const data = await this.service.recruiterStats(
      user,
      activeCompany.companyId,
      query.range,
    );
    return { data };
  }

  @Get("recruiter-analytics")
  @Roles("recruiter")
  @ApiOperation({
    summary:
      "Active-company analytics bundle: KPIs + top jobs by app count + status breakdown",
  })
  @ApiResponse({ status: 200, type: RecruiterAnalyticsEnvelopeDto })
  async recruiterAnalytics(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
  ): Promise<RecruiterAnalyticsEnvelopeDto> {
    const result = await this.service.recruiterAnalytics(
      user,
      activeCompany.companyId,
    );
    return {
      data: {
        kpis: {
          activeJobs: result.kpis.activeJobs,
          totalApplications: result.kpis.totalApplications,
          pendingReviews: result.kpis.pendingReviews,
          avgMatchScore: result.kpis.avgMatchScore,
        },
        topJobs: result.topJobs,
        applicationsByStatus: result.applicationsByStatus,
      },
    };
  }

  @Get("recent")
  @Roles("recruiter")
  @ApiOperation({
    summary: "Recent applications across the active company's jobs",
  })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, type: ApplicationListEnvelopeDto })
  async recent(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Query() query: RecentApplicationsQueryDto,
  ): Promise<ApplicationListEnvelopeDto> {
    const data = await this.service.recentForRecruiter(
      user,
      activeCompany.companyId,
      query.limit,
    );
    return { data };
  }

  @Get("shortlist")
  @Roles("recruiter")
  @ApiOperation({
    summary: "List the active company's shortlisted applications",
  })
  @ApiResponse({ status: 200, type: ShortlistListEnvelopeDto })
  async listShortlist(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Query() query: ShortlistQueryDto,
  ): Promise<{
    data: ApplicationDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    return this.service.listShortlistForRecruiter(
      user,
      activeCompany.companyId,
      query,
    );
  }

  @Get("recruiter-list")
  @Roles("recruiter")
  @ApiOperation({
    summary:
      "List all applications across the active company's jobs (paginated, filterable)",
  })
  @ApiResponse({ status: 200, type: ShortlistListEnvelopeDto })
  async listAllForRecruiter(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Query() query: RecruiterApplicationsListQueryDto,
  ): Promise<{
    data: ApplicationDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    return this.service.listAllForRecruiter(
      user,
      activeCompany.companyId,
      query,
    );
  }

  @Get("by-job/:jobId")
  @Roles("recruiter")
  @ApiOperation({
    summary: "List applications for a job owned by the active company",
  })
  @ApiResponse({ status: 200, type: ApplicationListEnvelopeDto })
  async listForJob(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Param("jobId") jobId: string,
  ): Promise<ApplicationListEnvelopeDto> {
    const data = await this.service.listForJob(
      user,
      activeCompany.companyId,
      jobId,
    );
    return { data };
  }

  @Get(":id")
  @Roles("candidate", "recruiter", "admin")
  @ApiOperation({ summary: "Get application detail" })
  @ApiResponse({ status: 200, type: ApplicationEnvelopeDto })
  async getById(
    @CurrentUser() user: AuthUser,
    @Req() req: FastifyRequest,
    @Param("id") id: string,
  ): Promise<ApplicationEnvelopeDto> {
    // Recruiters scope to their active company; candidates + admins scope by
    // their own auth (candidate_id ownership / admin bypass). The guard
    // attaches activeCompanyId only for recruiters; pass null otherwise.
    const reqWithCtx = req as FastifyRequest & { activeCompanyId?: string };
    const companyId = reqWithCtx.activeCompanyId ?? null;
    const data = await this.service.getById(user, companyId, id);
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
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Param("id") id: string,
    @Body() dto: UpdateApplicationStatusDto,
    @Req() req: FastifyRequest,
  ): Promise<
    | ApplicationEnvelopeDto
    | { data: ApplicationDto; otherApplicationsRejected: number }
  > {
    const meta = this.requestMeta(req);
    if (dto.newStatus === "hired") {
      const result = await this.service.hire(
        user,
        activeCompany.companyId,
        id,
        {
          autoRejectOthers: dto.autoRejectOthers ?? false,
          note: dto.note ?? null,
        },
        meta,
      );
      return {
        data: result.application,
        otherApplicationsRejected: result.otherApplicationsRejected,
      };
    }
    const data = await this.service.updateStatus(
      user,
      activeCompany.companyId,
      id,
      dto,
      meta,
    );
    return { data };
  }

  @Patch(":id/notes")
  @Roles("recruiter")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update recruiter notes on an application" })
  @ApiResponse({ status: 200, type: ApplicationEnvelopeDto })
  async updateNotes(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Param("id") id: string,
    @Body() dto: UpdateApplicationNotesDto,
    @Req() req: FastifyRequest,
  ): Promise<ApplicationEnvelopeDto> {
    const data = await this.service.updateNotes(
      user,
      activeCompany.companyId,
      id,
      dto,
      this.requestMeta(req),
    );
    return { data };
  }

  @Post(":id/shortlist")
  @Roles("recruiter")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Add this application to the active company's shortlist",
  })
  @ApiResponse({ status: 200, type: ApplicationEnvelopeDto })
  async shortlist(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Param("id") id: string,
  ): Promise<ApplicationEnvelopeDto> {
    const data = await this.service.addToShortlist(
      user,
      activeCompany.companyId,
      id,
    );
    return { data };
  }

  @Delete(":id/shortlist")
  @Roles("recruiter")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Remove this application from the active company's shortlist",
  })
  @ApiResponse({ status: 200, type: ApplicationEnvelopeDto })
  async unshortlist(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Param("id") id: string,
  ): Promise<ApplicationEnvelopeDto> {
    const data = await this.service.removeFromShortlist(
      user,
      activeCompany.companyId,
      id,
    );
    return { data };
  }

  @Post(":id/withdraw")
  @Roles("candidate", "admin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Candidate withdraws their application" })
  @ApiResponse({ status: 200, type: ApplicationEnvelopeDto })
  async withdraw(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: WithdrawApplicationDto,
    @Req() req: FastifyRequest,
  ): Promise<ApplicationEnvelopeDto> {
    const data = await this.service.withdraw(
      user,
      id,
      dto,
      this.requestMeta(req),
    );
    return { data };
  }

  @Get(":id/resume-download")
  @Roles("candidate", "recruiter", "admin")
  @ApiOperation({
    summary:
      "1-hour signed URL for the candidate's resume in the context of this application",
    description:
      "Recruiters whose active company owns the job can download; candidates can download own.",
  })
  @ApiResponse({ status: 200, type: SignedDownloadEnvelopeDto })
  async resumeDownload(
    @CurrentUser() user: AuthUser,
    @Req() req: FastifyRequest,
    @Param("id") id: string,
  ): Promise<SignedDownloadEnvelopeDto> {
    const reqWithCtx = req as FastifyRequest & { activeCompanyId?: string };
    const companyId = reqWithCtx.activeCompanyId ?? null;
    const data = await this.service.getResumeDownload(user, companyId, id);
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
