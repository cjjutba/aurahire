import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type {
  AuthUser,
  ApplicationStatus,
  ApplyToJobInput,
  UpdateApplicationStatusInput,
  UpdateApplicationNotesInput,
} from "@aurahire/shared";

import { AuditService } from "../../audit";
import { CacheService, TTL_SECONDS, TAGS } from "../../cache";
import { EmailService } from "../../email/email.service";
import { JobsRepository } from "../jobs/jobs.repository";
import { ProfilesRepository } from "../profiles/profiles.repository";
import { ResumesRepository } from "../resumes/resumes.repository";
import { ScoringService } from "../scoring/scoring.service";
import { StorageService } from "../../storage/storage.service";
import { ApplicationsRepository } from "./applications.repository";
import { canTransition } from "./state-machine";
import type {
  ApplicationDto,
  ApplicationCandidateDto,
} from "./dto/application-response.dto";
import {
  ApplicationCompanyDto,
  ApplicationJobDto,
  MatchScoreDto,
} from "./dto/application-response.dto";
import { ApplicationReceivedEmail } from "../../email/templates/application-received";
import { ApplicationStatusChangedEmail } from "../../email/templates/application-status-changed";

const RESUMES_BUCKET = "resumes";

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly repo: ApplicationsRepository,
    private readonly jobsRepo: JobsRepository,
    private readonly profilesRepo: ProfilesRepository,
    private readonly resumesRepo: ResumesRepository,
    private readonly scoringService: ScoringService,
    private readonly storage: StorageService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
    private readonly cacheService: CacheService,
  ) {}

  // -----------------------------------------------------------------
  // APPLY
  // -----------------------------------------------------------------

  async apply(
    user: AuthUser,
    dto: ApplyToJobInput,
    requestMeta: RequestMeta = {},
  ): Promise<ApplicationDto> {
    if (user.role !== "candidate") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Candidate role required",
      });
    }

    const job = await this.jobsRepo.findById(dto.jobId);
    if (!job) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Job not found" });
    }
    if (job.status !== "published") {
      throw new BadRequestException({
        code: "JOB_NOT_PUBLISHED",
        message: "This job isn't accepting applications",
      });
    }
    if (job.applicationDeadline && new Date(job.applicationDeadline) < new Date()) {
      throw new BadRequestException({
        code: "JOB_DEADLINE_PASSED",
        message: "Application deadline has passed",
      });
    }

    let resumeId = dto.resumeId;
    if (!resumeId) {
      const defaultResume = await this.resumesRepo.findDefaultByCandidateId(user.id);
      if (!defaultResume) {
        throw new BadRequestException({
          code: "NO_DEFAULT_RESUME",
          message: "Upload a resume before applying",
        });
      }
      resumeId = defaultResume.id;
    }

    const resume = await this.resumesRepo.findById(resumeId);
    if (!resume || resume.candidateId !== user.id) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Resume not found" });
    }
    if (resume.parseStatus !== "parsed") {
      throw new BadRequestException({
        code: "RESUME_NOT_PARSED",
        message: "Resume hasn't been parsed yet — try again in a moment",
      });
    }

    const existing = await this.repo.findExisting(user.id, dto.jobId);
    if (existing) {
      throw new ConflictException({
        code: "DUPLICATE_APPLICATION",
        message: "You've already applied to this job",
      });
    }

    const application = await this.repo.insert({
      jobId: dto.jobId,
      candidateId: user.id,
      resumeId,
      coverLetter: dto.coverLetter ?? null,
      status: "applied",
    });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "application.created",
      entityType: "application",
      entityId: application.id,
      // Audit logs use the *job's* company so admin per-tenant queries
      // catch every application that landed under company X — even if the
      // applying candidate isn't a member of any tenant.
      companyId: job.companyId,
      details: { jobId: dto.jobId, resumeId },
      ...requestMeta,
    });

    await this.cacheService.bustTags([
      TAGS.applicationsCandidate(user.id),
      TAGS.companyDashboard(job.companyId),
      TAGS.companyApplications(job.companyId),
    ]);

    let matchScoreDto: MatchScoreDto | null = null;
    try {
      matchScoreDto = await this.scoringService.computeMatchScore(
        application.id,
        user.id,
        dto.jobId,
        resumeId,
        {
          title: job.title,
          department: job.department,
          experienceLevel: job.experienceLevel,
          educationRequirement: job.educationRequirement,
          requiredSkills: job.requiredSkills,
          descriptionPlain: job.descriptionPlain,
          companyId: job.companyId,
        },
        requestMeta,
      );
    } catch (err) {
      this.logger.error(
        `Match score failed for application ${application.id}: ${(err as Error).message}`,
      );
    }

    void this.notifyRecruiterOfApplication(application.id).catch((err) => {
      this.logger.warn(`Recruiter notify failed: ${(err as Error).message}`);
    });

    return this.toDto(application.id, { matchScore: matchScoreDto });
  }

  // -----------------------------------------------------------------
  // LIST + DETAIL
  // -----------------------------------------------------------------

  async listMine(user: AuthUser): Promise<ApplicationDto[]> {
    if (user.role !== "candidate") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Candidate role required",
      });
    }
    return this.cacheService.getOrSet<ApplicationDto[]>({
      key: `applications:candidate:${user.id}:list`,
      ttlSeconds: TTL_SECONDS.hot,
      tags: [TAGS.applicationsCandidate(user.id)],
      telemetryName: "applications:candidate:list",
      load: async () => {
        const apps = await this.repo.findByCandidateId(user.id);
        return Promise.all(apps.map((a) => this.toDto(a.id)));
      },
    });
  }

  async listForJob(
    user: AuthUser,
    companyId: string,
    jobId: string,
  ): Promise<ApplicationDto[]> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }
    const job = await this.jobsRepo.findById(jobId);
    if (!job || job.companyId !== companyId) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Job not found" });
    }
    const apps = await this.repo.findByJobIdSortedByMatchScore(jobId);
    return Promise.all(apps.map((a) => this.toDto(a.id)));
  }

  // ─── Recruiter dashboard stats (company-scoped) ────────────────────

  async recruiterStats(
    user: AuthUser,
    companyId: string,
    range: "7d" | "30d" | "90d" | "all" = "7d",
  ): Promise<{
    activeJobs: number;
    totalApplications: number;
    totalApps: number;
    pendingReviews: number;
    pendingReview: number;
    inInterview: number;
    offered: number;
    hired: number;
    avgMatchScore: number;
    biasFlags: number;
  }> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }
    return this.cacheService.getOrSet({
      key: `dashboard:company:${companyId}:stats:${range}`,
      ttlSeconds: TTL_SECONDS.hot,
      tags: [TAGS.companyDashboard(companyId)],
      telemetryName: "dashboard:company:stats",
      load: () => this.repo.companyStats(companyId, range),
    });
  }

  async recentForRecruiter(
    user: AuthUser,
    companyId: string,
    limit: number,
  ): Promise<ApplicationDto[]> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }

    return this.cacheService.getOrSet<ApplicationDto[]>({
      key: `dashboard:company:${companyId}:recent:${limit}`,
      ttlSeconds: TTL_SECONDS.hot,
      tags: [TAGS.companyDashboard(companyId)],
      telemetryName: "dashboard:company:recent",
      load: async () => {
        const rows = await this.repo.listRecentForCompany(companyId, limit);
        return rows.map((row) => this.toDashboardDto(row));
      },
    });
  }

  async addToShortlist(
    user: AuthUser,
    companyId: string,
    applicationId: string,
  ): Promise<ApplicationDto> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Recruiter role required" });
    }
    const owned = await this.repo.findApplicationContextForCompany(applicationId, companyId);
    if (!owned) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Application not found" });
    }
    const updated = await this.repo.setShortlistedAt(applicationId, new Date());
    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "application.shortlisted",
      entityType: "application",
      entityId: applicationId,
      companyId,
      details: {},
    });
    await this.cacheService.bustTags([
      TAGS.companyDashboard(companyId),
      TAGS.companyApplications(companyId),
      TAGS.companyShortlist(companyId),
    ]);
    return {
      id: updated.id,
      jobId: updated.jobId,
      candidateId: updated.candidateId,
      resumeId: updated.resumeId,
      coverLetter: updated.coverLetter,
      status: updated.status,
      recruiterNotes: updated.recruiterNotes,
      appliedAt: updated.appliedAt.toISOString(),
      statusUpdatedAt: updated.statusUpdatedAt.toISOString(),
      shortlistedAt: updated.shortlistedAt?.toISOString() ?? null,
      matchScore: null,
      candidate: null,
      job: null,
    };
  }

  async removeFromShortlist(
    user: AuthUser,
    companyId: string,
    applicationId: string,
  ): Promise<ApplicationDto> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Recruiter role required" });
    }
    const owned = await this.repo.findApplicationContextForCompany(applicationId, companyId);
    if (!owned) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Application not found" });
    }
    const updated = await this.repo.setShortlistedAt(applicationId, null);
    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "application.unshortlisted",
      entityType: "application",
      entityId: applicationId,
      companyId,
      details: {},
    });
    await this.cacheService.bustTags([
      TAGS.companyDashboard(companyId),
      TAGS.companyApplications(companyId),
      TAGS.companyShortlist(companyId),
    ]);
    return {
      id: updated.id,
      jobId: updated.jobId,
      candidateId: updated.candidateId,
      resumeId: updated.resumeId,
      coverLetter: updated.coverLetter,
      status: updated.status,
      recruiterNotes: updated.recruiterNotes,
      appliedAt: updated.appliedAt.toISOString(),
      statusUpdatedAt: updated.statusUpdatedAt.toISOString(),
      shortlistedAt: updated.shortlistedAt?.toISOString() ?? null,
      matchScore: null,
      candidate: null,
      job: null,
    };
  }

  async listShortlistForRecruiter(
    user: AuthUser,
    companyId: string,
    query: {
      page: number;
      limit: number;
      q?: string;
      status?: ApplicationStatus;
      jobId?: string;
      band?: "strong" | "partial" | "limited";
      sort: "recently-shortlisted" | "highest-score" | "earliest-applied";
    },
  ): Promise<{
    data: ApplicationDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Recruiter role required" });
    }
    const { rows, total } = await this.repo.listShortlistedForCompany(companyId, query);
    return {
      data: rows.map((row) => this.toDashboardDto(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  // ─── Recruiter analytics bundle ────────────────────────────────────

  async recruiterAnalytics(
    user: AuthUser,
    companyId: string,
  ): Promise<{
    kpis: {
      activeJobs: number;
      totalApplications: number;
      pendingReviews: number;
      avgMatchScore: number;
    };
    topJobs: Array<{ jobId: string; title: string; status: string; applicationCount: number; avgScore: number }>;
    applicationsByStatus: Array<{ status: string; count: number }>;
  }> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }
    return this.cacheService.getOrSet({
      key: `dashboard:company:${companyId}:analytics`,
      ttlSeconds: TTL_SECONDS.hot,
      tags: [TAGS.companyDashboard(companyId)],
      telemetryName: "dashboard:company:analytics",
      load: async () => {
        const [kpis, topJobs, applicationsByStatus] = await Promise.all([
          this.repo.companyStats(companyId, "all"),
          this.repo.companyTopJobsByApplications(companyId, 5),
          this.repo.companyApplicationsByStatus(companyId),
        ]);
        return { kpis, topJobs, applicationsByStatus };
      },
    });
  }

  /**
   * Read an application detail. Auth model:
   *  - Candidate: must own the row (`candidate_id = user.id`)
   *  - Recruiter: the job's company must equal the caller's active company
   *  - Admin: bypass
   *
   * `companyId` is required for recruiter callers and ignored for the others.
   */
  async getById(
    user: AuthUser,
    companyId: string | null,
    id: string,
  ): Promise<ApplicationDto> {
    const app = await this.repo.findById(id);
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

    return this.toDto(id);
  }

  // -----------------------------------------------------------------
  // STATUS / NOTES / WITHDRAW
  // -----------------------------------------------------------------

  async updateStatus(
    user: AuthUser,
    companyId: string,
    id: string,
    dto: UpdateApplicationStatusInput,
    requestMeta: RequestMeta = {},
  ): Promise<ApplicationDto> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }

    const app = await this.repo.findById(id);
    if (!app) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Application not found" });
    }

    const job = await this.jobsRepo.findById(app.jobId);
    if (!job || job.companyId !== companyId) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Application not found" });
    }

    if (!canTransition(app.status as ApplicationStatus, dto.newStatus)) {
      throw new BadRequestException({
        code: "INVALID_STATUS_TRANSITION",
        message: `Cannot transition from ${app.status} to ${dto.newStatus}`,
      });
    }

    await this.repo.update(id, {
      status: dto.newStatus,
      statusUpdatedAt: new Date(),
      ...(dto.note
        ? { recruiterNotes: this.appendNote(app.recruiterNotes, dto.note) }
        : {}),
    });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "application.status_changed",
      entityType: "application",
      entityId: id,
      companyId,
      details: { from: app.status, to: dto.newStatus, note: dto.note ?? null },
      ...requestMeta,
    });

    await this.cacheService.bustTags([
      TAGS.companyDashboard(companyId),
      TAGS.companyApplications(companyId),
      TAGS.companyShortlist(companyId),
      TAGS.applicationsCandidate(app.candidateId),
    ]);

    void this.notifyCandidateOfStatusChange(id, app.status, dto.newStatus).catch((err) => {
      this.logger.warn(`Candidate notify failed: ${(err as Error).message}`);
    });

    return this.toDto(id);
  }

  async updateNotes(
    user: AuthUser,
    companyId: string,
    id: string,
    dto: UpdateApplicationNotesInput,
    requestMeta: RequestMeta = {},
  ): Promise<ApplicationDto> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }

    const app = await this.repo.findById(id);
    if (!app) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Application not found" });
    }

    const job = await this.jobsRepo.findById(app.jobId);
    if (!job || job.companyId !== companyId) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Application not found" });
    }

    await this.repo.update(id, { recruiterNotes: dto.notes });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "application.notes_updated",
      entityType: "application",
      entityId: id,
      companyId,
      ...requestMeta,
    });

    await this.cacheService.bustTags([
      TAGS.companyDashboard(companyId),
      TAGS.companyApplications(companyId),
      TAGS.applicationsCandidate(app.candidateId),
    ]);

    return this.toDto(id);
  }

  /**
   * System-initiated status transition (used by OffersService when an offer
   * is sent or accepted). Bypasses the recruiter role check + state-machine
   * guard since the action is driven by an offer event, not direct UI action.
   * Still audits + notifies the candidate so the trail stays complete.
   */
  async transitionFromSystem(
    actor: AuthUser,
    id: string,
    newStatus: ApplicationStatus,
    note: string,
    requestMeta: RequestMeta = {},
  ): Promise<ApplicationDto> {
    const app = await this.repo.findById(id);
    if (!app) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Application not found" });
    }
    if (app.status === newStatus) {
      return this.toDto(id);
    }

    await this.repo.update(id, {
      status: newStatus,
      statusUpdatedAt: new Date(),
      recruiterNotes: this.appendNote(app.recruiterNotes, note),
    });

    const job = await this.jobsRepo.findById(app.jobId);

    await this.audit.log({
      actorId: actor.id,
      actorType: "user",
      action: "application.status_changed",
      entityType: "application",
      entityId: id,
      // Pull tenant from the job since the system actor (often the
      // recruiter who triggered an offer event) may not have an active
      // company context for the same tenant — the *application* belongs
      // to job.companyId either way.
      companyId: job?.companyId ?? null,
      details: { from: app.status, to: newStatus, note, system: true },
      ...requestMeta,
    });

    if (job) {
      await this.cacheService.bustTags([
        TAGS.companyDashboard(job.companyId),
        TAGS.companyApplications(job.companyId),
        TAGS.companyShortlist(job.companyId),
        TAGS.applicationsCandidate(app.candidateId),
      ]);
    } else {
      await this.cacheService.bustTags([TAGS.applicationsCandidate(app.candidateId)]);
    }

    void this.notifyCandidateOfStatusChange(id, app.status, newStatus).catch((err) => {
      this.logger.warn(`Candidate notify failed: ${(err as Error).message}`);
    });

    return this.toDto(id);
  }

  async withdraw(
    user: AuthUser,
    id: string,
    requestMeta: RequestMeta = {},
  ): Promise<ApplicationDto> {
    if (user.role !== "candidate") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Candidate role required",
      });
    }

    const app = await this.repo.findById(id);
    if (!app || app.candidateId !== user.id) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Application not found" });
    }

    if (["hired", "rejected", "withdrawn"].includes(app.status)) {
      throw new BadRequestException({
        code: "ALREADY_TERMINAL",
        message: "Application is already in a terminal state",
      });
    }

    await this.repo.update(id, {
      status: "withdrawn",
      statusUpdatedAt: new Date(),
    });

    const withdrawnJob = await this.jobsRepo.findById(app.jobId);

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "application.withdrawn",
      entityType: "application",
      entityId: id,
      // The candidate-acting-on-self pattern; tag with the company that
      // owns the job so per-tenant audit queries see this row.
      companyId: withdrawnJob?.companyId ?? null,
      ...requestMeta,
    });
    if (withdrawnJob) {
      await this.cacheService.bustTags([
        TAGS.applicationsCandidate(user.id),
        TAGS.companyDashboard(withdrawnJob.companyId),
        TAGS.companyApplications(withdrawnJob.companyId),
      ]);
    } else {
      await this.cacheService.bustTags([TAGS.applicationsCandidate(user.id)]);
    }

    return this.toDto(id);
  }

  // -----------------------------------------------------------------
  // RESUME DOWNLOAD (recruiter-aware)
  // -----------------------------------------------------------------

  async getResumeDownload(
    user: AuthUser,
    companyId: string | null,
    applicationId: string,
  ): Promise<{ signedUrl: string; expiresAt: string }> {
    const app = await this.repo.findById(applicationId);
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

    const resume = await this.resumesRepo.findById(app.resumeId);
    if (!resume) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Resume not found" });
    }

    const expiresIn = 60 * 60;
    const signedUrl = await this.storage.signedUrl({
      bucket: RESUMES_BUCKET,
      path: resume.storagePath,
      expiresIn,
    });

    return {
      signedUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  // -----------------------------------------------------------------
  // PRIVATE
  // -----------------------------------------------------------------

  private async toDto(
    applicationId: string,
    overrides?: { matchScore?: MatchScoreDto | null },
  ): Promise<ApplicationDto> {
    const app = await this.repo.findById(applicationId);
    if (!app) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Application not found" });
    }

    const matchScore =
      overrides?.matchScore !== undefined
        ? overrides.matchScore
        : await this.scoringService.getMatchScoreByApplicationId(applicationId);

    const candidateProfile = await this.profilesRepo.findById(app.candidateId);
    const candidateProfileExt = await this.profilesRepo.findCandidateProfile(app.candidateId);

    const candidate: ApplicationCandidateDto | null = candidateProfile
      ? {
          id: candidateProfile.id,
          fullName: candidateProfile.fullName,
          email: candidateProfile.email,
          phone: candidateProfile.phone,
          headline: candidateProfileExt?.headline ?? null,
        }
      : null;

    const jobRow = await this.jobsRepo.findByIdWithCompany(app.jobId);
    const job: ApplicationJobDto | null = jobRow
      ? {
          id: jobRow.id,
          title: jobRow.title,
          department: jobRow.department,
          employmentType: jobRow.employmentType,
          workMode: jobRow.workMode,
          company: {
            id: jobRow.company.id,
            name: jobRow.company.name,
            logoUrl: jobRow.company.logoUrl,
          },
        }
      : null;

    return {
      id: app.id,
      jobId: app.jobId,
      candidateId: app.candidateId,
      resumeId: app.resumeId,
      coverLetter: app.coverLetter,
      status: app.status,
      recruiterNotes: app.recruiterNotes,
      appliedAt: app.appliedAt.toISOString(),
      statusUpdatedAt: app.statusUpdatedAt.toISOString(),
      shortlistedAt: app.shortlistedAt?.toISOString() ?? null,
      matchScore,
      candidate,
      job,
    };
  }

  private toDashboardDto(row: {
    id: string;
    jobId: string;
    candidateId: string;
    resumeId: string;
    coverLetter: string | null;
    status: ApplicationStatus;
    recruiterNotes: string | null;
    appliedAt: Date;
    statusUpdatedAt: Date;
    shortlistedAt: Date | null;
    matchScore: { id: string; overallScore: number; band: string } | null;
    candidateFullName: string | null;
    candidateEmail: string | null;
    jobTitle: string | null;
  }): ApplicationDto {
    return {
      id: row.id,
      jobId: row.jobId,
      candidateId: row.candidateId,
      resumeId: row.resumeId,
      coverLetter: row.coverLetter,
      status: row.status,
      recruiterNotes: row.recruiterNotes,
      appliedAt: row.appliedAt.toISOString(),
      statusUpdatedAt: row.statusUpdatedAt.toISOString(),
      shortlistedAt: row.shortlistedAt?.toISOString() ?? null,
      matchScore: row.matchScore
        ? Object.assign(new MatchScoreDto(), {
            id: row.matchScore.id,
            overallScore: row.matchScore.overallScore,
            band: row.matchScore.band,
            // Dashboard rows do not need the full breakdown — only score + band.
            components: [],
            summary: "",
            redFlags: null,
            greenFlags: null,
            redactedFields: [],
            promptVersion: "",
            modelUsed: "",
            latencyMs: 0,
            createdAt: "",
          })
        : null,
      candidate:
        row.candidateFullName && row.candidateEmail
          ? {
              id: row.candidateId,
              fullName: row.candidateFullName,
              email: row.candidateEmail,
              phone: null,
              headline: null,
            }
          : null,
      job: row.jobTitle
        ? Object.assign(new ApplicationJobDto(), {
            id: row.jobId,
            title: row.jobTitle,
            department: null,
            employmentType: "",
            workMode: "",
            company: Object.assign(new ApplicationCompanyDto(), {
              id: "",
              name: "",
              logoUrl: null,
            }),
          })
        : null,
    };
  }

  private appendNote(existing: string | null, note: string): string {
    const stamp = new Date().toISOString();
    const prefix = `[${stamp}] `;
    return existing ? `${existing}\n\n${prefix}${note}` : `${prefix}${note}`;
  }

  private async notifyRecruiterOfApplication(applicationId: string): Promise<void> {
    const app = await this.repo.findById(applicationId);
    if (!app) return;

    const jobRow = await this.jobsRepo.findByIdWithCompany(app.jobId);
    if (!jobRow) return;

    const recruiter = await this.profilesRepo.findById(jobRow.recruiterId);
    if (!recruiter) return;

    const candidate = await this.profilesRepo.findById(app.candidateId);
    if (!candidate) return;

    const matchScore = await this.scoringService.getMatchScoreByApplicationId(applicationId);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    await this.email.send({
      to: recruiter.email,
      subject: `New application: ${candidate.fullName} for ${jobRow.title}`,
      template: ApplicationReceivedEmail({
        recruiterName: recruiter.fullName,
        candidateName: candidate.fullName,
        jobTitle: jobRow.title,
        matchBand: matchScore?.band ?? null,
        matchScore: matchScore?.overallScore ?? null,
        applicationUrl: `${appUrl}/recruiter/applications/${applicationId}`,
        company: { name: jobRow.company.name, logoUrl: jobRow.company.logoUrl },
      }),
    });

    await this.audit.log({
      actorId: null,
      actorType: "system",
      action: "application.email_sent",
      entityType: "application",
      entityId: applicationId,
      companyId: jobRow.companyId,
      details: { recipient: recruiter.email, kind: "received" },
    });
  }

  private async notifyCandidateOfStatusChange(
    applicationId: string,
    fromStatus: string,
    toStatus: string,
  ): Promise<void> {
    const app = await this.repo.findById(applicationId);
    if (!app) return;

    const candidate = await this.profilesRepo.findById(app.candidateId);
    if (!candidate) return;

    const jobRow = await this.jobsRepo.findByIdWithCompany(app.jobId);
    if (!jobRow) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    await this.email.send({
      to: candidate.email,
      subject: `Update on your application for ${jobRow.title}`,
      template: ApplicationStatusChangedEmail({
        candidateName: candidate.fullName,
        jobTitle: jobRow.title,
        companyName: jobRow.company.name,
        previousStatus: fromStatus,
        newStatus: toStatus,
        applicationUrl: `${appUrl}/candidate/applications/${applicationId}`,
        company: { name: jobRow.company.name, logoUrl: jobRow.company.logoUrl },
      }),
    });
  }
}
