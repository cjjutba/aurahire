import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthUser } from "@aurahire/shared";

import { AuditService, AUDIT_ACTIONS } from "../../audit";
import type { InitCandidateProfileDto } from "./dto/init-candidate-profile.dto";
import type { InitRecruiterProfileDto } from "./dto/init-recruiter-profile.dto";
import type { ProfileResponseDto } from "./dto/profile-response.dto";
import { ProfilesRepository } from "./profiles.repository";

@Injectable()
export class ProfilesService {
  constructor(
    private readonly repo: ProfilesRepository,
    private readonly audit: AuditService,
  ) {}

  /**
   * Build the canonical /profiles/me response by joining profile + role-specific subprofile + (recruiter only) company.
   */
  async getMe(user: AuthUser): Promise<ProfileResponseDto> {
    const profile = await this.repo.findById(user.id);
    if (!profile) {
      throw new NotFoundException({
        code: "PROFILE_NOT_FOUND",
        message: "Profile not found",
      });
    }

    let candidateProfile: ProfileResponseDto["candidateProfile"] = null;
    let recruiterProfile: ProfileResponseDto["recruiterProfile"] = null;
    let company: ProfileResponseDto["company"] = null;
    let profileCompleted = false;

    if (profile.role === "candidate") {
      const c = await this.repo.findCandidateProfile(profile.id);
      if (c) {
        candidateProfile = {
          headline: c.headline,
          summary: c.summary,
          locationCity: c.locationCity,
          locationCountry: c.locationCountry,
          profileCompleted: c.profileCompleted,
        };
        profileCompleted = c.profileCompleted;
      }
    } else if (profile.role === "recruiter") {
      const r = await this.repo.findRecruiterProfile(profile.id);
      if (r) {
        recruiterProfile = {
          companyId: r.companyId,
          jobTitle: r.jobTitle,
          department: r.department,
          profileCompleted: r.profileCompleted,
        };
        profileCompleted = r.profileCompleted;
        const c = await this.repo.findCompanyById(r.companyId);
        if (c) {
          company = {
            id: c.id,
            name: c.name,
            industry: c.industry,
            size: c.size,
            website: c.website,
          };
        }
      }
    } else if (profile.role === "admin") {
      profileCompleted = true;
    }

    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      status: profile.status,
      phone: profile.phone,
      avatarUrl: profile.avatarUrl,
      profileCompleted,
      candidateProfile,
      recruiterProfile,
      company,
    };
  }

  /**
   * Initialize a candidate profile after Supabase signUp() succeeded on the frontend.
   * The JWT carries the auth.users.id we use as profiles.id.
   */
  async initCandidateProfile(
    authUserId: string,
    email: string,
    dto: InitCandidateProfileDto,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<ProfileResponseDto> {
    const existing = await this.repo.findById(authUserId);
    if (existing) {
      throw new ConflictException({
        code: "PROFILE_ALREADY_EXISTS",
        message: "A profile already exists for this user",
      });
    }

    const { profile, candidateProfile } = await this.repo.insertCandidate(
      {
        id: authUserId,
        role: "candidate",
        fullName: dto.fullName,
        email,
        phone: dto.phone,
        status: "active",
      },
      {
        profileCompleted: false,
        desiredRoles: [],
        openTo: [],
      },
    );

    await this.audit.log({
      actorId: profile.id,
      actorType: "user",
      action: AUDIT_ACTIONS.USER_REGISTERED_CANDIDATE,
      entityType: "user",
      entityId: profile.id,
      details: { email },
      ...requestMeta,
    });

    return this.getMe({
      id: profile.id,
      email: profile.email,
      role: profile.role,
      status: profile.status,
      fullName: profile.fullName,
      profileCompleted: candidateProfile.profileCompleted,
    });
  }

  /**
   * Initialize a recruiter profile. Also creates the company row.
   */
  async initRecruiterProfile(
    authUserId: string,
    email: string,
    dto: InitRecruiterProfileDto,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<ProfileResponseDto> {
    const existing = await this.repo.findById(authUserId);
    if (existing) {
      throw new ConflictException({
        code: "PROFILE_ALREADY_EXISTS",
        message: "A profile already exists for this user",
      });
    }

    const { profile, company, recruiterProfile } = await this.repo.insertRecruiter(
      {
        id: authUserId,
        role: "recruiter",
        fullName: dto.fullName,
        email,
        phone: dto.phone,
        status: "active",
      },
      {
        name: dto.companyName,
        createdBy: authUserId,
      },
      {
        rolesHiringFor: [],
        profileCompleted: false,
      },
    );

    await this.audit.log({
      actorId: profile.id,
      actorType: "user",
      action: AUDIT_ACTIONS.USER_REGISTERED_RECRUITER,
      entityType: "user",
      entityId: profile.id,
      details: { email, companyId: company.id },
      ...requestMeta,
    });

    return this.getMe({
      id: profile.id,
      email: profile.email,
      role: profile.role,
      status: profile.status,
      fullName: profile.fullName,
      profileCompleted: recruiterProfile.profileCompleted,
    });
  }
}
