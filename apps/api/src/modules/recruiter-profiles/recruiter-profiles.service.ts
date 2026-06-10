import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AuthUser } from "@aurahire/shared";
import type { Profile, RecruiterProfile, Company } from "@aurahire/db";

import { AuditService } from "../../audit";
import { ProfilesRepository } from "../profiles/profiles.repository";

import type { UpdateRecruiterAboutDto } from "./dto/about.dto";
import type { UpdateRecruiterCompanyDto } from "./dto/company.dto";
import type { UpdateRecruiterFocusDto } from "./dto/focus.dto";
import type { RecruiterProfileMeDto } from "./dto/recruiter-profile-response.dto";

@Injectable()
export class RecruiterProfilesService {
  constructor(
    private readonly repo: ProfilesRepository,
    private readonly audit: AuditService,
  ) {}

  async getMe(user: AuthUser): Promise<RecruiterProfileMeDto> {
    this.assertRecruiter(user);

    // Profile + recruiter_profile have no dependency between them - parallel.
    // Company depends on profile.lastActiveCompanyId (Phase 2b: replaces the
    // dropped recruiter_profiles.company_id column), so it follows.
    const [profile, recruiterProfile] = await Promise.all([
      this.repo.findById(user.id),
      this.repo.findRecruiterProfile(user.id),
    ]);
    if (!profile) {
      throw new NotFoundException({
        code: "PROFILE_NOT_FOUND",
        message: "Profile missing",
      });
    }
    if (!recruiterProfile) {
      throw new NotFoundException({
        code: "RECRUITER_PROFILE_NOT_FOUND",
        message: "Recruiter profile missing - re-register",
      });
    }

    const activeCompanyId = profile.lastActiveCompanyId;
    if (!activeCompanyId) {
      throw new NotFoundException({
        code: "NO_ACTIVE_COMPANY",
        message: "No active company set",
      });
    }
    const company = await this.repo.findCompanyById(activeCompanyId);
    if (!company) {
      throw new NotFoundException({
        code: "COMPANY_NOT_FOUND",
        message: "Company missing",
      });
    }

    return this.toResponse(profile, recruiterProfile, company);
  }

  async updateAbout(
    user: AuthUser,
    dto: UpdateRecruiterAboutDto,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<RecruiterProfileMeDto> {
    this.assertRecruiter(user);

    const { profile, recruiterProfile } =
      await this.repo.updateProfileAndRecruiterProfileTx(
        user.id,
        { fullName: dto.fullName, phone: dto.phone },
        { jobTitle: dto.jobTitle ?? null, department: dto.department ?? null },
      );

    const activeCompanyId = profile.lastActiveCompanyId;
    if (!activeCompanyId) {
      throw new NotFoundException({
        code: "NO_ACTIVE_COMPANY",
        message: "No active company set",
      });
    }
    const company = await this.repo.findCompanyById(activeCompanyId);
    if (!company) {
      throw new NotFoundException({
        code: "COMPANY_NOT_FOUND",
        message: "Company missing",
      });
    }

    void this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "user.onboarding.about_updated",
      entityType: "recruiter_profile",
      entityId: user.id,
      ...requestMeta,
    });

    return this.toResponse(profile, recruiterProfile, company);
  }

  async updateCompany(
    user: AuthUser,
    dto: UpdateRecruiterCompanyDto,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<RecruiterProfileMeDto> {
    this.assertRecruiter(user);

    // Phase 2b: the recruiter→company link moved to profile.lastActiveCompanyId.
    // Profile fetch and recruiter_profile fetch can still run in parallel; the
    // company UPDATE depends on the profile's active-company pointer.
    const [profile, recruiterProfile] = await Promise.all([
      this.repo.findById(user.id),
      this.repo.findRecruiterProfile(user.id),
    ]);
    if (!profile) {
      throw new NotFoundException({
        code: "PROFILE_NOT_FOUND",
        message: "Profile missing",
      });
    }
    if (!recruiterProfile) {
      throw new NotFoundException({
        code: "RECRUITER_PROFILE_NOT_FOUND",
        message: "Recruiter profile missing",
      });
    }
    const activeCompanyId = profile.lastActiveCompanyId;
    if (!activeCompanyId) {
      throw new NotFoundException({
        code: "NO_ACTIVE_COMPANY",
        message: "No active company set",
      });
    }

    const company = await this.repo.updateCompany(activeCompanyId, {
      name: dto.companyName,
      industry: dto.industry ?? null,
      size: dto.size ?? null,
      website: dto.website ?? null,
      headquartersLocation: dto.headquartersLocation ?? null,
      description: dto.description ?? null,
    });

    void this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "user.onboarding.company_updated",
      entityType: "company",
      entityId: activeCompanyId,
      companyId: activeCompanyId,
      ...requestMeta,
    });

    return this.toResponse(profile, recruiterProfile, company);
  }

  async updateFocus(
    user: AuthUser,
    dto: UpdateRecruiterFocusDto,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<RecruiterProfileMeDto> {
    this.assertRecruiter(user);

    // Profile fetch + recruiter_profile UPDATE in parallel; company SELECT
    // depends on the recruiter_profile.companyId returned by the update.
    const [profile, recruiterProfile] = await Promise.all([
      this.repo.findById(user.id),
      this.repo.updateRecruiterProfile(user.id, {
        rolesHiringFor: dto.rolesHiringFor,
        hiringVolumePerQuarter: dto.hiringVolumePerQuarter ?? null,
        profileCompleted: true,
      }),
    ]);
    if (!profile) {
      throw new NotFoundException({
        code: "PROFILE_NOT_FOUND",
        message: "Profile missing",
      });
    }

    const activeCompanyId = profile.lastActiveCompanyId;
    if (!activeCompanyId) {
      throw new NotFoundException({
        code: "NO_ACTIVE_COMPANY",
        message: "No active company set",
      });
    }
    const company = await this.repo.findCompanyById(activeCompanyId);
    if (!company) {
      throw new NotFoundException({
        code: "COMPANY_NOT_FOUND",
        message: "Company missing",
      });
    }

    void this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "user.onboarding.completed",
      entityType: "recruiter_profile",
      entityId: user.id,
      companyId: activeCompanyId,
      details: { role: "recruiter" },
      ...requestMeta,
    });

    return this.toResponse(profile, recruiterProfile, company);
  }

  private assertRecruiter(user: AuthUser): void {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }
  }

  private toResponse(
    profile: Profile,
    recruiterProfile: RecruiterProfile,
    company: Company,
  ): RecruiterProfileMeDto {
    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      phone: profile.phone,
      jobTitle: recruiterProfile.jobTitle,
      department: recruiterProfile.department,
      rolesHiringFor: recruiterProfile.rolesHiringFor,
      hiringVolumePerQuarter: recruiterProfile.hiringVolumePerQuarter,
      profileCompleted: recruiterProfile.profileCompleted,
      company: {
        id: company.id,
        name: company.name,
        industry: company.industry,
        size: company.size,
        website: company.website,
        headquartersLocation: company.headquartersLocation,
        description: company.description,
      },
    };
  }
}
