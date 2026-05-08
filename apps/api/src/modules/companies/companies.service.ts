import { randomBytes } from "node:crypto";

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
  CompanyMemberRole,
  CreateCompanyInput,
  DeleteCompanyInput,
  InviteMemberInput,
  TransferOwnershipInput,
  UpdateCompanyInput,
  UpdateMemberInput,
} from "@aurahire/shared";
import type {
  Company,
  CompanyMember,
  Profile,
} from "@aurahire/db";

import { AuditService, AUDIT_ACTIONS } from "../../audit";
import { CacheService, TAGS } from "../../cache";
import { isUniqueViolation } from "../../common/db/pg-error";
import { EmailService } from "../../email/email.service";
import { TeamInvitationEmail } from "../../email/templates/team-invitation";
import { ProfilesRepository } from "../profiles/profiles.repository";
import { CompaniesRepository } from "./companies.repository";
import { CompanyMembersRepository } from "./company-members.repository";
import type { CompanyResponseDto } from "./dto/company-response.dto";
import type { CompanyMemberResponseDto } from "./dto/company-member-response.dto";

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

const INVITATION_TOKEN_BYTES = 32;
const INVITATION_TTL_DAYS = 14;

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private readonly companiesRepo: CompaniesRepository,
    private readonly membersRepo: CompanyMembersRepository,
    private readonly profilesRepo: ProfilesRepository,
    private readonly audit: AuditService,
    private readonly cacheService: CacheService,
    private readonly email: EmailService,
  ) {}

  // ─── Company CRUD ────────────────────────────────────────────────────

  async create(
    user: AuthUser,
    dto: CreateCompanyInput,
    requestMeta: RequestMeta = {},
  ): Promise<CompanyResponseDto> {
    if (user.role !== "recruiter" && user.role !== "admin") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Only recruiters can create companies",
      });
    }

    const profile = await this.profilesRepo.findById(user.id);
    if (!profile) {
      throw new NotFoundException({
        code: "PROFILE_NOT_FOUND",
        message: "Complete your profile before creating a company",
      });
    }

    const company = await this.companiesRepo.insert({
      name: dto.name,
      industry: dto.industry ?? null,
      size: dto.size ?? null,
      website: dto.website ?? null,
      logoUrl: dto.logoUrl ?? null,
      headquartersLocation: dto.headquartersLocation ?? null,
      description: dto.description ?? null,
      createdBy: user.id,
    });

    const now = new Date();
    await this.membersRepo.insert({
      companyId: company.id,
      userId: user.id,
      email: profile.email,
      role: "owner",
      status: "active",
      invitedBy: user.id,
      invitedAt: now,
      joinedAt: now,
    });

    // Point profile at the brand-new company so subsequent recruiter requests
    // resolve a default active company without an explicit switch.
    await this.profilesRepo.setActiveCompany(user.id, company.id);

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.COMPANY_CREATED,
      entityType: "company",
      entityId: company.id,
      companyId: company.id,
      details: { name: company.name },
      ...requestMeta,
    });

    await this.cacheService.bustTags([TAGS.userMemberships(user.id)]);

    return this.toCompanyResponse(company);
  }

  async getMine(companyId: string): Promise<CompanyResponseDto> {
    const company = await this.companiesRepo.findById(companyId);
    if (!company) {
      throw new NotFoundException({
        code: "COMPANY_NOT_FOUND",
        message: "Company not found",
      });
    }
    return this.toCompanyResponse(company);
  }

  async updateMine(
    user: AuthUser,
    companyId: string,
    dto: UpdateCompanyInput,
    requestMeta: RequestMeta = {},
  ): Promise<CompanyResponseDto> {
    const patch: Partial<Parameters<CompaniesRepository["update"]>[1]> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.industry !== undefined) patch.industry = dto.industry ?? null;
    if (dto.size !== undefined) patch.size = dto.size ?? null;
    if (dto.website !== undefined) patch.website = dto.website ?? null;
    if (dto.logoUrl !== undefined) patch.logoUrl = dto.logoUrl ?? null;
    if (dto.headquartersLocation !== undefined)
      patch.headquartersLocation = dto.headquartersLocation ?? null;
    if (dto.description !== undefined) patch.description = dto.description ?? null;

    if (Object.keys(patch).length === 0) {
      // Nothing to update — return existing.
      return this.getMine(companyId);
    }

    const company = await this.companiesRepo.update(companyId, patch);

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.COMPANY_UPDATED,
      entityType: "company",
      entityId: company.id,
      companyId: company.id,
      details: { fields: Object.keys(patch) },
      ...requestMeta,
    });

    await this.cacheService.bustTags([
      TAGS.companyMembership(company.id),
      TAGS.companyJobs(company.id),
    ]);

    return this.toCompanyResponse(company);
  }

  async deleteMine(
    user: AuthUser,
    companyId: string,
    dto: DeleteCompanyInput,
    requestMeta: RequestMeta = {},
  ): Promise<{ deleted: true; companyId: string }> {
    const company = await this.companiesRepo.findById(companyId);
    if (!company) {
      throw new NotFoundException({
        code: "COMPANY_NOT_FOUND",
        message: "Company not found",
      });
    }
    if (dto.confirmName !== company.name) {
      throw new BadRequestException({
        code: "CONFIRMATION_MISMATCH",
        message: "Type the company name exactly as shown to confirm deletion",
      });
    }

    await this.companiesRepo.deleteById(companyId);

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.COMPANY_DELETED,
      entityType: "company",
      entityId: companyId,
      // companyId is intentionally null — the row that would carry the link
      // is being deleted; the FK is ON DELETE SET NULL on audit_logs.
      companyId: null,
      details: { name: company.name },
      ...requestMeta,
    });

    await this.cacheService.bustTags([
      TAGS.companyMembership(companyId),
      TAGS.companyJobs(companyId),
      TAGS.userMemberships(user.id),
    ]);

    return { deleted: true, companyId };
  }

  // ─── Members ─────────────────────────────────────────────────────────

  async listMembers(companyId: string): Promise<CompanyMemberResponseDto[]> {
    const rows = await this.membersRepo.listForCompany(companyId);
    return rows.map((row) => this.toMemberResponse(row, row.user, row.inviterName));
  }

  async inviteMember(
    user: AuthUser,
    companyId: string,
    dto: InviteMemberInput,
    requestMeta: RequestMeta = {},
  ): Promise<CompanyMemberResponseDto> {
    const inviterProfile = await this.profilesRepo.findById(user.id);
    if (!inviterProfile) {
      throw new NotFoundException({
        code: "PROFILE_NOT_FOUND",
        message: "Inviter profile missing",
      });
    }
    const company = await this.companiesRepo.findById(companyId);
    if (!company) {
      throw new NotFoundException({
        code: "COMPANY_NOT_FOUND",
        message: "Company not found",
      });
    }

    // Reject if the email already has a non-`left` row in this company.
    const existing = await this.membersRepo.findByEmailInCompany(
      companyId,
      dto.email,
    );
    if (existing && existing.status !== "left") {
      throw new ConflictException({
        code: "ALREADY_INVITED",
        message: `${dto.email} already has an ${existing.status} membership in this company`,
      });
    }

    const token = this.generateInvitationToken();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    let inserted: CompanyMember;
    if (existing && existing.status === "left") {
      // Re-invite a previously-left member by resurrecting the row — preserves
      // the (company_id, email) UNIQUE constraint and keeps audit history.
      inserted = await this.membersRepo.update(existing.id, {
        userId: null,
        role: dto.role,
        status: "invited",
        invitationToken: token,
        invitationExpiresAt: expiresAt,
        invitedBy: user.id,
        invitedAt: now,
        joinedAt: null,
        removedAt: null,
      });
    } else {
      try {
        inserted = await this.membersRepo.insert({
          companyId,
          userId: null,
          email: dto.email,
          role: dto.role,
          status: "invited",
          invitationToken: token,
          invitationExpiresAt: expiresAt,
          invitedBy: user.id,
          invitedAt: now,
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new ConflictException({
            code: "ALREADY_INVITED",
            message: "An invitation already exists for that email",
          });
        }
        throw err;
      }
    }

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.COMPANY_MEMBER_INVITED,
      entityType: "company_member",
      entityId: inserted.id,
      companyId,
      details: { email: dto.email, role: dto.role },
      ...requestMeta,
    });

    await this.cacheService.bustTags([TAGS.companyMembership(companyId)]);

    void this.sendInvitationEmail(token, dto.email, inserted, inviterProfile, company, expiresAt);

    return this.toMemberResponse(inserted, null, inviterProfile.fullName);
  }

  async updateMember(
    user: AuthUser,
    companyId: string,
    memberId: string,
    dto: UpdateMemberInput,
    requestMeta: RequestMeta = {},
  ): Promise<CompanyMemberResponseDto> {
    const member = await this.membersRepo.findById(memberId);
    if (!member || member.companyId !== companyId) {
      throw new NotFoundException({
        code: "MEMBER_NOT_FOUND",
        message: "Member not found",
      });
    }

    if (member.role === "owner" && dto.role !== "owner") {
      // Demoting an owner — block if they're the last one. Use transfer
      // ownership instead.
      const ownerCount = await this.membersRepo.countActiveOwners(companyId);
      if (ownerCount <= 1) {
        throw new BadRequestException({
          code: "LAST_OWNER",
          message:
            "Cannot demote the last owner. Transfer ownership to another member first.",
        });
      }
    }

    const updated = await this.membersRepo.update(memberId, { role: dto.role });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.COMPANY_MEMBER_ROLE_CHANGED,
      entityType: "company_member",
      entityId: memberId,
      companyId,
      details: { from: member.role, to: dto.role, email: member.email },
      ...requestMeta,
    });

    await this.cacheService.bustTags([
      TAGS.companyMembership(companyId),
      ...(member.userId ? [TAGS.userMemberships(member.userId)] : []),
    ]);

    return this.toMemberResponse(updated, null, null);
  }

  async transferOwnership(
    user: AuthUser,
    companyId: string,
    memberId: string,
    dto: TransferOwnershipInput,
    requestMeta: RequestMeta = {},
  ): Promise<CompanyMemberResponseDto> {
    const target = await this.membersRepo.findById(memberId);
    if (!target || target.companyId !== companyId) {
      throw new NotFoundException({
        code: "MEMBER_NOT_FOUND",
        message: "Member not found",
      });
    }
    if (target.status !== "active") {
      throw new BadRequestException({
        code: "INACTIVE_MEMBER",
        message: "Can only transfer ownership to an active member",
      });
    }
    if (target.userId === user.id) {
      throw new BadRequestException({
        code: "SELF_TRANSFER",
        message: "Cannot transfer ownership to yourself",
      });
    }
    if (target.email !== dto.confirmEmail) {
      throw new BadRequestException({
        code: "CONFIRMATION_MISMATCH",
        message: "Type the target member's email exactly to confirm",
      });
    }

    // Find the caller's own membership row to demote.
    const callerMember = await this.membersRepo.findActiveMembership(
      user.id,
      companyId,
    );
    if (!callerMember) {
      throw new ForbiddenException({
        code: "NOT_A_MEMBER",
        message: "You are not a member of this company",
      });
    }

    // Atomic-ish: promote target → owner, demote caller → admin. These two
    // operations don't share a transaction in this stopgap implementation;
    // failure between them is rare and recoverable manually. Phase 2c can
    // wrap them in a tx if needed.
    const promoted = await this.membersRepo.update(memberId, { role: "owner" });
    await this.membersRepo.update(callerMember.id, { role: "admin" });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.COMPANY_MEMBER_OWNERSHIP_TRANSFERRED,
      entityType: "company_member",
      entityId: memberId,
      companyId,
      details: {
        fromMemberId: callerMember.id,
        toMemberId: memberId,
        toEmail: target.email,
      },
      ...requestMeta,
    });

    await this.cacheService.bustTags([
      TAGS.companyMembership(companyId),
      TAGS.userMemberships(user.id),
      ...(target.userId ? [TAGS.userMemberships(target.userId)] : []),
    ]);

    return this.toMemberResponse(promoted, null, null);
  }

  async resendInvitation(
    user: AuthUser,
    companyId: string,
    memberId: string,
    requestMeta: RequestMeta = {},
  ): Promise<CompanyMemberResponseDto> {
    const member = await this.membersRepo.findById(memberId);
    if (!member || member.companyId !== companyId) {
      throw new NotFoundException({
        code: "MEMBER_NOT_FOUND",
        message: "Member not found",
      });
    }
    if (member.status !== "invited") {
      throw new BadRequestException({
        code: "NOT_PENDING",
        message: "Only pending invitations can be resent",
      });
    }

    const inviterProfile = await this.profilesRepo.findById(user.id);
    if (!inviterProfile) {
      throw new NotFoundException({
        code: "PROFILE_NOT_FOUND",
        message: "Inviter profile missing",
      });
    }
    const company = await this.companiesRepo.findById(companyId);
    if (!company) {
      throw new NotFoundException({
        code: "COMPANY_NOT_FOUND",
        message: "Company not found",
      });
    }

    const token = this.generateInvitationToken();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const updated = await this.membersRepo.update(memberId, {
      invitationToken: token,
      invitationExpiresAt: expiresAt,
      invitedBy: user.id,
      invitedAt: now,
    });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.COMPANY_MEMBER_INVITATION_RESENT,
      entityType: "company_member",
      entityId: memberId,
      companyId,
      details: { email: member.email },
      ...requestMeta,
    });

    void this.sendInvitationEmail(
      token,
      member.email,
      updated,
      inviterProfile,
      company,
      expiresAt,
    );

    return this.toMemberResponse(updated, null, inviterProfile.fullName);
  }

  async removeMember(
    user: AuthUser,
    companyId: string,
    memberId: string,
    requestMeta: RequestMeta = {},
  ): Promise<{ removed: true; memberId: string }> {
    const member = await this.membersRepo.findById(memberId);
    if (!member || member.companyId !== companyId) {
      throw new NotFoundException({
        code: "MEMBER_NOT_FOUND",
        message: "Member not found",
      });
    }

    if (member.status === "invited") {
      // Hard-delete pending invites. There's no audit history worth keeping —
      // the invite never resulted in a real membership.
      await this.membersRepo.deleteById(memberId);

      await this.audit.log({
        actorId: user.id,
        actorType: "user",
        action: AUDIT_ACTIONS.COMPANY_MEMBER_INVITATION_REVOKED,
        entityType: "company_member",
        entityId: memberId,
        companyId,
        details: { email: member.email },
        ...requestMeta,
      });
    } else {
      // Active members get soft-suspended so audit history remains intact.
      if (member.role === "owner") {
        const ownerCount = await this.membersRepo.countActiveOwners(companyId);
        if (ownerCount <= 1) {
          throw new BadRequestException({
            code: "LAST_OWNER",
            message: "Cannot remove the last owner",
          });
        }
      }
      await this.membersRepo.update(memberId, {
        status: "suspended",
        removedAt: new Date(),
      });

      await this.audit.log({
        actorId: user.id,
        actorType: "user",
        action: AUDIT_ACTIONS.COMPANY_MEMBER_REMOVED,
        entityType: "company_member",
        entityId: memberId,
        companyId,
        details: { email: member.email, role: member.role },
        ...requestMeta,
      });
    }

    await this.cacheService.bustTags([
      TAGS.companyMembership(companyId),
      ...(member.userId ? [TAGS.userMemberships(member.userId)] : []),
    ]);

    return { removed: true, memberId };
  }

  async leaveCompany(
    user: AuthUser,
    companyId: string,
    callerRole: CompanyMemberRole,
    requestMeta: RequestMeta = {},
  ): Promise<{ left: true; nextActiveCompanyId: string | null }> {
    const member = await this.membersRepo.findActiveMembership(
      user.id,
      companyId,
    );
    if (!member) {
      throw new NotFoundException({
        code: "NOT_A_MEMBER",
        message: "You are not a member of this company",
      });
    }
    if (callerRole === "owner") {
      const ownerCount = await this.membersRepo.countActiveOwners(companyId);
      if (ownerCount <= 1) {
        throw new BadRequestException({
          code: "LAST_OWNER",
          message:
            "Transfer ownership before leaving — you're the last owner of this company.",
        });
      }
    }

    await this.membersRepo.update(member.id, {
      status: "left",
      removedAt: new Date(),
    });

    // Repoint last_active_company_id to the next active membership (oldest
    // first, deterministic), or null if there are no others.
    const remaining = await this.membersRepo.listActiveForUser(user.id);
    // listActiveForUser returns rows desc by joinedAt; pick the most recent
    // remaining membership as the new active company.
    const nextActiveCompanyId = remaining[0]?.companyId ?? null;
    await this.profilesRepo.setActiveCompany(user.id, nextActiveCompanyId);

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.COMPANY_MEMBER_LEFT,
      entityType: "company_member",
      entityId: member.id,
      companyId,
      details: { role: member.role },
      ...requestMeta,
    });

    await this.cacheService.bustTags([
      TAGS.companyMembership(companyId),
      TAGS.userMemberships(user.id),
    ]);

    return { left: true, nextActiveCompanyId };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private generateInvitationToken(): string {
    return randomBytes(INVITATION_TOKEN_BYTES).toString("base64url");
  }

  private async sendInvitationEmail(
    token: string,
    email: string,
    _member: CompanyMember,
    inviter: Profile,
    company: Company,
    expiresAt: Date,
  ): Promise<void> {
    try {
      const appUrl = process.env.APP_URL ?? "http://localhost:3000";
      const inviteUrl = `${appUrl}/invite/${token}`;
      await this.email.send({
        to: email,
        subject: `${inviter.fullName} invited you to ${company.name} on AuraHire`,
        template: TeamInvitationEmail({
          inviterName: inviter.fullName,
          companyName: company.name,
          role: _member.role,
          inviteUrl,
          expiresAt: expiresAt.toUTCString(),
        }),
      });
    } catch (err) {
      // EmailService already swallows per its contract; this catch is an
      // extra ring just so the controller path returns even if rendering
      // throws synchronously.
      this.logger.warn(
        `Invitation email render failed for ${email}: ${(err as Error).message}`,
      );
    }
  }

  private toCompanyResponse(company: Company): CompanyResponseDto {
    return {
      id: company.id,
      name: company.name,
      industry: company.industry,
      size: company.size,
      website: company.website,
      logoUrl: company.logoUrl,
      headquartersLocation: company.headquartersLocation,
      description: company.description,
      createdBy: company.createdBy,
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString(),
    };
  }

  toMemberResponse(
    member: CompanyMember,
    user: Profile | null,
    inviterName: string | null,
  ): CompanyMemberResponseDto {
    return {
      id: member.id,
      companyId: member.companyId,
      userId: member.userId,
      email: member.email,
      role: member.role,
      status: member.status,
      // Token is intentionally surfaced — the inviter UX includes "Copy link"
      // for the case where the email never arrives.
      invitationToken: member.invitationToken,
      invitationExpiresAt: member.invitationExpiresAt
        ? member.invitationExpiresAt.toISOString()
        : null,
      invitedBy: member.invitedBy,
      inviterName,
      invitedAt: member.invitedAt.toISOString(),
      joinedAt: member.joinedAt ? member.joinedAt.toISOString() : null,
      removedAt: member.removedAt ? member.removedAt.toISOString() : null,
      user: user
        ? {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            avatarUrl: user.avatarUrl,
          }
        : null,
    };
  }
}
