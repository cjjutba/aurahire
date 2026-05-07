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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import type { AuthUser } from "@aurahire/shared";

import {
  ActiveCompany,
  type ActiveCompanyContext,
} from "../../common/decorators/active-company.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";

import { InterviewConflictsDto } from "./dto/interview-conflicts.dto";
import { RecruiterInterviewsQueryDto } from "./dto/recruiter-interviews-query.dto";
import { ScheduleInterviewDto } from "./dto/schedule-interview.dto";
import { UpdateInterviewFeedbackDto } from "./dto/update-interview-feedback.dto";
import { UpdateInterviewStatusDto } from "./dto/update-interview-status.dto";
import {
  InterviewEnvelopeDto,
  InterviewListEnvelopeDto,
} from "./dto/interview-response.dto";
import { InterviewsService } from "./interviews.service";

@ApiTags("interviews")
@ApiBearerAuth()
@Controller()
export class InterviewsController {
  constructor(private readonly service: InterviewsService) {}

  @Post("applications/:applicationId/interviews/check-conflicts")
  @Roles("recruiter")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Soft-check overlapping interviews for recruiter and candidate" })
  async checkConflicts(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Param("applicationId") applicationId: string,
    @Body() dto: InterviewConflictsDto,
  ): Promise<{
    data: {
      recruiterConflicts: Array<{ id: string; scheduledAt: string; durationMinutes: number }>;
      candidateConflicts: Array<{ id: string; scheduledAt: string; durationMinutes: number }>;
    };
  }> {
    const data = await this.service.checkConflictsForApplication(
      user,
      activeCompany.companyId,
      applicationId,
      dto,
    );
    return { data };
  }

  @Post("applications/:applicationId/interviews")
  @Roles("recruiter")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      "Schedule an interview for an application (the application's job must belong to the active company)",
  })
  @ApiResponse({ status: 201, type: InterviewEnvelopeDto })
  async schedule(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Param("applicationId") applicationId: string,
    @Body() dto: ScheduleInterviewDto,
    @Req() req: FastifyRequest,
  ): Promise<InterviewEnvelopeDto> {
    const data = await this.service.schedule(
      user,
      activeCompany.companyId,
      applicationId,
      dto,
      this.requestMeta(req),
    );
    return { data };
  }

  @Get("interviews/mine")
  @Roles("candidate")
  @ApiOperation({ summary: "List candidate's own interviews" })
  @ApiResponse({ status: 200, type: InterviewListEnvelopeDto })
  async listMine(@CurrentUser() user: AuthUser): Promise<InterviewListEnvelopeDto> {
    const data = await this.service.listMine(user);
    return { data };
  }

  /**
   * Path is preserved as `/interviews/by-recruiter/me` even though the
   * implementation now scopes by company. The frontend already ships
   * against this path and Phase 3 will reconsider the URL semantics.
   * Functionally it returns "every interview for jobs in my active
   * company" — which is what the current UI expects when it asks for
   * "my interviews."
   */
  @Get("interviews/by-recruiter/me")
  @Roles("recruiter")
  @ApiOperation({
    summary: "List all interviews for the active company's jobs (paginated)",
  })
  @ApiResponse({ status: 200, type: InterviewListEnvelopeDto })
  async listForRecruiter(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Query() query: RecruiterInterviewsQueryDto,
  ): Promise<InterviewListEnvelopeDto> {
    const { data, meta } = await this.service.listForRecruiter(
      user,
      activeCompany.companyId,
      query,
    );
    return { data, meta };
  }

  @Get("applications/:applicationId/interviews")
  @Roles("candidate", "recruiter", "admin")
  @ApiOperation({ summary: "List interviews for an application (auth-scoped)" })
  @ApiResponse({ status: 200, type: InterviewListEnvelopeDto })
  async listForApplication(
    @CurrentUser() user: AuthUser,
    @Req() req: FastifyRequest,
    @Param("applicationId") applicationId: string,
  ): Promise<InterviewListEnvelopeDto> {
    const reqWithCtx = req as FastifyRequest & { activeCompanyId?: string };
    const companyId = reqWithCtx.activeCompanyId ?? null;
    const data = await this.service.listForApplication(user, companyId, applicationId);
    return { data };
  }

  @Patch("interviews/:id/feedback")
  @Roles("recruiter")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update interview feedback + rating" })
  @ApiResponse({ status: 200, type: InterviewEnvelopeDto })
  async updateFeedback(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Param("id") id: string,
    @Body() dto: UpdateInterviewFeedbackDto,
    @Req() req: FastifyRequest,
  ): Promise<InterviewEnvelopeDto> {
    const data = await this.service.updateFeedback(
      user,
      activeCompany.companyId,
      id,
      dto,
      this.requestMeta(req),
    );
    return { data };
  }

  @Patch("interviews/:id/status")
  @Roles("recruiter")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Change interview status (cancel / mark completed / no-show)" })
  @ApiResponse({ status: 200, type: InterviewEnvelopeDto })
  async updateStatus(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Param("id") id: string,
    @Body() dto: UpdateInterviewStatusDto,
    @Req() req: FastifyRequest,
  ): Promise<InterviewEnvelopeDto> {
    const data = await this.service.updateStatus(
      user,
      activeCompany.companyId,
      id,
      dto,
      this.requestMeta(req),
    );
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
