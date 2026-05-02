import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthUser } from "@aurahire/shared";
import type {
  Profile,
  CandidateProfile,
  RecruiterProfile,
  Company,
} from "@aurahire/db";

import { AuditService, AUDIT_ACTIONS } from "../../audit";
import { isUniqueViolation } from "../../common/db/pg-error";
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
      const company = recruiterProfile
        ? await this.repo.findCompanyById(recruiterProfile.companyId)
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
      candidateProfile: null,
      recruiterProfile: recruiterProfile
        ? {
            companyId: recruiterProfile.companyId,
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
      candidateProfile: null,
      recruiterProfile: null,
      company: null,
    };
  }
}
