import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type {
  AuthUser,
  CreateFeedbackInput,
  ListFeedbackQuery,
  UpdateFeedbackInput,
  FeedbackStatus,
} from "@aurahire/shared";
import type { NewFeedback } from "@aurahire/db";

import { AuditService, AUDIT_ACTIONS } from "../../audit";
import { ProfilesRepository } from "../profiles/profiles.repository";
import {
  FeedbackRepository,
  type FeedbackJoinedRow,
} from "./feedback.repository";
import type {
  FeedbackDto,
  FeedbackEnvelopeDto,
  FeedbackListEnvelopeDto,
} from "./dto/feedback-response.dto";

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    private readonly repo: FeedbackRepository,
    private readonly profilesRepo: ProfilesRepository,
    private readonly audit: AuditService,
  ) {}

  // ─── Submit ────────────────────────────────────────────────────────────

  async submit(
    user: AuthUser,
    activeCompanyId: string | null,
    dto: CreateFeedbackInput,
    requestMeta: RequestMeta = {},
  ): Promise<FeedbackEnvelopeDto> {
    // Snapshot the submitter's identity at write time so the row stays
    // readable after the user is deleted (FK is ON DELETE SET NULL).
    const profile = await this.profilesRepo.findById(user.id);
    if (!profile) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Profile not found",
      });
    }

    const insertValues: NewFeedback = {
      submitterId: user.id,
      submitterEmail: profile.email,
      submitterName: profile.fullName,
      submitterRole: user.role,
      companyId: activeCompanyId,
      type: dto.type,
      severity: dto.type === "bug" ? (dto.severity ?? "normal") : null,
      subject: dto.subject,
      message: dto.message,
      pageUrl: dto.pageUrl ?? null,
      // Prefer the client-supplied user agent (captures the in-page
      // navigator.userAgent); fall back to the request header if absent.
      userAgent: dto.userAgent ?? requestMeta.userAgent ?? null,
      appVersion: dto.appVersion ?? null,
      status: "new",
    };

    const row = await this.repo.insert(insertValues);

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.FEEDBACK_SUBMITTED,
      entityType: "feedback",
      entityId: row.id,
      companyId: activeCompanyId,
      details: {
        type: row.type,
        severity: row.severity,
        subject: row.subject,
        pageUrl: row.pageUrl,
      },
      ...requestMeta,
    });

    return { data: await this.toDto(row.id) };
  }

  // ─── Admin: list ───────────────────────────────────────────────────────

  async listForAdmin(
    query: ListFeedbackQuery,
  ): Promise<FeedbackListEnvelopeDto> {
    const { rows, total } = await this.repo.list({
      status: query.status,
      type: query.type,
      severity: query.severity,
      q: query.q,
      page: query.page,
      limit: query.limit,
    });

    return {
      data: rows.map((r) => this.toListDto(r)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async statusCounts(): Promise<Record<FeedbackStatus, number>> {
    return this.repo.statusCounts();
  }

  // ─── Admin: detail + update ────────────────────────────────────────────

  async getByIdForAdmin(id: string): Promise<FeedbackEnvelopeDto> {
    return { data: await this.toDto(id) };
  }

  async updateForAdmin(
    user: AuthUser,
    id: string,
    dto: UpdateFeedbackInput,
    requestMeta: RequestMeta = {},
  ): Promise<FeedbackEnvelopeDto> {
    if (user.role !== "admin") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Admin role required",
      });
    }

    const existing = await this.repo.findByIdWithJoins(id);
    if (!existing) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Feedback not found",
      });
    }

    const patch: Partial<NewFeedback> = {};
    let statusChanged = false;
    let noteChanged = false;
    const previousStatus = existing.feedback.status as FeedbackStatus;

    if (dto.status !== undefined && dto.status !== previousStatus) {
      patch.status = dto.status;
      statusChanged = true;
      if (dto.status === "resolved" || dto.status === "dismissed") {
        patch.resolvedAt = new Date();
        patch.resolvedBy = user.id;
      } else {
        // Reverting to new/reviewing clears the resolution stamp so the
        // audit trail reflects the actual close time of the eventual
        // resolution rather than a stale earlier one.
        patch.resolvedAt = null;
        patch.resolvedBy = null;
      }
    }

    if (
      dto.adminNote !== undefined &&
      (dto.adminNote ?? null) !== (existing.feedback.adminNote ?? null)
    ) {
      patch.adminNote = dto.adminNote ?? null;
      noteChanged = true;
    }

    if (Object.keys(patch).length === 0) {
      // No-op update - return the existing row without an audit entry to
      // keep the trail focused on actual state transitions.
      return { data: await this.toDto(id) };
    }

    const updated = await this.repo.update(id, patch);
    if (!updated) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Feedback not found",
      });
    }

    if (statusChanged) {
      await this.audit.log({
        actorId: user.id,
        actorType: "user",
        action: AUDIT_ACTIONS.FEEDBACK_STATUS_CHANGED,
        entityType: "feedback",
        entityId: id,
        companyId: existing.feedback.companyId,
        details: { from: previousStatus, to: patch.status },
        ...requestMeta,
      });
    }
    if (noteChanged) {
      await this.audit.log({
        actorId: user.id,
        actorType: "user",
        action: AUDIT_ACTIONS.FEEDBACK_NOTE_UPDATED,
        entityType: "feedback",
        entityId: id,
        companyId: existing.feedback.companyId,
        details: {
          before: existing.feedback.adminNote ?? null,
          after: patch.adminNote ?? null,
        },
        ...requestMeta,
      });
    }

    return { data: await this.toDto(id) };
  }

  // ─── Mappers ───────────────────────────────────────────────────────────

  private async toDto(id: string): Promise<FeedbackDto> {
    const row = await this.repo.findByIdWithJoins(id);
    if (!row) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Feedback not found",
      });
    }
    return this.toListDto(row);
  }

  private toListDto(r: FeedbackJoinedRow): FeedbackDto {
    return {
      id: r.feedback.id,
      submitter: {
        // Prefer the live profile join when available; fall back to the
        // snapshot columns if the user has been deleted.
        id: r.submitter?.id ?? null,
        fullName: r.submitter?.fullName ?? r.feedback.submitterName,
        email: r.submitter?.email ?? r.feedback.submitterEmail,
        role: r.submitter?.role ?? r.feedback.submitterRole,
      },
      company: r.company,
      type: r.feedback.type,
      severity: r.feedback.severity,
      subject: r.feedback.subject,
      message: r.feedback.message,
      pageUrl: r.feedback.pageUrl,
      userAgent: r.feedback.userAgent,
      appVersion: r.feedback.appVersion,
      status: r.feedback.status,
      adminNote: r.feedback.adminNote,
      resolvedAt: r.feedback.resolvedAt?.toISOString() ?? null,
      resolvedBy: r.feedback.resolvedBy,
      createdAt: r.feedback.createdAt.toISOString(),
      updatedAt: r.feedback.updatedAt.toISOString(),
    };
  }
}
