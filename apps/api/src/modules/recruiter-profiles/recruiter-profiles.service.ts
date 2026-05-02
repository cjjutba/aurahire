import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthUser } from "@aurahire/shared";

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
    if (user.role !== "recruiter") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }

    const profile = await this.repo.findById(user.id);
    if (!profile)
      throw new NotFoundException({ code: "PROFILE_NOT_FOUND", message: "Profile missing" });

    const recruiterProfile = await this.repo.findRecruiterProfile(user.id);
    if (!recruiterProfile)
      throw new NotFoundException({
        code: "RECRUITER_PROFILE_NOT_FOUND",
        message: "Recruiter profile missing — re-register",
      });

    const company = await this.repo.findCompanyById(recruiterProfile.companyId);
    if (!company)
      throw new NotFoundException({ code: "COMPANY_NOT_FOUND", message: "Company missing" });

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

  async updateAbout(
    user: AuthUser,
    dto: UpdateRecruiterAboutDto,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<RecruiterProfileMeDto> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Recruiter role required" });
    }

    await this.repo.updateProfileAndRecruiterProfileTx(
      user.id,
      { fullName: dto.fullName, phone: dto.phone },
      { jobTitle: dto.jobTitle ?? null, department: dto.department ?? null },
    );

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "user.onboarding.about_updated",
      entityType: "recruiter_profile",
      entityId: user.id,
      ...requestMeta,
    });

    return this.getMe(user);
  }

  async updateCompany(
    user: AuthUser,
    dto: UpdateRecruiterCompanyDto,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<RecruiterProfileMeDto> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Recruiter role required" });
    }

    const recruiterProfile = await this.repo.findRecruiterProfile(user.id);
    if (!recruiterProfile)
      throw new NotFoundException({
        code: "RECRUITER_PROFILE_NOT_FOUND",
        message: "Recruiter profile missing",
      });

    await this.repo.updateCompany(recruiterProfile.companyId, {
      name: dto.companyName,
      industry: dto.industry ?? null,
      size: dto.size ?? null,
      website: dto.website ?? null,
      headquartersLocation: dto.headquartersLocation ?? null,
      description: dto.description ?? null,
    });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "user.onboarding.company_updated",
      entityType: "company",
      entityId: recruiterProfile.companyId,
      ...requestMeta,
    });

    return this.getMe(user);
  }

  async updateFocus(
    user: AuthUser,
    dto: UpdateRecruiterFocusDto,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<RecruiterProfileMeDto> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Recruiter role required" });
    }

    await this.repo.updateRecruiterProfile(user.id, {
      rolesHiringFor: dto.rolesHiringFor,
      hiringVolumePerQuarter: dto.hiringVolumePerQuarter ?? null,
      profileCompleted: true,
    });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "user.onboarding.completed",
      entityType: "recruiter_profile",
      entityId: user.id,
      details: { role: "recruiter" },
      ...requestMeta,
    });

    return this.getMe(user);
  }
}
