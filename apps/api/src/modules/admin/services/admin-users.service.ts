import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type {
  AuthUser,
  ChangeUserRoleInput,
  ListAdminUsersQuery,
  SuspendUserInput,
} from "@aurahire/shared";

import { AuditService, AUDIT_ACTIONS } from "../../../audit";
import { SupabaseAdminService } from "../../../lib/supabase-admin";
import { EmailService } from "../../../email/email.service";
import { PasswordResetTemplate } from "../../../email/templates/password-reset";
import { AuthService } from "../../auth/auth.service";
import { AdminUsersRepository } from "../repositories/admin-users.repository";
import type {
  AdminUserDetailDto,
  AdminUserDto,
  AdminUserListEnvelopeDto,
  ForcePasswordResetDataDto,
} from "../dto/admin-user-response.dto";

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    private readonly repo: AdminUsersRepository,
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly authService: AuthService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
  ) {}

  // -----------------------------------------------------------------
  // LIST + DETAIL
  // -----------------------------------------------------------------

  async list(query: ListAdminUsersQuery): Promise<AdminUserListEnvelopeDto> {
    const { rows, total } = await this.repo.list({
      role: query.role,
      status: query.status,
      q: query.q,
      createdFrom: query.createdFrom ? new Date(query.createdFrom) : undefined,
      createdTo: query.createdTo ? new Date(query.createdTo) : undefined,
      page: query.page,
      limit: query.limit,
    });

    return {
      data: rows.map((r) => this.toDto(r)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getById(id: string): Promise<AdminUserDetailDto> {
    const profile = await this.repo.findById(id);
    if (!profile)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "User not found",
      });

    const auditEntryCount = await this.repo.countAuditEntriesForUser(id);
    return { ...this.toDto(profile), auditEntryCount };
  }

  // -----------------------------------------------------------------
  // SUSPEND / REACTIVATE
  // -----------------------------------------------------------------

  async suspend(
    actor: AuthUser,
    targetId: string,
    dto: SuspendUserInput,
    meta: RequestMeta = {},
  ): Promise<AdminUserDto> {
    this.assertNotSelf(actor.id, targetId, "suspend");

    const profile = await this.repo.findById(targetId);
    if (!profile)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "User not found",
      });
    if (profile.status === "deleted") {
      throw new BadRequestException({
        code: "INVALID_STATE",
        message: "Cannot suspend a deleted user",
      });
    }
    if (profile.status === "suspended") {
      throw new BadRequestException({
        code: "ALREADY_SUSPENDED",
        message: "User is already suspended",
      });
    }

    const updated = await this.repo.update(targetId, { status: "suspended" });

    await this.audit.log({
      actorId: actor.id,
      actorType: "user",
      action: AUDIT_ACTIONS.USER_SUSPENDED,
      entityType: "profile",
      entityId: targetId,
      details: { targetUserId: targetId, reason: dto.reason },
      ...meta,
    });

    this.logger.log(`User ${targetId} suspended by admin ${actor.id}`);
    return this.toDto(updated);
  }

  async reactivate(
    actor: AuthUser,
    targetId: string,
    meta: RequestMeta = {},
  ): Promise<AdminUserDto> {
    const profile = await this.repo.findById(targetId);
    if (!profile)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "User not found",
      });
    if (profile.status !== "suspended") {
      throw new BadRequestException({
        code: "NOT_SUSPENDED",
        message: `User status is '${profile.status}'; can only reactivate a suspended user`,
      });
    }

    const updated = await this.repo.update(targetId, { status: "active" });

    await this.audit.log({
      actorId: actor.id,
      actorType: "user",
      action: AUDIT_ACTIONS.USER_REACTIVATED,
      entityType: "profile",
      entityId: targetId,
      details: { targetUserId: targetId },
      ...meta,
    });

    return this.toDto(updated);
  }

  // -----------------------------------------------------------------
  // CHANGE ROLE
  // -----------------------------------------------------------------

  async changeRole(
    actor: AuthUser,
    targetId: string,
    dto: ChangeUserRoleInput,
    meta: RequestMeta = {},
  ): Promise<AdminUserDto> {
    const profile = await this.repo.findById(targetId);
    if (!profile)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "User not found",
      });
    if (profile.status === "deleted") {
      throw new BadRequestException({
        code: "INVALID_STATE",
        message: "Cannot change role of a deleted user",
      });
    }
    if (profile.role === dto.newRole) {
      throw new BadRequestException({
        code: "NO_CHANGE",
        message: "User already has this role",
      });
    }
    if (
      actor.id === targetId &&
      profile.role === "admin" &&
      dto.newRole !== "admin"
    ) {
      throw new ForbiddenException({
        code: "CANNOT_DEMOTE_SELF",
        message: "Admins cannot demote their own account",
      });
    }

    const updated = await this.repo.update(targetId, { role: dto.newRole });

    await this.audit.log({
      actorId: actor.id,
      actorType: "user",
      action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
      entityType: "profile",
      entityId: targetId,
      details: {
        targetUserId: targetId,
        before: profile.role,
        after: dto.newRole,
      },
      ...meta,
    });

    return this.toDto(updated);
  }

  // -----------------------------------------------------------------
  // DELETE
  // -----------------------------------------------------------------

  async delete(
    actor: AuthUser,
    targetId: string,
    meta: RequestMeta = {},
  ): Promise<AdminUserDto> {
    this.assertNotSelf(actor.id, targetId, "delete");

    const profile = await this.repo.findById(targetId);
    if (!profile)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "User not found",
      });
    if (profile.status === "deleted") {
      throw new BadRequestException({
        code: "ALREADY_DELETED",
        message: "User is already deleted",
      });
    }

    const updated = await this.repo.update(targetId, { status: "deleted" });

    try {
      await this.supabaseAdmin.deleteUser(targetId);
    } catch (err) {
      this.logger.warn(
        `auth.users delete failed for ${targetId}: ${(err as Error).message}; profile already marked deleted`,
      );
    }

    await this.audit.log({
      actorId: actor.id,
      actorType: "user",
      action: AUDIT_ACTIONS.USER_DELETED,
      entityType: "profile",
      entityId: targetId,
      details: {
        targetUserId: targetId,
        targetEmail: profile.email,
        targetRole: profile.role,
      },
      ...meta,
    });

    return this.toDto(updated);
  }

  // -----------------------------------------------------------------
  // FORCE PASSWORD RESET
  // -----------------------------------------------------------------

  async forcePasswordReset(
    actor: AuthUser,
    targetId: string,
    meta: RequestMeta = {},
  ): Promise<ForcePasswordResetDataDto> {
    const profile = await this.repo.findById(targetId);
    if (!profile)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "User not found",
      });
    if (profile.status === "deleted") {
      throw new BadRequestException({
        code: "INVALID_STATE",
        message: "Cannot force-reset a deleted user",
      });
    }

    const { url, expiresAt } =
      await this.authService.issuePasswordResetTokenForUser({
        userId: targetId,
        email: profile.email,
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ?? null,
      });

    let emailSent = false;
    try {
      await this.email.send({
        to: profile.email,
        subject: "Your AuraHire password reset",
        template: PasswordResetTemplate({ resetUrl: url }),
      });
      emailSent = true;
    } catch (err) {
      this.logger.warn(
        `password reset email failed for ${profile.email}: ${(err as Error).message}; URL still returned to admin for manual delivery`,
      );
    }

    await this.audit.log({
      actorId: actor.id,
      actorType: "user",
      action: AUDIT_ACTIONS.USER_PASSWORD_RESET_FORCED,
      entityType: "profile",
      entityId: targetId,
      details: {
        targetUserId: targetId,
        targetEmail: profile.email,
        emailSent,
      },
      ...meta,
    });

    return {
      resetUrl: url,
      expiresAt: expiresAt.toISOString(),
      emailSent,
    };
  }

  // -----------------------------------------------------------------
  // PRIVATE
  // -----------------------------------------------------------------

  private assertNotSelf(
    actorId: string,
    targetId: string,
    action: string,
  ): void {
    if (actorId === targetId) {
      throw new ForbiddenException({
        code: "CANNOT_TARGET_SELF",
        message: `Admins cannot ${action} their own account`,
      });
    }
  }

  private toDto(p: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    status: string;
    phone: string | null;
    avatarUrl: string | null;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): AdminUserDto {
    return {
      id: p.id,
      fullName: p.fullName,
      email: p.email,
      role: p.role,
      status: p.status,
      phone: p.phone,
      avatarUrl: p.avatarUrl,
      lastLoginAt: p.lastLoginAt ? p.lastLoginAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
