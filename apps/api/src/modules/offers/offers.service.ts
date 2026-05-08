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
  CreateOfferInput,
  DeclineOfferInput,
} from "@aurahire/shared";

import { AuditService } from "../../audit";
import { AUDIT_ACTIONS } from "../../audit/audit.types";
import { EmailService } from "../../email/email.service";
import { EventsService } from "../../realtime";
import { ApplicationsRepository } from "../applications/applications.repository";
import { ApplicationsService } from "../applications/applications.service";
import { JobsRepository } from "../jobs/jobs.repository";
import { ProfilesRepository } from "../profiles/profiles.repository";
import { OffersRepository } from "./offers.repository";
import type { OfferDto } from "./dto/offer-response.dto";
import { OfferSentEmail } from "../../email/templates/offer-sent";
import { OfferDecisionEmail } from "../../email/templates/offer-decision";

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    private readonly repo: OffersRepository,
    private readonly applicationsRepo: ApplicationsRepository,
    private readonly applicationsService: ApplicationsService,
    private readonly jobsRepo: JobsRepository,
    private readonly profilesRepo: ProfilesRepository,
    private readonly email: EmailService,
    private readonly audit: AuditService,
    private readonly events: EventsService,
  ) {}

  async create(
    user: AuthUser,
    companyId: string,
    applicationId: string,
    dto: CreateOfferInput,
    requestMeta: RequestMeta = {},
  ): Promise<OfferDto> {
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

    const pending = await this.repo.findPendingByApplicationId(applicationId);
    if (pending) {
      throw new ConflictException({
        code: "OFFER_ALREADY_PENDING",
        message: "An offer is already pending for this application; withdraw it first",
        currentOfferId: pending.id,
      });
    }

    const offer = await this.repo.insert({
      applicationId,
      sentBy: user.id,
      title: dto.title,
      salary: String(dto.salary),
      salaryCurrency: dto.salaryCurrency,
      startDate: dto.startDate,
      managerName: dto.managerName ?? null,
      benefitsSummary: dto.benefitsSummary ?? null,
      customMessage: dto.customMessage ?? null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      status: "pending",
    });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.OFFER_SENT,
      entityType: "offer",
      entityId: offer.id,
      companyId,
      details: {
        applicationId,
        title: offer.title,
        salary: dto.salary,
        salaryCurrency: dto.salaryCurrency,
      },
      ...requestMeta,
    });

    this.events.emitOfferSent({
      offerId: offer.id,
      applicationId: offer.applicationId,
      recruiterId: user.id,
      candidateId: application.candidateId,
      sentAt: offer.sentAt.toISOString(),
    });

    // Auto-advance application status to 'offer' so the candidate's view + the
    // state machine reflect that an offer has been extended. Skips if already
    // at 'offer' (no-op inside transitionFromSystem).
    try {
      await this.applicationsService.transitionFromSystem(
        user,
        applicationId,
        "offer",
        `Offer sent: ${offer.title}`,
        requestMeta,
      );
    } catch (err) {
      this.logger.warn(`App auto-advance to offer failed: ${(err as Error).message}`);
    }

    void this.notifyCandidateOfferSent(offer.id).catch((err) => {
      this.logger.warn(`Notify candidate failed: ${(err as Error).message}`);
    });

    return this.toDto(offer);
  }

  async accept(
    user: AuthUser,
    offerId: string,
    requestMeta: RequestMeta = {},
  ): Promise<OfferDto> {
    if (user.role !== "candidate") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Candidate role required" });
    }

    const offer = await this.repo.findById(offerId);
    if (!offer) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Offer not found" });
    }
    const application = await this.applicationsRepo.findById(offer.applicationId);
    if (!application || application.candidateId !== user.id) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Offer not found" });
    }
    if (offer.status !== "pending") {
      throw new BadRequestException({
        code: "OFFER_NOT_PENDING",
        message: `Cannot accept offer in status '${offer.status}'`,
      });
    }

    const updated = await this.repo.update(offerId, {
      status: "accepted",
      respondedAt: new Date(),
    });

    // Tag the audit row with the company that owns the underlying job
    // so per-tenant audit queries see the candidate decision.
    const job = await this.jobsRepo.findById(application.jobId);
    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.OFFER_ACCEPTED,
      entityType: "offer",
      entityId: offerId,
      companyId: job?.companyId ?? null,
      details: { applicationId: offer.applicationId },
      ...requestMeta,
    });

    try {
      await this.applicationsService.transitionFromSystem(
        user,
        offer.applicationId,
        "hired",
        "Offer accepted",
        requestMeta,
      );
    } catch (err) {
      this.logger.warn(`App auto-advance to hired failed: ${(err as Error).message}`);
    }

    void this.notifyRecruiterDecision(offerId, "accepted").catch((err) => {
      this.logger.warn(`Notify recruiter failed: ${(err as Error).message}`);
    });

    return this.toDto(updated);
  }

  async decline(
    user: AuthUser,
    offerId: string,
    dto: DeclineOfferInput,
    requestMeta: RequestMeta = {},
  ): Promise<OfferDto> {
    if (user.role !== "candidate") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Candidate role required" });
    }

    const offer = await this.repo.findById(offerId);
    if (!offer) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Offer not found" });
    }
    const application = await this.applicationsRepo.findById(offer.applicationId);
    if (!application || application.candidateId !== user.id) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Offer not found" });
    }
    if (offer.status !== "pending") {
      throw new BadRequestException({
        code: "OFFER_NOT_PENDING",
        message: `Cannot decline offer in status '${offer.status}'`,
      });
    }

    const updated = await this.repo.update(offerId, {
      status: "declined",
      respondedAt: new Date(),
      ...(dto.reason
        ? {
            customMessage: `${offer.customMessage ?? ""}\n\n[Candidate declined: ${dto.reason}]`.trim(),
          }
        : {}),
    });

    const declinedJob = await this.jobsRepo.findById(application.jobId);
    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.OFFER_DECLINED,
      entityType: "offer",
      entityId: offerId,
      companyId: declinedJob?.companyId ?? null,
      details: { applicationId: offer.applicationId, reasonLength: dto.reason?.length ?? 0 },
      ...requestMeta,
    });

    void this.notifyRecruiterDecision(offerId, "declined").catch((err) => {
      this.logger.warn(`Notify recruiter failed: ${(err as Error).message}`);
    });

    return this.toDto(updated);
  }

  async withdraw(
    user: AuthUser,
    companyId: string,
    offerId: string,
    requestMeta: RequestMeta = {},
  ): Promise<OfferDto> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Recruiter role required" });
    }

    const offer = await this.repo.findById(offerId);
    if (!offer) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Offer not found" });
    }
    const application = await this.applicationsRepo.findApplicationContextForCompany(
      offer.applicationId,
      companyId,
    );
    if (!application) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Offer not found" });
    }
    if (offer.status !== "pending") {
      throw new BadRequestException({
        code: "OFFER_NOT_PENDING",
        message: `Cannot withdraw offer in status '${offer.status}'`,
      });
    }

    const updated = await this.repo.update(offerId, { status: "withdrawn" });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.OFFER_WITHDRAWN,
      entityType: "offer",
      entityId: offerId,
      companyId,
      details: { applicationId: offer.applicationId },
      ...requestMeta,
    });

    return this.toDto(updated);
  }

  async listMine(user: AuthUser): Promise<OfferDto[]> {
    if (user.role !== "candidate") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Candidate role required" });
    }
    const rows = await this.repo.findByCandidateId(user.id);
    return rows.map((r) => this.toDto(r));
  }

  async listForApplication(
    user: AuthUser,
    companyId: string | null,
    applicationId: string,
  ): Promise<OfferDto[]> {
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

  // -----------------------------------------------------------------
  // PRIVATE
  // -----------------------------------------------------------------

  private async notifyCandidateOfferSent(offerId: string): Promise<void> {
    const offer = await this.repo.findById(offerId);
    if (!offer) return;
    const app = await this.applicationsRepo.findById(offer.applicationId);
    if (!app) return;
    const candidate = await this.profilesRepo.findById(app.candidateId);
    const jobRow = await this.jobsRepo.findByIdWithCompany(app.jobId);
    if (!candidate || !jobRow) return;

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    await this.email.send({
      to: candidate.email,
      subject: `Offer extended for ${offer.title}`,
      template: OfferSentEmail({
        candidateName: candidate.fullName,
        jobTitle: offer.title,
        companyName: jobRow.company.name,
        salary: Number(offer.salary),
        salaryCurrency: offer.salaryCurrency,
        startDate:
          typeof offer.startDate === "string"
            ? offer.startDate
            : new Date(offer.startDate).toISOString().slice(0, 10),
        expiresAt: offer.expiresAt ? offer.expiresAt.toISOString() : null,
        applicationUrl: `${appUrl}/candidate/applications/${app.id}`,
        company: { name: jobRow.company.name, logoUrl: jobRow.company.logoUrl },
      }),
    });
  }

  private async notifyRecruiterDecision(
    offerId: string,
    decision: "accepted" | "declined",
  ): Promise<void> {
    const offer = await this.repo.findById(offerId);
    if (!offer) return;
    const app = await this.applicationsRepo.findById(offer.applicationId);
    if (!app) return;
    const candidate = await this.profilesRepo.findById(app.candidateId);
    const recruiter = await this.profilesRepo.findById(offer.sentBy);
    const jobRow = await this.jobsRepo.findByIdWithCompany(app.jobId);
    if (!candidate || !recruiter || !jobRow) return;

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    await this.email.send({
      to: recruiter.email,
      subject: `Offer ${decision}: ${candidate.fullName} for ${offer.title}`,
      template: OfferDecisionEmail({
        recruiterName: recruiter.fullName,
        candidateName: candidate.fullName,
        jobTitle: offer.title,
        decision,
        applicationUrl: `${appUrl}/recruiter/applications/${app.id}`,
        company: { name: jobRow.company.name, logoUrl: jobRow.company.logoUrl },
      }),
    });
  }

  private toDto(o: {
    id: string;
    applicationId: string;
    sentBy: string;
    title: string;
    salary: string | number;
    salaryCurrency: string;
    startDate: Date | string;
    managerName: string | null;
    benefitsSummary: string | null;
    customMessage: string | null;
    status: string;
    sentAt: Date;
    respondedAt: Date | null;
    expiresAt: Date | null;
  }): OfferDto {
    return {
      id: o.id,
      applicationId: o.applicationId,
      sentBy: o.sentBy,
      title: o.title,
      salary: Number(o.salary),
      salaryCurrency: o.salaryCurrency,
      startDate:
        typeof o.startDate === "string"
          ? o.startDate
          : new Date(o.startDate).toISOString().slice(0, 10),
      managerName: o.managerName,
      benefitsSummary: o.benefitsSummary,
      customMessage: o.customMessage,
      status: o.status,
      sentAt: o.sentAt.toISOString(),
      respondedAt: o.respondedAt ? o.respondedAt.toISOString() : null,
      expiresAt: o.expiresAt ? o.expiresAt.toISOString() : null,
    };
  }
}
