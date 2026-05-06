import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type {
  AuthUser,
  InterviewStatus,
  RecruiterInterviewsQuery,
  ScheduleInterviewInput,
  UpdateInterviewFeedbackInput,
  UpdateInterviewStatusInput,
} from "@aurahire/shared";

import { AuditService } from "../../audit";
import { AUDIT_ACTIONS } from "../../audit/audit.types";
import { CacheService, TTL_SECONDS, TAGS } from "../../cache";
import { EmailService } from "../../email/email.service";
import { ApplicationsRepository } from "../applications/applications.repository";
import { JobsRepository } from "../jobs/jobs.repository";
import { ProfilesRepository } from "../profiles/profiles.repository";
import { InterviewsRepository, type RecruiterInterviewRow } from "./interviews.repository";
import type { InterviewDto } from "./dto/interview-response.dto";
import { InterviewScheduledEmail } from "../../email/templates/interview-scheduled";
import { InterviewCancelledEmail } from "../../email/templates/interview-cancelled";

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class InterviewsService {
  private readonly logger = new Logger(InterviewsService.name);

  constructor(
    private readonly repo: InterviewsRepository,
    private readonly applicationsRepo: ApplicationsRepository,
    private readonly jobsRepo: JobsRepository,
    private readonly profilesRepo: ProfilesRepository,
    private readonly email: EmailService,
    private readonly audit: AuditService,
    private readonly cacheService: CacheService,
  ) {}

  async schedule(
    user: AuthUser,
    companyId: string,
    applicationId: string,
    dto: ScheduleInterviewInput,
    requestMeta: RequestMeta = {},
  ): Promise<InterviewDto> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Recruiter role required" });
    }

    const application = await this.applicationsRepo.findApplicationContextForCompany(
      applicationId,
      companyId,
    );
    if (!application) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Application not found" });
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException({
        code: "INVALID_DATE",
        message: "scheduledAt is not a valid date",
      });
    }
    if (scheduledAt < new Date()) {
      throw new BadRequestException({
        code: "PAST_DATE",
        message: "Interview cannot be scheduled in the past",
      });
    }

    const interview = await this.repo.insert({
      applicationId,
      scheduledBy: user.id,
      scheduledAt,
      durationMinutes: dto.durationMinutes,
      format: dto.format,
      locationOrLink: dto.locationOrLink ?? null,
      status: "scheduled",
    });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.INTERVIEW_SCHEDULED,
      entityType: "interview",
      entityId: interview.id,
      companyId,
      details: {
        applicationId,
        scheduledAt: interview.scheduledAt.toISOString(),
        format: interview.format,
      },
      ...requestMeta,
    });

    await this.cacheService.bustTags([
      TAGS.companyInterviews(companyId),
      TAGS.interviewsCandidate(application.candidateId),
      TAGS.companyDashboard(companyId),
    ]);

    void this.notifyCandidateScheduled(interview.id).catch((err) => {
      this.logger.warn(`Notify candidate failed: ${(err as Error).message}`);
    });

    return this.toDto(interview);
  }

  async updateFeedback(
    user: AuthUser,
    companyId: string,
    interviewId: string,
    dto: UpdateInterviewFeedbackInput,
    requestMeta: RequestMeta = {},
  ): Promise<InterviewDto> {
    const interview = await this.requireCompanyOwnership(user, companyId, interviewId);

    const updated = await this.repo.update(interviewId, {
      feedback: dto.feedback,
      rating: dto.rating ?? null,
    });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.INTERVIEW_FEEDBACK_UPDATED,
      entityType: "interview",
      entityId: interviewId,
      companyId,
      details: {
        applicationId: interview.applicationId,
        rating: dto.rating ?? null,
      },
      ...requestMeta,
    });

    const app = await this.applicationsRepo.findById(interview.applicationId);
    if (app) {
      await this.cacheService.bustTags([
        TAGS.companyInterviews(companyId),
        TAGS.interviewsCandidate(app.candidateId),
        TAGS.companyDashboard(companyId),
      ]);
    }

    return this.toDto(updated);
  }

  async updateStatus(
    user: AuthUser,
    companyId: string,
    interviewId: string,
    dto: UpdateInterviewStatusInput,
    requestMeta: RequestMeta = {},
  ): Promise<InterviewDto> {
    const interview = await this.requireCompanyOwnership(user, companyId, interviewId);

    if (interview.status !== "scheduled") {
      throw new BadRequestException({
        code: "INVALID_STATUS_TRANSITION",
        message: `Cannot change status from '${interview.status}'`,
      });
    }

    const updated = await this.repo.update(interviewId, {
      status: dto.newStatus as InterviewStatus,
    });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.INTERVIEW_STATUS_CHANGED,
      entityType: "interview",
      entityId: interviewId,
      companyId,
      details: { from: interview.status, to: dto.newStatus },
      ...requestMeta,
    });

    const app = await this.applicationsRepo.findById(interview.applicationId);
    if (app) {
      await this.cacheService.bustTags([
        TAGS.companyInterviews(companyId),
        TAGS.interviewsCandidate(app.candidateId),
        TAGS.companyDashboard(companyId),
      ]);
    }

    if (dto.newStatus === "cancelled") {
      void this.notifyCandidateCancelled(interviewId).catch((err) => {
        this.logger.warn(`Cancel notify failed: ${(err as Error).message}`);
      });
    }

    return this.toDto(updated);
  }

  async listMine(user: AuthUser): Promise<InterviewDto[]> {
    if (user.role !== "candidate") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Candidate role required" });
    }
    return this.cacheService.getOrSet<InterviewDto[]>({
      key: `interviews:candidate:${user.id}:list`,
      ttlSeconds: TTL_SECONDS.hot,
      tags: [TAGS.interviewsCandidate(user.id)],
      telemetryName: "interviews:candidate:list",
      load: async () => {
        const rows = await this.repo.findByCandidateId(user.id);
        return rows.map((r) => this.toDto(r));
      },
    });
  }

  async listForApplication(
    user: AuthUser,
    companyId: string | null,
    applicationId: string,
  ): Promise<InterviewDto[]> {
    const app = await this.applicationsRepo.findById(applicationId);
    if (!app) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Application not found" });
    }

    if (user.role === "candidate" && app.candidateId !== user.id) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Application not found" });
    }
    if (user.role === "recruiter") {
      const job = await this.jobsRepo.findById(app.jobId);
      if (!job || job.companyId !== companyId) {
        throw new NotFoundException({ code: "NOT_FOUND", message: "Application not found" });
      }
    }

    const rows = await this.repo.findByApplicationId(applicationId);
    return rows.map((r) => this.toDto(r));
  }

  async listForRecruiter(
    user: AuthUser,
    companyId: string,
    query: RecruiterInterviewsQuery,
  ): Promise<{
    data: InterviewDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Recruiter role required" });
    }
    const { rows, total } = await this.repo.listForCompanyPaginated(companyId, query);
    return {
      data: rows.map((row) => this.toDtoFromRecruiterRow(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  // -----------------------------------------------------------------
  // PRIVATE
  // -----------------------------------------------------------------

  private async requireCompanyOwnership(
    user: AuthUser,
    companyId: string,
    interviewId: string,
  ): Promise<{
    id: string;
    applicationId: string;
    scheduledBy: string;
    scheduledAt: Date;
    durationMinutes: number;
    format: string;
    locationOrLink: string | null;
    status: string;
    feedback: string | null;
    rating: number | null;
    createdAt: Date;
    updatedAt: Date;
  }> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Recruiter role required" });
    }
    const interview = await this.repo.findById(interviewId);
    if (!interview) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Interview not found" });
    }
    const ownership = await this.applicationsRepo.findApplicationContextForCompany(
      interview.applicationId,
      companyId,
    );
    if (!ownership) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Interview not found" });
    }
    return interview;
  }

  private async notifyCandidateScheduled(interviewId: string): Promise<void> {
    const interview = await this.repo.findById(interviewId);
    if (!interview) return;
    const app = await this.applicationsRepo.findById(interview.applicationId);
    if (!app) return;
    const candidate = await this.profilesRepo.findById(app.candidateId);
    const jobRow = await this.jobsRepo.findByIdWithCompany(app.jobId);
    if (!candidate || !jobRow) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    await this.email.send({
      to: candidate.email,
      subject: `Interview scheduled: ${jobRow.title}`,
      template: InterviewScheduledEmail({
        candidateName: candidate.fullName,
        jobTitle: jobRow.title,
        companyName: jobRow.company.name,
        scheduledAt: interview.scheduledAt.toISOString(),
        durationMinutes: interview.durationMinutes,
        format: interview.format,
        locationOrLink: interview.locationOrLink,
        applicationUrl: `${appUrl}/candidate/applications/${app.id}`,
      }),
    });
  }

  private async notifyCandidateCancelled(interviewId: string): Promise<void> {
    const interview = await this.repo.findById(interviewId);
    if (!interview) return;
    const app = await this.applicationsRepo.findById(interview.applicationId);
    if (!app) return;
    const candidate = await this.profilesRepo.findById(app.candidateId);
    const jobRow = await this.jobsRepo.findByIdWithCompany(app.jobId);
    if (!candidate || !jobRow) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    await this.email.send({
      to: candidate.email,
      subject: `Interview cancelled: ${jobRow.title}`,
      template: InterviewCancelledEmail({
        candidateName: candidate.fullName,
        jobTitle: jobRow.title,
        companyName: jobRow.company.name,
        scheduledAt: interview.scheduledAt.toISOString(),
        applicationUrl: `${appUrl}/candidate/applications/${app.id}`,
      }),
    });
  }

  private toDto(i: {
    id: string;
    applicationId: string;
    scheduledBy: string;
    scheduledAt: Date;
    durationMinutes: number;
    format: string;
    locationOrLink: string | null;
    status: string;
    feedback: string | null;
    rating: number | null;
    createdAt: Date;
    updatedAt: Date;
  }): InterviewDto {
    return {
      id: i.id,
      applicationId: i.applicationId,
      scheduledBy: i.scheduledBy,
      scheduledAt: i.scheduledAt.toISOString(),
      durationMinutes: i.durationMinutes,
      format: i.format,
      locationOrLink: i.locationOrLink,
      status: i.status,
      feedback: i.feedback,
      rating: i.rating,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    };
  }

  private toDtoFromRecruiterRow(row: RecruiterInterviewRow): InterviewDto {
    return {
      ...this.toDto(row),
      candidate:
        row.candidateId && row.candidateFullName !== null
          ? {
              id: row.candidateId,
              fullName: row.candidateFullName,
              email: row.candidateEmail ?? "",
            }
          : null,
      job:
        row.jobId && row.jobTitle
          ? { id: row.jobId, title: row.jobTitle }
          : null,
    };
  }
}
