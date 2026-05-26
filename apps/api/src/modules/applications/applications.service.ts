import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import type {
  AuthUser,
  ApplicationStatus,
  ApplyToJobInput,
  UpdateApplicationStatusInput,
  UpdateApplicationNotesInput,
  WithdrawApplicationInput,
} from "@aurahire/shared";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";
import { eq, inArray } from "drizzle-orm";
import { interviewsTable, scoringConfigTable } from "@aurahire/db";
import { AuditService, AUDIT_ACTIONS } from "../../audit";
import { AUTO_REJECT_THRESHOLD } from "@aurahire/shared";
import { isIdentityRevealedForRecruiter } from "./dto/identity-reveal.helper";
import { redactApplicationForRecruiter } from "./dto/redact-for-recruiter";
import { maybeAutoRejectByScore } from "./auto-reject-on-score.helper";
import { CacheService, TTL_SECONDS, TAGS } from "../../cache";
import { EventsService } from "../../realtime";
import { EmailService } from "../../email/email.service";
import { MatchScoreQueueService } from "../../queue/match-score-queue.service";
import { JobsRepository } from "../jobs/jobs.repository";
import { NotificationsService } from "../notifications/notifications.service";
import { ProfilesRepository } from "../profiles/profiles.repository";
import { ResumesRepository } from "../resumes/resumes.repository";
import { ScoringService } from "../scoring/scoring.service";
import { StorageService } from "../../storage/storage.service";
import { ApplicationsRepository } from "./applications.repository";
import type { ApplicationsTx } from "./applications.repository";
import {
  canTransition,
  STATUSES_REQUIRING_ACCEPTED_OFFER,
} from "./state-machine";
import { OffersRepository } from "../offers/offers.repository";
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
import { PositionFilledEmail } from "../../email/templates/position-filled";

const RESUMES_BUCKET = "resumes";

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly repo: ApplicationsRepository,
    private readonly jobsRepo: JobsRepository,
    @Inject(forwardRef(() => OffersRepository))
    private readonly offersRepo: OffersRepository,
    private readonly profilesRepo: ProfilesRepository,
    private readonly resumesRepo: ResumesRepository,
    private readonly scoringService: ScoringService,
    private readonly storage: StorageService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
    private readonly cacheService: CacheService,
    private readonly events: EventsService,
    private readonly matchScoreQueue: MatchScoreQueueService,
    private readonly notifications: NotificationsService,
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
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Job not found",
      });
    }
    if (job.status !== "published") {
      throw new BadRequestException({
        code: "JOB_NOT_PUBLISHED",
        message: "This job isn't accepting applications",
      });
    }
    if (
      job.applicationDeadline &&
      new Date(job.applicationDeadline) < new Date()
    ) {
      throw new BadRequestException({
        code: "JOB_DEADLINE_PASSED",
        message: "Application deadline has passed",
      });
    }

    let resumeId = dto.resumeId;
    if (!resumeId) {
      const defaultResume = await this.resumesRepo.findDefaultByCandidateId(
        user.id,
      );
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
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Resume not found",
      });
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

    // Per thesis panel revision (May 2026): when a candidate has already
    // computed a preview match score for this exact (candidate, job,
    // resume) triple AND that score is below the active auto-reject
    // threshold, refuse the apply outright. Previously the application
    // was created and then auto-rejected milliseconds later — wasted
    // work + confusing UX (the candidate sees the rejected status
    // before they finish their tab switch). With this guard, the apply
    // endpoint returns a 400 with a clear code the UI can render.
    //
    // We deliberately do NOT call the LLM here to score on-demand. If no
    // preview exists yet, we let the apply through and the async worker
    // computes + auto-rejects as before.
    const existingPreview = await this.scoringService.findRawPreview(
      user.id,
      dto.jobId,
      resumeId,
    );
    if (existingPreview) {
      const threshold = await this.getAutoRejectThreshold();
      if (existingPreview.overallScore < threshold) {
        throw new BadRequestException({
          code: "APPLY_BELOW_INTERVIEW_THRESHOLD",
          message: `Your match score (${existingPreview.overallScore}/100) is below the ${threshold} minimum this role requires.`,
          details: {
            overallScore: existingPreview.overallScore,
            threshold,
          },
        });
      }
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

    this.events.emitApplicationCreated({
      applicationId: application.id,
      jobId: application.jobId,
      recruiterId: job.recruiterId,
      candidateId: application.candidateId,
      createdAt:
        application.createdAt instanceof Date
          ? application.createdAt.toISOString()
          : new Date(application.createdAt).toISOString(),
    });

    // Synchronous fast-path: if a preview already covers this exact
    // (candidate, job, resume) triple — i.e. the candidate saw "See my match"
    // before applying, or it was auto-pre-computed during resume parse — we
    // promote it inline. No OpenAI call, no queue, no shimmer on the detail
    // page. The async worker stays as the fallback for first-time scoring.
    let promotedScore: MatchScoreDto | null = null;
    try {
      promotedScore = await this.scoringService.tryPromoteMatchPreview(
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
      this.logger.warn(
        `Sync preview promotion failed for application ${application.id}: ${(err as Error).message}. Falling back to async worker.`,
      );
    }

    if (promotedScore) {
      await this.repo.update(application.id, { scoreStatus: "completed" });
      this.events.emitApplicationScored({
        applicationId: application.id,
        jobId: application.jobId,
        recruiterId: job.recruiterId,
        candidateId: application.candidateId,
        overallScore: promotedScore.overallScore,
        band: promotedScore.band,
        scoredAt: new Date().toISOString(),
      });

      // Score-based auto-rejection (thesis panel revision, May 2026).
      // Sync path: when the preview promotion gave us an inline score,
      // we evaluate the threshold immediately so the candidate sees the
      // rejection without the realtime latency of the async worker.
      try {
        const threshold = await this.getAutoRejectThreshold();
        await maybeAutoRejectByScore(
          {
            applicationsService: {
              findStatus: (id) => this.findStatus(id),
              transitionFromSystem: (id, to, transitionArgs) =>
                this.autoRejectByLowScore(id, to, transitionArgs),
            },
            logger: this.logger,
          },
          {
            applicationId: application.id,
            overallScore: promotedScore.overallScore,
            threshold,
          },
        );
      } catch (err) {
        this.logger.warn(
          `Sync auto-reject failed for application ${application.id}: ${(err as Error).message}`,
        );
      }
    } else {
      // No preview to promote — defer to the async worker. The DB row
      // already has score_status='computing' from the schema default; the
      // worker will flip it to 'completed' (or 'failed') and broadcast
      // application.scored when done.
      await this.matchScoreQueue.enqueue({
        applicationId: application.id,
        candidateId: user.id,
        jobId: dto.jobId,
        resumeId,
      });
    }

    void this.notifyRecruiterOfApplication(application.id).catch((err) => {
      this.logger.warn(`Recruiter notify failed: ${(err as Error).message}`);
    });

    // In-app notification to the recruiter team (currently the single hiring
    // recruiter who owns the job — the data model will expand to multi-member
    // hiring teams later, at which point emitMany already supports it).
    const recruiterUserIds = [job.recruiterId].filter((id): id is string =>
      Boolean(id),
    );
    // Resolve the company once so the notification can render
    // "Applied to <jobTitle> at <companyName>" instead of fallback text.
    const jobWithCompany = await this.jobsRepo.findByIdWithCompany(dto.jobId);
    void this.notifications
      .emitMany(recruiterUserIds, {
        eventType: "new_application_received",
        scope: "personal",
        entityType: "application",
        entityId: application.id,
        actorId: user.id,
        metadata: {
          applicationId: application.id,
          jobId: dto.jobId,
          jobTitle: job.title,
          companyName: jobWithCompany?.company.name ?? null,
          candidateId: user.id,
          candidateName: user.fullName,
          // Score may be null when async scoring is in flight; the template
          // surfaces "pending" in that case and the realtime
          // application.scored event refreshes the recruiter UI when ready.
          scoreValue: promotedScore?.overallScore ?? null,
          matchBand: promotedScore?.band ?? null,
          occurredAt: new Date().toISOString(),
        },
      })
      .catch((err) => {
        this.logger.warn(
          `notifications.emitMany(new_application_received) failed: ${(err as Error).message}`,
        );
      });

    return this.toDto(application.id);
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
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Job not found",
      });
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
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }
    const owned = await this.repo.findApplicationContextForCompany(
      applicationId,
      companyId,
    );
    if (!owned) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Application not found",
      });
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
      scoreStatus: updated.scoreStatus,
      recruiterNotes: updated.recruiterNotes,
      appliedAt: updated.appliedAt.toISOString(),
      statusUpdatedAt: updated.statusUpdatedAt.toISOString(),
      shortlistedAt: updated.shortlistedAt?.toISOString() ?? null,
      matchScore: null,
      candidate: null,
      job: null,
      inflightSiblingsCount: 0,
      // Shortlist mutation returns a stripped DTO; reveal is decided
      // by the caller's redaction wrapper when needed.
      identityRevealed: true,
    };
  }

  async removeFromShortlist(
    user: AuthUser,
    companyId: string,
    applicationId: string,
  ): Promise<ApplicationDto> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }
    const owned = await this.repo.findApplicationContextForCompany(
      applicationId,
      companyId,
    );
    if (!owned) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Application not found",
      });
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
      scoreStatus: updated.scoreStatus,
      recruiterNotes: updated.recruiterNotes,
      appliedAt: updated.appliedAt.toISOString(),
      statusUpdatedAt: updated.statusUpdatedAt.toISOString(),
      shortlistedAt: updated.shortlistedAt?.toISOString() ?? null,
      matchScore: null,
      candidate: null,
      job: null,
      inflightSiblingsCount: 0,
      identityRevealed: true,
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
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }
    const { rows, total } = await this.repo.listShortlistedForCompany(
      companyId,
      query,
    );
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

  async listAllForRecruiter(
    user: AuthUser,
    companyId: string,
    query: {
      page: number;
      limit: number;
      q?: string;
      status?: ApplicationStatus;
      jobId?: string;
      band?: "strong" | "partial" | "limited";
      sort: "recent" | "oldest" | "score-high";
    },
  ): Promise<{
    data: ApplicationDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }
    const { rows, total } = await this.repo.listAllForCompany(companyId, query);
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
    topJobs: Array<{
      jobId: string;
      title: string;
      status: string;
      applicationCount: number;
      avgScore: number;
    }>;
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
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Application not found",
      });
    }

    if (user.role === "candidate" && app.candidateId !== user.id) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Application not found",
      });
    }
    if (user.role === "recruiter") {
      const job = await this.jobsRepo.findById(app.jobId);
      if (!job || job.companyId !== companyId) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Application not found",
        });
      }
    }

    return this.toDto(id);
  }

  // -----------------------------------------------------------------
  // STATUS / NOTES / WITHDRAW
  // -----------------------------------------------------------------

  /**
   * Hire a candidate. Wrapped in a transaction so the application UPDATE,
   * the accepted-offer guard, and the optional cascade auto-reject of
   * sibling applications all commit atomically. Side effects (email,
   * realtime emit, in-app notifications) fire after commit.
   */
  async hire(
    user: AuthUser,
    companyId: string,
    applicationId: string,
    dto: { autoRejectOthers: boolean; note?: string | null },
    requestMeta: RequestMeta = {},
  ): Promise<{
    application: ApplicationDto;
    otherApplicationsRejected: number;
  }> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }

    const result = await this.db.transaction(async (tx) => {
      const app = await this.repo.findByIdForUpdate(
        tx as ApplicationsTx,
        applicationId,
      );
      if (!app) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Application not found",
        });
      }

      const job = await this.jobsRepo.findById(app.jobId);
      if (!job || job.companyId !== companyId) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Application not found",
        });
      }

      if (!canTransition(app.status as ApplicationStatus, "hired")) {
        throw new BadRequestException({
          code: "INVALID_STATUS_TRANSITION",
          message: `Cannot transition from ${app.status} to hired`,
        });
      }

      const latestOffer = await this.offersRepo.findLatestByApplicationId(
        applicationId,
        tx as ApplicationsTx,
      );
      if (!latestOffer || latestOffer.status !== "accepted") {
        throw new BadRequestException({
          code: "OFFER_NOT_ACCEPTED",
          message: "Cannot mark hired — candidate has not accepted an offer.",
        });
      }

      // 1) Hire the chosen candidate
      await this.repo.update(
        applicationId,
        {
          status: "hired",
          statusUpdatedAt: new Date(),
          ...(dto.note
            ? { recruiterNotes: this.appendNote(app.recruiterNotes, dto.note) }
            : {}),
        },
        tx as ApplicationsTx,
      );

      await this.audit.log({
        actorId: user.id,
        actorType: "user",
        action: "application.status_changed",
        entityType: "application",
        entityId: applicationId,
        companyId,
        details: { from: app.status, to: "hired", note: dto.note ?? null },
        ...requestMeta,
      });

      // 2) Cascade — auto-reject other in-flight applicants on the same job
      let cascaded: Array<{ id: string; candidateId: string }> = [];
      if (dto.autoRejectOthers) {
        const others = await this.repo.findInflightByJobId(
          tx as ApplicationsTx,
          app.jobId,
          applicationId,
        );

        for (const other of others) {
          await this.repo.update(
            other.id,
            {
              status: "rejected",
              statusUpdatedAt: new Date(),
              recruiterNotes: this.appendNote(
                other.recruiterNotes,
                "[Auto-rejected: position filled by another candidate]",
              ),
            },
            tx as ApplicationsTx,
          );

          await this.audit.log({
            actorId: user.id,
            actorType: "user",
            action: AUDIT_ACTIONS.APPLICATION_AUTO_REJECTED_POSITION_FILLED,
            entityType: "application",
            entityId: other.id,
            companyId,
            details: {
              hiredApplicationId: applicationId,
              hiredCandidateId: app.candidateId,
              jobId: app.jobId,
            },
            ...requestMeta,
          });
        }

        cascaded = others.map((o) => ({
          id: o.id,
          candidateId: o.candidateId,
        }));
      }

      return { app, job, cascaded };
    });

    // 3) After-commit side effects (best-effort, fire-and-forget)
    void this.cacheService
      .bustTags([
        TAGS.companyDashboard(companyId),
        TAGS.companyApplications(companyId),
        TAGS.companyShortlist(companyId),
        TAGS.applicationsCandidate(result.app.candidateId),
        ...result.cascaded.map((c) =>
          TAGS.applicationsCandidate(c.candidateId),
        ),
      ])
      .catch((err) =>
        this.logger.warn(`hire bustTags failed: ${(err as Error).message}`),
      );

    this.events.emitApplicationStatusChanged({
      applicationId,
      jobId: result.app.jobId,
      recruiterId: result.job.recruiterId,
      candidateId: result.app.candidateId,
      previousStatus: result.app.status as ApplicationStatus,
      status: "hired",
      changedAt: new Date().toISOString(),
    });

    void this.notifyCandidateOfStatusChange(
      applicationId,
      result.app.status,
      "hired",
    ).catch((err) =>
      this.logger.warn(
        `Hire candidate notify failed: ${(err as Error).message}`,
      ),
    );

    // Resolve job + company so the candidate notification can render
    // "your application for <jobTitle> at <companyName>" rather than fallbacks.
    const hiredJobRow = await this.jobsRepo.findByIdWithCompany(
      result.app.jobId,
    );
    void this.notifications
      .emit({
        userId: result.app.candidateId,
        eventType: "application_status_changed",
        scope: "personal",
        entityType: "application",
        entityId: applicationId,
        actorId: user.id,
        metadata: {
          applicationId,
          jobId: result.app.jobId,
          jobTitle: hiredJobRow?.title ?? null,
          companyName: hiredJobRow?.company.name ?? null,
          fromStatus: result.app.status,
          // Templates read `newStatus`; keep `toStatus` for backward
          // compatibility with existing audit/event consumers.
          newStatus: "hired",
          toStatus: "hired",
          occurredAt: new Date().toISOString(),
        },
      })
      .catch((err) =>
        this.logger.warn(`hire notification failed: ${(err as Error).message}`),
      );

    // Cascade notifications + position-filled email per affected sibling
    for (const other of result.cascaded) {
      void this.notifyPositionFilled(
        other.id,
        other.candidateId,
        result.app.jobId,
      ).catch((err) =>
        this.logger.warn(
          `position-filled notify failed for ${other.id}: ${(err as Error).message}`,
        ),
      );

      void this.notifications
        .emit({
          userId: other.candidateId,
          eventType: "application_status_changed",
          scope: "personal",
          entityType: "application",
          entityId: other.id,
          actorId: user.id,
          metadata: {
            applicationId: other.id,
            jobId: result.app.jobId,
            jobTitle: hiredJobRow?.title ?? null,
            companyName: hiredJobRow?.company.name ?? null,
            fromStatus: "(cascade)",
            newStatus: "rejected",
            toStatus: "rejected",
            reason: "position_filled",
            hiredApplicationId: applicationId,
            occurredAt: new Date().toISOString(),
          },
        })
        .catch((err) =>
          this.logger.warn(
            `cascade notify failed for ${other.id}: ${(err as Error).message}`,
          ),
        );
    }

    return {
      application: await this.toDto(applicationId),
      otherApplicationsRejected: result.cascaded.length,
    };
  }

  /**
   * Sends the position-filled email to a bulk-rejected candidate. Helper
   * extracted so the cascade loop stays readable.
   */
  private async notifyPositionFilled(
    applicationId: string,
    candidateId: string,
    jobId: string,
  ): Promise<void> {
    const candidate = await this.profilesRepo.findById(candidateId);
    const jobRow = await this.jobsRepo.findByIdWithCompany(jobId);
    if (!candidate || !jobRow) return;

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";

    await this.email.send({
      to: candidate.email,
      subject: `Update on your application — ${jobRow.title}`,
      template: PositionFilledEmail({
        candidateName: candidate.fullName,
        jobTitle: jobRow.title,
        applicationUrl: `${appUrl}/candidate/applications/${applicationId}`,
        company: { name: jobRow.company.name, logoUrl: jobRow.company.logoUrl },
      }),
    });
  }

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
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Application not found",
      });
    }

    const job = await this.jobsRepo.findById(app.jobId);
    if (!job || job.companyId !== companyId) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Application not found",
      });
    }

    if (!canTransition(app.status as ApplicationStatus, dto.newStatus)) {
      throw new BadRequestException({
        code: "INVALID_STATUS_TRANSITION",
        message: `Cannot transition from ${app.status} to ${dto.newStatus}`,
      });
    }

    if (STATUSES_REQUIRING_ACCEPTED_OFFER.includes(dto.newStatus)) {
      const latestOffer = await this.offersRepo.findLatestByApplicationId(id);
      if (!latestOffer || latestOffer.status !== "accepted") {
        throw new BadRequestException({
          code: "OFFER_NOT_ACCEPTED",
          message: "Cannot mark hired — candidate has not accepted an offer.",
        });
      }
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

    this.events.emitApplicationStatusChanged({
      applicationId: id,
      jobId: app.jobId,
      recruiterId: job.recruiterId,
      candidateId: app.candidateId,
      previousStatus: app.status as ApplicationStatus,
      status: dto.newStatus,
      changedAt: new Date().toISOString(),
    });

    void this.notifyCandidateOfStatusChange(
      id,
      app.status,
      dto.newStatus,
    ).catch((err) => {
      this.logger.warn(`Candidate notify failed: ${(err as Error).message}`);
    });

    const transitionJobRow = await this.jobsRepo.findByIdWithCompany(app.jobId);
    void this.notifications
      .emit({
        userId: app.candidateId,
        eventType: "application_status_changed",
        scope: "personal",
        entityType: "application",
        entityId: id,
        actorId: user.id,
        metadata: {
          applicationId: id,
          jobId: app.jobId,
          jobTitle: transitionJobRow?.title ?? null,
          companyName: transitionJobRow?.company.name ?? null,
          fromStatus: app.status,
          // Templates read `newStatus`; keep `toStatus` for backward
          // compatibility with existing audit/event consumers.
          newStatus: dto.newStatus,
          toStatus: dto.newStatus,
          occurredAt: new Date().toISOString(),
        },
      })
      .catch((err) => {
        this.logger.warn(
          `notifications.emit(application_status_changed) failed: ${(err as Error).message}`,
        );
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
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Application not found",
      });
    }

    const job = await this.jobsRepo.findById(app.jobId);
    if (!job || job.companyId !== companyId) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Application not found",
      });
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
    actor: AuthUser | null,
    id: string,
    newStatus: ApplicationStatus,
    note: string,
    requestMeta: RequestMeta = {},
    tx?: ApplicationsTx,
  ): Promise<ApplicationDto> {
    const app = await this.repo.findById(id);
    if (!app) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Application not found",
      });
    }
    if (app.status === newStatus) {
      return this.toDto(id);
    }

    await this.repo.update(
      id,
      {
        status: newStatus,
        statusUpdatedAt: new Date(),
        recruiterNotes: this.appendNote(app.recruiterNotes, note),
      },
      tx,
    );

    const job = await this.jobsRepo.findById(app.jobId);

    await this.audit.log({
      actorId: actor?.id ?? null,
      actorType: actor ? "user" : "system",
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

      this.events.emitApplicationStatusChanged({
        applicationId: id,
        jobId: app.jobId,
        recruiterId: job.recruiterId,
        candidateId: app.candidateId,
        previousStatus: app.status as ApplicationStatus,
        status: newStatus,
        changedAt: new Date().toISOString(),
      });
    } else {
      await this.cacheService.bustTags([
        TAGS.applicationsCandidate(app.candidateId),
      ]);
    }

    void this.notifyCandidateOfStatusChange(id, app.status, newStatus).catch(
      (err) => {
        this.logger.warn(`Candidate notify failed: ${(err as Error).message}`);
      },
    );

    const systemJobRow = await this.jobsRepo.findByIdWithCompany(app.jobId);
    void this.notifications
      .emit({
        userId: app.candidateId,
        eventType: "application_status_changed",
        scope: "personal",
        entityType: "application",
        entityId: id,
        actorId: actor?.id ?? null,
        metadata: {
          applicationId: id,
          jobId: app.jobId,
          jobTitle: systemJobRow?.title ?? null,
          companyName: systemJobRow?.company.name ?? null,
          fromStatus: app.status,
          // Templates read `newStatus`; keep `toStatus` for backward
          // compatibility with existing audit/event consumers.
          newStatus,
          toStatus: newStatus,
          occurredAt: new Date().toISOString(),
          system: true,
        },
      })
      .catch((err) => {
        this.logger.warn(
          `notifications.emit(application_status_changed,system) failed: ${(err as Error).message}`,
        );
      });

    return this.toDto(id);
  }

  async withdraw(
    user: AuthUser,
    applicationId: string,
    dto: WithdrawApplicationInput,
    requestMeta: RequestMeta = {},
  ): Promise<ApplicationDto> {
    const app = await this.repo.findById(applicationId);
    if (!app) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Application not found",
      });
    }

    // Only the candidate or an admin may withdraw.
    if (user.role !== "admin" && user.id !== app.candidateId) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Only the candidate can withdraw",
      });
    }
    if (!canTransition(app.status as ApplicationStatus, "withdrawn")) {
      throw new BadRequestException({
        code: "INVALID_STATUS_TRANSITION",
        message: `Cannot withdraw from ${app.status}`,
      });
    }

    await this.repo.update(applicationId, {
      status: "withdrawn",
      statusUpdatedAt: new Date(),
    });

    const withdrawnJob = await this.jobsRepo.findById(app.jobId);

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.APPLICATION_WITHDRAWN_BY_CANDIDATE,
      entityType: "application",
      entityId: applicationId,
      companyId: withdrawnJob?.companyId ?? null,
      details: { from: app.status, reason: dto.reason ?? null },
      ...requestMeta,
    });

    await this.cacheService.bustTags([
      TAGS.applicationsCandidate(app.candidateId),
      ...(withdrawnJob
        ? [
            TAGS.companyDashboard(withdrawnJob.companyId),
            TAGS.companyApplications(withdrawnJob.companyId),
          ]
        : []),
    ]);

    this.events.emitApplicationWithdrawn({
      applicationId,
      candidateId: app.candidateId,
      recruiterId: withdrawnJob?.recruiterId ?? null,
      jobId: app.jobId,
      reason: dto.reason ?? null,
    });

    return this.toDto(applicationId);
  }

  // -----------------------------------------------------------------
  // RESUME DOWNLOAD (recruiter-aware)
  // -----------------------------------------------------------------

  async getResumeDownload(
    user: AuthUser,
    companyId: string | null,
    applicationId: string,
    requestMeta: RequestMeta = {},
  ): Promise<{ signedUrl: string; expiresAt: string }> {
    const app = await this.repo.findById(applicationId);
    if (!app) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Application not found",
      });
    }

    if (user.role === "candidate" && app.candidateId !== user.id) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Application not found",
      });
    }
    let completedInterviewId: string | null = null;
    if (user.role === "recruiter") {
      const job = await this.jobsRepo.findById(app.jobId);
      if (!job || job.companyId !== companyId) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Application not found",
        });
      }
      // Per thesis panel revision (May 2026): recruiters can only download
      // the resume once an interview on this application is completed.
      // The check uses the same reveal predicate as the PII redaction so
      // the two unlock at the same trigger.
      const interviewRows = await this.db
        .select({
          id: interviewsTable.id,
          status: interviewsTable.status,
        })
        .from(interviewsTable)
        .where(eq(interviewsTable.applicationId, applicationId));
      const identityRevealed = isIdentityRevealedForRecruiter(
        app.status,
        interviewRows.map((r) => r.status),
      );
      if (!identityRevealed) {
        throw new ForbiddenException({
          code: "RESUME_DOWNLOAD_REQUIRES_COMPLETED_INTERVIEW",
          message:
            "The resume becomes downloadable once an interview is completed.",
        });
      }
      completedInterviewId =
        interviewRows.find((r) => r.status === "completed")?.id ?? null;
    }

    const resume = await this.resumesRepo.findById(app.resumeId);
    if (!resume) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Resume not found",
      });
    }

    const expiresIn = 60 * 60;
    const signedUrl = await this.storage.signedUrl({
      bucket: RESUMES_BUCKET,
      path: resume.storagePath,
      expiresIn,
    });

    // Audit every recruiter download — the candidate's own download is
    // not auditable as a security event (they own the file).
    if (user.role === "recruiter") {
      const job = await this.jobsRepo.findById(app.jobId);
      await this.audit.log({
        actorId: user.id,
        actorType: "user",
        action: AUDIT_ACTIONS.RESUME_DOWNLOADED,
        entityType: "application",
        entityId: applicationId,
        companyId: job?.companyId ?? null,
        details: {
          resumeId: resume.id,
          interviewId: completedInterviewId,
        },
        ipAddress: requestMeta.ipAddress ?? null,
        userAgent: requestMeta.userAgent ?? null,
      });
    }

    return {
      signedUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  // -----------------------------------------------------------------
  // SYSTEM TRANSITION (auto-reject driven by scoring)
  // -----------------------------------------------------------------

  /**
   * Lightweight status lookup used by the auto-reject helper. Avoids
   * loading the full row + relations when we only need to verify the
   * current status before transitioning.
   */
  async findStatus(applicationId: string): Promise<{
    candidateId: string;
    jobId: string;
    status: ApplicationStatus;
  } | null> {
    const app = await this.repo.findById(applicationId);
    if (!app) return null;
    return {
      candidateId: app.candidateId,
      jobId: app.jobId,
      status: app.status as ApplicationStatus,
    };
  }

  /**
   * Score-based auto-rejection. Called by the score-based auto-rejection
   * helper (`auto-reject-on-score.helper.ts`) from both the SYNC apply
   * path and the ASYNC match-score worker. Distinct from the generic
   * `transitionFromSystem` (which is the offer-driven cascade) because
   * the audit action and the rejection reason are different.
   *
   * Idempotent: if the application has moved past `applied`, returns
   * without changes.
   */
  async autoRejectByLowScore(
    applicationId: string,
    toStatus: "rejected",
    args: {
      reason: "auto_rejected_low_score";
      details: { overallScore: number; threshold: number };
    },
  ): Promise<void> {
    const app = await this.repo.findById(applicationId);
    if (!app) return;
    if (app.status !== "applied") return; // idempotent
    if (!canTransition(app.status as ApplicationStatus, toStatus)) return;

    const job = await this.jobsRepo.findById(app.jobId);

    await this.repo.update(applicationId, {
      status: toStatus,
      statusUpdatedAt: new Date(),
    });

    await this.audit.log({
      actorId: null,
      actorType: "system",
      action: AUDIT_ACTIONS.APPLICATION_AUTO_REJECTED_LOW_SCORE,
      entityType: "application",
      entityId: applicationId,
      companyId: job?.companyId ?? null,
      details: {
        fromStatus: "applied",
        toStatus: "rejected",
        reason: args.reason,
        overallScore: args.details.overallScore,
        threshold: args.details.threshold,
      },
    });

    // Reuse the realtime + notification path: emit
    // application.status_changed so the candidate's UI updates
    // immediately and the rejection email lands via the same
    // notification template path used for manual rejections.
    this.events.emitApplicationStatusChanged({
      applicationId,
      jobId: app.jobId,
      recruiterId: job?.recruiterId ?? "",
      candidateId: app.candidateId,
      previousStatus: "applied",
      status: "rejected",
      changedAt: new Date().toISOString(),
    });

    const jobWithCompany = await this.jobsRepo.findByIdWithCompany(app.jobId);
    void this.notifications
      .emit({
        userId: app.candidateId,
        eventType: "application_status_changed",
        scope: "personal",
        entityType: "application",
        entityId: applicationId,
        metadata: {
          applicationId,
          jobId: app.jobId,
          jobTitle: jobWithCompany?.title ?? null,
          companyName: jobWithCompany?.company.name ?? null,
          fromStatus: "applied",
          newStatus: "rejected",
          reason: "auto_rejected_low_score",
          occurredAt: new Date().toISOString(),
        },
      })
      .catch((err) => {
        this.logger.warn(
          `notifications.emit(application_status_changed auto-reject) failed: ${(err as Error).message}`,
        );
      });

    // Bust the obvious caches so the next pipeline read for the
    // recruiter and the candidate reflects the new status.
    await this.cacheService.bustTags([
      TAGS.applicationsCandidate(app.candidateId),
      ...(job?.companyId
        ? [
            TAGS.companyDashboard(job.companyId),
            TAGS.companyApplications(job.companyId),
            TAGS.companyShortlist(job.companyId),
          ]
        : []),
    ]);
  }

  /**
   * Recruiter-aware wrapper around `toDto`. Loads the application,
   * checks the identity-reveal predicate, and applies the redaction
   * policy. Candidate / admin views are returned as-is from `toDto`.
   */
  async toDtoForViewer(
    user: AuthUser,
    applicationId: string,
  ): Promise<ApplicationDto> {
    const full = await this.toDto(applicationId);
    if (user.role !== "recruiter") return full;

    const interviewRows = await this.db
      .select({ status: interviewsTable.status })
      .from(interviewsTable)
      .where(eq(interviewsTable.applicationId, applicationId));
    const identityRevealed = isIdentityRevealedForRecruiter(
      full.status as ApplicationStatus,
      interviewRows.map((r) => r.status),
    );
    return redactApplicationForRecruiter(full, { identityRevealed });
  }

  /**
   * Batch variant: load reveal state for a list of applications in a
   * single round-trip and then apply the redaction policy per row. Used
   * by recruiter-list endpoints to avoid an N+1 query.
   */
  async toDtosForRecruiterBatch(
    apps: ReadonlyArray<ApplicationDto>,
  ): Promise<ApplicationDto[]> {
    if (apps.length === 0) return [];
    const ids = apps.map((a) => a.id);

    // Single round-trip lookup using Postgres = ANY(...) via Drizzle's
    // `inArray`. Recruiter list pages are paginated; the worst case is
    // limit-sized (typically ≤ 50). All retrieved interview status rows
    // are bucketed by applicationId so the predicate sees the full set
    // for each row.
    const rows = await this.db
      .select({
        applicationId: interviewsTable.applicationId,
        status: interviewsTable.status,
      })
      .from(interviewsTable)
      .where(inArray(interviewsTable.applicationId, ids));

    const interviewsByApp = new Map<string, string[]>();
    for (const r of rows) {
      const arr = interviewsByApp.get(r.applicationId) ?? [];
      arr.push(r.status);
      interviewsByApp.set(r.applicationId, arr);
    }

    return apps.map((a) =>
      redactApplicationForRecruiter(a, {
        identityRevealed: isIdentityRevealedForRecruiter(
          a.status as ApplicationStatus,
          interviewsByApp.get(a.id) ?? [],
        ),
      }),
    );
  }

  /**
   * Read the current auto-reject threshold from the active scoring
   * config (admin-tunable). Falls back to the boot-time constant when
   * no config row exists yet — typical only in fresh dev environments.
   *
   * Direct Drizzle lookup (no service indirection) to avoid the
   * AdminModule ↔ ApplicationsModule cyclic module-load problem.
   */
  async getAutoRejectThreshold(): Promise<number> {
    try {
      const rows = await this.db
        .select({
          autoRejectThreshold: scoringConfigTable.autoRejectThreshold,
        })
        .from(scoringConfigTable)
        .where(eq(scoringConfigTable.isActive, true))
        .limit(1);
      const value = rows[0]?.autoRejectThreshold;
      if (typeof value === "number" && value >= 0 && value <= 100) {
        return value;
      }
    } catch (err) {
      this.logger.warn(
        `getAutoRejectThreshold: failed to read active config — using fallback. ${(err as Error).message}`,
      );
    }
    return AUTO_REJECT_THRESHOLD;
  }

  // -----------------------------------------------------------------
  // PRIVATE
  // -----------------------------------------------------------------

  private async toDto(applicationId: string): Promise<ApplicationDto> {
    const app = await this.repo.findById(applicationId);
    if (!app) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Application not found",
      });
    }

    const matchScore =
      await this.scoringService.getMatchScoreByApplicationId(applicationId);

    const candidateProfile = await this.profilesRepo.findById(app.candidateId);
    const candidateProfileExt = await this.profilesRepo.findCandidateProfile(
      app.candidateId,
    );

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

    const inflightSiblingsCount = await this.repo.countInflightOnJob(
      app.jobId,
      app.id,
    );

    return {
      id: app.id,
      jobId: app.jobId,
      candidateId: app.candidateId,
      resumeId: app.resumeId,
      coverLetter: app.coverLetter,
      status: app.status,
      scoreStatus: app.scoreStatus,
      recruiterNotes: app.recruiterNotes,
      appliedAt: app.appliedAt.toISOString(),
      statusUpdatedAt: app.statusUpdatedAt.toISOString(),
      shortlistedAt: app.shortlistedAt?.toISOString() ?? null,
      matchScore,
      candidate,
      job,
      inflightSiblingsCount,
      // `toDto` is the canonical full-PII shape. Recruiter-facing endpoints
      // wrap this with `toDtoForViewer` which applies the redaction policy.
      identityRevealed: true,
    };
  }

  private toDashboardDto(row: {
    id: string;
    jobId: string;
    candidateId: string;
    resumeId: string;
    coverLetter: string | null;
    status: ApplicationStatus;
    scoreStatus: "computing" | "completed" | "failed";
    recruiterNotes: string | null;
    appliedAt: Date;
    statusUpdatedAt: Date;
    shortlistedAt: Date | null;
    matchScore: {
      id: string;
      overallScore: number;
      band: "strong" | "partial" | "limited";
    } | null;
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
      scoreStatus: row.scoreStatus,
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
      inflightSiblingsCount: 0,
      // Dashboard rows are the lightweight summary shape; full PII reveal
      // is decided at the row mapper. Controller wraps the list with
      // `toDtoForViewer` for recruiter views.
      identityRevealed: true,
    };
  }

  private appendNote(existing: string | null, note: string): string {
    const stamp = new Date().toISOString();
    const prefix = `[${stamp}] `;
    return existing ? `${existing}\n\n${prefix}${note}` : `${prefix}${note}`;
  }

  private async notifyRecruiterOfApplication(
    applicationId: string,
  ): Promise<void> {
    const app = await this.repo.findById(applicationId);
    if (!app) return;

    const jobRow = await this.jobsRepo.findByIdWithCompany(app.jobId);
    if (!jobRow) return;

    const recruiter = await this.profilesRepo.findById(jobRow.recruiterId);
    if (!recruiter) return;

    const candidate = await this.profilesRepo.findById(app.candidateId);
    if (!candidate) return;

    const matchScore =
      await this.scoringService.getMatchScoreByApplicationId(applicationId);

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";

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

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";

    const subject = (() => {
      switch (toStatus.toLowerCase()) {
        case "hired":
          return `Congratulations, you're hired! ${jobRow.title}`;
        case "offer":
          return `You received an offer for ${jobRow.title}`;
        case "interview":
          return `Good news about your ${jobRow.title} application`;
        case "rejected":
          return `Update on your ${jobRow.title} application`;
        case "withdrawn":
          return `Application withdrawn: ${jobRow.title}`;
        case "applied":
          return `We received your application for ${jobRow.title}`;
        default:
          return `Update on your application for ${jobRow.title}`;
      }
    })();

    await this.email.send({
      to: candidate.email,
      subject,
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
