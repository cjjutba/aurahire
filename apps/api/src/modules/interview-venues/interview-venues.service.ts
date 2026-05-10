import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type {
  AuthUser,
  InterviewVenueInput,
  InterviewVenuePartialInput,
} from "@aurahire/shared";

import { AuditService, AUDIT_ACTIONS } from "../../audit";
import { CacheService } from "../../cache";
import { sanitizeMapUrl } from "../interviews/lib/sanitize-map-url";
import { InterviewVenuesRepository } from "./interview-venues.repository";

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class InterviewVenuesService {
  private readonly logger = new Logger(InterviewVenuesService.name);

  constructor(
    private readonly repo: InterviewVenuesRepository,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
  ) {}

  private requireRecruiterOrAdmin(user: AuthUser): void {
    if (user.role !== "recruiter" && user.role !== "admin") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }
  }

  async list(user: AuthUser, companyId: string) {
    this.requireRecruiterOrAdmin(user);
    return this.toDtos(await this.repo.list(companyId));
  }

  async create(
    user: AuthUser,
    companyId: string,
    dto: InterviewVenueInput,
    requestMeta: RequestMeta = {},
  ) {
    this.requireRecruiterOrAdmin(user);

    if (dto.isDefault) {
      await this.repo.clearDefaultForCompany(companyId);
    }

    const row = await this.repo.insert({
      companyId,
      createdBy: user.id,
      label: dto.label,
      venueName: dto.venueName,
      addressLine: dto.addressLine,
      roomOrFloor: dto.roomOrFloor ?? null,
      mapUrl: dto.mapUrl ? sanitizeMapUrl(dto.mapUrl) : null,
      reportingInstructions: dto.reportingInstructions ?? null,
      whatToBring: dto.whatToBring ?? null,
      interviewerName: dto.interviewerName ?? null,
      interviewerTitle: dto.interviewerTitle ?? null,
      isDefault: dto.isDefault ?? false,
    });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.INTERVIEW_VENUE_CREATED,
      entityType: "interview_venue",
      entityId: row.id,
      companyId,
      details: { label: row.label, isDefault: row.isDefault },
      ...requestMeta,
    });

    this.logger.log(`Venue created: ${row.id} for company ${companyId}`);
    return this.toDto(row);
  }

  async update(
    user: AuthUser,
    venueId: string,
    dto: InterviewVenuePartialInput,
    requestMeta: RequestMeta = {},
  ) {
    this.requireRecruiterOrAdmin(user);

    const existing = await this.repo.findById(venueId);
    if (!existing) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Venue not found",
      });
    }
    const companyId = existing.companyId;

    // Build the patch, sanitizing mapUrl if provided.
    const patch: Partial<typeof existing> = { ...dto };
    if (dto.mapUrl !== undefined) {
      patch.mapUrl = dto.mapUrl ? sanitizeMapUrl(dto.mapUrl) : null;
    }
    if (dto.isDefault) {
      await this.repo.clearDefaultForCompany(companyId, venueId);
    }

    const updated = await this.repo.update(venueId, patch);

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.INTERVIEW_VENUE_UPDATED,
      entityType: "interview_venue",
      entityId: venueId,
      companyId,
      details: { fields: Object.keys(dto) },
      ...requestMeta,
    });

    return this.toDto(updated);
  }

  async remove(
    user: AuthUser,
    venueId: string,
    requestMeta: RequestMeta = {},
  ): Promise<void> {
    this.requireRecruiterOrAdmin(user);

    const existing = await this.repo.findById(venueId);
    if (!existing) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Venue not found",
      });
    }

    await this.repo.delete(venueId);

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.INTERVIEW_VENUE_DELETED,
      entityType: "interview_venue",
      entityId: venueId,
      companyId: existing.companyId,
      details: { label: existing.label },
      ...requestMeta,
    });

    this.logger.log(`Venue deleted: ${venueId}`);
  }

  async setDefault(
    user: AuthUser,
    venueId: string,
    requestMeta: RequestMeta = {},
  ) {
    this.requireRecruiterOrAdmin(user);

    const existing = await this.repo.findById(venueId);
    if (!existing) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Venue not found",
      });
    }

    // Clear all other defaults for this company, keeping this venue exempt.
    await this.repo.clearDefaultForCompany(existing.companyId, venueId);
    const updated = await this.repo.update(venueId, { isDefault: true });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.INTERVIEW_VENUE_UPDATED,
      entityType: "interview_venue",
      entityId: venueId,
      companyId: existing.companyId,
      details: { setDefault: true },
      ...requestMeta,
    });

    return this.toDto(updated);
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  private toDto(row: {
    id: string;
    companyId: string;
    createdBy: string;
    label: string;
    venueName: string;
    addressLine: string;
    roomOrFloor: string | null;
    mapUrl: string | null;
    reportingInstructions: string | null;
    whatToBring: string | null;
    interviewerName: string | null;
    interviewerTitle: string | null;
    isDefault: boolean;
    createdAt: Date | string;
    updatedAt: Date | string;
  }) {
    return {
      id: row.id,
      companyId: row.companyId,
      createdBy: row.createdBy,
      label: row.label,
      venueName: row.venueName,
      addressLine: row.addressLine,
      roomOrFloor: row.roomOrFloor ?? null,
      mapUrl: row.mapUrl ?? null,
      reportingInstructions: row.reportingInstructions ?? null,
      whatToBring: row.whatToBring ?? null,
      interviewerName: row.interviewerName ?? null,
      interviewerTitle: row.interviewerTitle ?? null,
      isDefault: row.isDefault,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : row.createdAt,
      updatedAt:
        row.updatedAt instanceof Date
          ? row.updatedAt.toISOString()
          : row.updatedAt,
    };
  }

  private toDtos(rows: Parameters<typeof this.toDto>[0][]) {
    return rows.map((r) => this.toDto(r));
  }
}
