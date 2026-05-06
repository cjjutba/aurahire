import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AuthUser, UpdateMyProfileInput } from "@aurahire/shared";
import type {
  Profile,
  CandidateProfile,
  RecruiterProfile,
  Company,
} from "@aurahire/db";

import { AuditService, AUDIT_ACTIONS } from "../../audit";
import { CacheService, TAGS } from "../../cache";
import { isUniqueViolation } from "../../common/db/pg-error";
import { CompanyMembersRepository } from "../companies/company-members.repository";
import type { InitCandidateProfileDto } from "./dto/init-candidate-profile.dto";
import type { InitRecruiterProfileDto } from "./dto/init-recruiter-profile.dto";
import type { MembershipDto } from "./dto/membership-response.dto";
import type { ProfileResponseDto } from "./dto/profile-response.dto";
import { ProfilesRepository } from "./profiles.repository";

@Injectable()
export class ProfilesService {
  constructor(
    private readonly repo: ProfilesRepository,
    private readonly membersRepo: CompanyMembersRepository,
    private readonly audit: AuditService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Build the canonical /profiles/me response by joining profile + role-specific
   * subprofile + (recruiter only) company. Reads run in parallel where the
   * dependency graph allows.
   */
  async getMe(user: AuthUser): Promise<ProfileResponseDto> {
    if (user.role === "candidate") {
      const [profile, candidateProfile] = await Promise.all([
        this.repo.findById(user.id),
        this.repo.findCandidateProfile(user.id),
      ]);
      if (!profile) {
        throw new NotFoundException({
          code: "PROFILE_NOT_FOUND",
          message: "Profile not found",
        });
      }
      return this.toCandidateResponse(profile, candidateProfile);
    }

    if (user.role === "recruiter") {
      const [profile, recruiterProfile] = await Promise.all([
        this.repo.findById(user.id),
        this.repo.findRecruiterProfile(user.id),
      ]);
      if (!profile) {
        throw new NotFoundException({
          code: "PROFILE_NOT_FOUND",
          message: "Profile not found",
        });
      }
      // Phase 2b: the recruiter→company link lives on profiles.lastActiveCompanyId
      // (and, source-of-truth, on company_members). The 1:1 column on
      // recruiter_profiles is gone; until Phase 2c wires ActiveCompanyGuard
      // globally, we read the active company directly from the profile.
      const activeCompanyId = profile.lastActiveCompanyId;
      const company = activeCompanyId
        ? await this.repo.findCompanyById(activeCompanyId)
        : null;
      return this.toRecruiterResponse(profile, recruiterProfile, company);
    }

    // admin
    const profile = await this.repo.findById(user.id);
    if (!profile) {
      throw new NotFoundException({
        code: "PROFILE_NOT_FOUND",
        message: "Profile not found",
      });
    }
    return this.toAdminResponse(profile);
  }

  /**
   * Initialize a candidate profile after Supabase signUp() succeeded on the frontend.
   * Optimized: skips the pre-insert existence SELECT (the PK conflict is detected
   * by the INSERT itself) and builds the response from the rows returned by the
   * transaction — no post-insert re-fetch.
   */
  async initCandidateProfile(
    authUserId: string,
    email: string,
    dto: InitCandidateProfileDto,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<ProfileResponseDto> {
    let profile: Profile;
    let candidateProfile: CandidateProfile;
    try {
      const result = await this.repo.insertCandidate(
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
      profile = result.profile;
      candidateProfile = result.candidateProfile;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException({
          code: "PROFILE_ALREADY_EXISTS",
          message: "A profile already exists for this user",
        });
      }
      throw err;
    }

    // Audit is non-blocking by contract — fire and forget so the response
    // doesn't pay another round-trip.
    void this.audit.log({
      actorId: profile.id,
      actorType: "user",
      action: AUDIT_ACTIONS.USER_REGISTERED_CANDIDATE,
      entityType: "user",
      entityId: profile.id,
      details: { email },
      ...requestMeta,
    });

    return this.toCandidateResponse(profile, candidateProfile);
  }

  /**
   * Initialize a recruiter profile + company. Same optimizations as candidate init.
   */
  async initRecruiterProfile(
    authUserId: string,
    email: string,
    dto: InitRecruiterProfileDto,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<ProfileResponseDto> {
    let profile: Profile;
    let company: Company;
    let recruiterProfile: RecruiterProfile;
    try {
      const result = await this.repo.insertRecruiter(
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
      profile = result.profile;
      company = result.company;
      recruiterProfile = result.recruiterProfile;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException({
          code: "PROFILE_ALREADY_EXISTS",
          message: "A profile already exists for this user",
        });
      }
      throw err;
    }

    void this.audit.log({
      actorId: profile.id,
      actorType: "user",
      action: AUDIT_ACTIONS.USER_REGISTERED_RECRUITER,
      entityType: "user",
      entityId: profile.id,
      details: { email, companyId: company.id },
      ...requestMeta,
    });

    return this.toRecruiterResponse(profile, recruiterProfile, company);
  }

  private toCandidateResponse(
    profile: Profile,
    candidateProfile: CandidateProfile | null,
  ): ProfileResponseDto {
    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      status: profile.status,
      phone: profile.phone,
      avatarUrl: profile.avatarUrl,
      profileCompleted: candidateProfile?.profileCompleted ?? false,
      lastActiveCompanyId: profile.lastActiveCompanyId,
      candidateProfile: candidateProfile
        ? {
            headline: candidateProfile.headline,
            summary: candidateProfile.summary,
            locationCity: candidateProfile.locationCity,
            locationCountry: candidateProfile.locationCountry,
            profileCompleted: candidateProfile.profileCompleted,
          }
        : null,
      recruiterProfile: null,
      company: null,
    };
  }

  private toRecruiterResponse(
    profile: Profile,
    recruiterProfile: RecruiterProfile | null,
    company: Company | null,
  ): ProfileResponseDto {
    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      status: profile.status,
      phone: profile.phone,
      avatarUrl: profile.avatarUrl,
      profileCompleted: recruiterProfile?.profileCompleted ?? false,
      lastActiveCompanyId: profile.lastActiveCompanyId,
      candidateProfile: null,
      recruiterProfile: recruiterProfile
        ? {
            // Phase 2b: companyId is no longer a column on recruiter_profiles.
            // The DTO field is preserved for client compatibility, sourced from
            // profiles.lastActiveCompanyId (the active-company pointer).
            companyId: profile.lastActiveCompanyId,
            jobTitle: recruiterProfile.jobTitle,
            department: recruiterProfile.department,
            profileCompleted: recruiterProfile.profileCompleted,
          }
        : null,
      company: company
        ? {
            id: company.id,
            name: company.name,
            industry: company.industry,
            size: company.size,
            website: company.website,
          }
        : null,
    };
  }

  /**
   * The user's full active-membership list. Used by the sidebar company
   * switcher and the post-signup company picker.
   */
  async getMyMemberships(user: AuthUser): Promise<MembershipDto[]> {
    const rows = await this.membersRepo.listActiveForUser(user.id);
    return rows.map((row) => ({
      companyId: row.company.id,
      companyName: row.company.name,
      companyLogoUrl: row.company.logoUrl,
      role: row.role,
      status: row.status,
      joinedAt: row.joinedAt ? row.joinedAt.toISOString() : null,
    }));
  }

  /**
   * Phase 2b: PATCH /profiles/me only accepts `lastActiveCompanyId` for now;
   * full profile editing arrives in Phase 5. Validates membership before
   * saving — a user cannot point at a company they don't actively belong to.
   */
  async updateMyProfile(
    user: AuthUser,
    dto: UpdateMyProfileInput,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<ProfileResponseDto> {
    if (dto.lastActiveCompanyId !== undefined) {
      // Reject for non-recruiters — candidates and admins don't have an
      // active-company concept.
      if (user.role !== "recruiter" && user.role !== "admin") {
        throw new ForbiddenException({
          code: "FORBIDDEN",
          message: "Only recruiters can switch active companies",
        });
      }

      const membership = await this.membersRepo.findActiveMembership(
        user.id,
        dto.lastActiveCompanyId,
      );
      if (!membership) {
        throw new BadRequestException({
          code: "NOT_A_MEMBER",
          message: "You are not an active member of that company",
        });
      }

      await this.repo.setActiveCompany(user.id, dto.lastActiveCompanyId);

      await this.audit.log({
        actorId: user.id,
        actorType: "user",
        action: AUDIT_ACTIONS.COMPANY_ACTIVE_SWITCHED,
        entityType: "profile",
        entityId: user.id,
        companyId: dto.lastActiveCompanyId,
        ...requestMeta,
      });

      await this.cacheService.bustTags([TAGS.userMemberships(user.id)]);
    }

    return this.getMe(user);
  }

  private toAdminResponse(profile: Profile): ProfileResponseDto {
    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      status: profile.status,
      phone: profile.phone,
      avatarUrl: profile.avatarUrl,
      profileCompleted: true,
      lastActiveCompanyId: profile.lastActiveCompanyId,
      candidateProfile: null,
      recruiterProfile: null,
      company: null,
    };
  }
}
