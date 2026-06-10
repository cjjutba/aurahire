import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AuthUser } from "@aurahire/shared";

import { AuditService, AUDIT_ACTIONS } from "../../audit";
import { CacheService, TAGS } from "../../cache";
import { CompaniesRepository } from "../companies/companies.repository";
import { CompanyMembersRepository } from "../companies/company-members.repository";
import { ProfilesRepository } from "../profiles/profiles.repository";

import type { InvitationPreviewDto } from "./dto/invitation-preview.dto";
import type {
  InvitationAcceptResultDto,
  InvitationDeclineResultDto,
} from "./dto/invitation-response.dto";

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly membersRepo: CompanyMembersRepository,
    private readonly companiesRepo: CompaniesRepository,
    private readonly profilesRepo: ProfilesRepository,
    private readonly audit: AuditService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Public-facing preview. Returns 404 if the token is unknown OR has been
   * consumed (invitation_token cleared on accept). Status + isExpired let
   * the frontend render an appropriate UI.
   */
  async preview(token: string): Promise<InvitationPreviewDto> {
    const member = await this.membersRepo.findByToken(token);
    if (!member) {
      throw new NotFoundException({
        code: "INVITATION_NOT_FOUND",
        message: "Invitation not found or already used",
      });
    }
    const company = await this.companiesRepo.findById(member.companyId);
    if (!company) {
      throw new NotFoundException({
        code: "COMPANY_NOT_FOUND",
        message: "Company not found",
      });
    }

    let inviterName: string | null = null;
    if (member.invitedBy) {
      const inviter = await this.profilesRepo.findById(member.invitedBy);
      inviterName = inviter?.fullName ?? null;
    }

    const isExpired = member.invitationExpiresAt
      ? member.invitationExpiresAt.getTime() < Date.now()
      : false;

    return {
      companyId: company.id,
      companyName: company.name,
      companyLogoUrl: company.logoUrl,
      inviterName,
      role: member.role,
      email: member.email,
      invitedAt: member.invitedAt.toISOString(),
      expiresAt: member.invitationExpiresAt
        ? member.invitationExpiresAt.toISOString()
        : null,
      status: member.status,
      isExpired,
    };
  }

  async accept(
    user: AuthUser,
    token: string,
    requestMeta: RequestMeta = {},
  ): Promise<InvitationAcceptResultDto> {
    const member = await this.membersRepo.findByToken(token);
    if (!member) {
      throw new NotFoundException({
        code: "INVITATION_NOT_FOUND",
        message: "Invitation not found or already used",
      });
    }
    if (member.status !== "invited") {
      throw new ConflictException({
        code: "INVITATION_NOT_PENDING",
        message: `Invitation is already ${member.status}`,
      });
    }
    if (
      member.invitationExpiresAt &&
      member.invitationExpiresAt.getTime() < Date.now()
    ) {
      throw new GoneException({
        code: "INVITATION_EXPIRED",
        message: "This invitation has expired. Ask the inviter to resend it.",
      });
    }

    // Anti-forwarding: the email on the invitation must match the auth user's
    // email. Preserves the audit trail and prevents one user from accepting an
    // invite addressed to another.
    const callerProfile = await this.profilesRepo.findById(user.id);
    if (!callerProfile) {
      throw new NotFoundException({
        code: "PROFILE_NOT_FOUND",
        message: "Complete your profile before accepting an invitation",
      });
    }
    if (callerProfile.email.toLowerCase() !== member.email.toLowerCase()) {
      throw new ForbiddenException({
        code: "INVITATION_EMAIL_MISMATCH",
        message:
          "This invitation was sent to a different email. Sign in with the invited account.",
      });
    }

    const company = await this.companiesRepo.findById(member.companyId);
    if (!company) {
      throw new NotFoundException({
        code: "COMPANY_NOT_FOUND",
        message: "Company not found",
      });
    }

    // Reject if the user already has another active membership row in this
    // company (shouldn't happen per the (company_id, user_id) unique, but the
    // constraint races invited→active).
    const existing = await this.membersRepo.findActiveMembership(
      user.id,
      member.companyId,
    );
    if (existing) {
      throw new ConflictException({
        code: "ALREADY_MEMBER",
        message: "You are already a member of this company",
      });
    }

    const now = new Date();
    await this.membersRepo.update(member.id, {
      userId: user.id,
      status: "active",
      joinedAt: now,
      invitationToken: null,
      invitationExpiresAt: null,
    });

    await this.profilesRepo.setActiveCompany(user.id, company.id);

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.COMPANY_MEMBER_INVITATION_ACCEPTED,
      entityType: "company_member",
      entityId: member.id,
      companyId: company.id,
      details: { email: member.email, role: member.role },
      ...requestMeta,
    });

    await this.cacheService.bustTags([
      TAGS.companyMembership(company.id),
      TAGS.userMemberships(user.id),
    ]);

    return {
      companyId: company.id,
      companyName: company.name,
      role: member.role,
    };
  }

  async decline(
    user: AuthUser,
    token: string,
    requestMeta: RequestMeta = {},
  ): Promise<InvitationDeclineResultDto> {
    const member = await this.membersRepo.findByToken(token);
    if (!member) {
      throw new NotFoundException({
        code: "INVITATION_NOT_FOUND",
        message: "Invitation not found or already used",
      });
    }
    if (member.status !== "invited") {
      throw new BadRequestException({
        code: "INVITATION_NOT_PENDING",
        message: `Invitation is already ${member.status}`,
      });
    }

    // Same email-match guard as accept - only the addressee can decline.
    const callerProfile = await this.profilesRepo.findById(user.id);
    if (!callerProfile) {
      throw new NotFoundException({
        code: "PROFILE_NOT_FOUND",
        message: "Profile missing",
      });
    }
    if (callerProfile.email.toLowerCase() !== member.email.toLowerCase()) {
      throw new ForbiddenException({
        code: "INVITATION_EMAIL_MISMATCH",
        message: "This invitation was sent to a different email.",
      });
    }

    await this.membersRepo.deleteById(member.id);

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.COMPANY_MEMBER_INVITATION_DECLINED,
      entityType: "company_member",
      entityId: member.id,
      companyId: member.companyId,
      details: { email: member.email, role: member.role },
      ...requestMeta,
    });

    await this.cacheService.bustTags([
      TAGS.companyMembership(member.companyId),
    ]);

    return { declined: true };
  }
}
