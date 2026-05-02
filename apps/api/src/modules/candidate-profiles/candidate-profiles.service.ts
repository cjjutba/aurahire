import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthUser } from "@aurahire/shared";
import type { Profile, CandidateProfile } from "@aurahire/db";

import { AuditService } from "../../audit";
import { ProfilesRepository } from "../profiles/profiles.repository";

import type { UpdateCandidatePersonalDto } from "./dto/personal.dto";
import type { UpdateCandidatePreferencesDto } from "./dto/preferences.dto";
import type { CandidateProfileMeDto } from "./dto/candidate-profile-response.dto";

@Injectable()
export class CandidateProfilesService {
  constructor(
    private readonly repo: ProfilesRepository,
    private readonly audit: AuditService,
  ) {}

  async getMe(user: AuthUser): Promise<CandidateProfileMeDto> {
    this.assertCandidate(user);

    const [profile, candidateProfile] = await Promise.all([
      this.repo.findById(user.id),
      this.repo.findCandidateProfile(user.id),
    ]);
    if (!profile) {
      throw new NotFoundException({ code: "PROFILE_NOT_FOUND", message: "Profile missing" });
    }
    if (!candidateProfile) {
      throw new NotFoundException({
        code: "CANDIDATE_PROFILE_NOT_FOUND",
        message: "Candidate profile missing — re-register",
      });
    }

    return this.toResponse(profile, candidateProfile);
  }

  async updatePersonal(
    user: AuthUser,
    dto: UpdateCandidatePersonalDto,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<CandidateProfileMeDto> {
    this.assertCandidate(user);

    const { profile, candidateProfile } = await this.repo.updateProfileAndCandidateProfileTx(
      user.id,
      { fullName: dto.fullName, phone: dto.phone },
      {
        headline: dto.headline ?? null,
        summary: dto.summary ?? null,
        locationCity: dto.locationCity ?? null,
        locationRegion: dto.locationRegion ?? null,
        locationCountry: dto.locationCountry ?? null,
      },
    );

    void this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "user.onboarding.personal_updated",
      entityType: "candidate_profile",
      entityId: user.id,
      ...requestMeta,
    });

    return this.toResponse(profile, candidateProfile);
  }

  async updatePreferences(
    user: AuthUser,
    dto: UpdateCandidatePreferencesDto,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<CandidateProfileMeDto> {
    this.assertCandidate(user);

    // Profile row isn't being mutated here, so the SELECT can run in parallel
    // with the candidate_profiles UPDATE.
    const [profile, candidateProfile] = await Promise.all([
      this.repo.findById(user.id),
      this.repo.updateCandidateProfile(user.id, {
        desiredRoles: dto.desiredRoles,
        desiredSeniority: dto.desiredSeniority ?? null,
        openTo: dto.openTo,
        desiredSalaryMin: dto.desiredSalaryMin != null ? String(dto.desiredSalaryMin) : null,
        desiredSalaryMax: dto.desiredSalaryMax != null ? String(dto.desiredSalaryMax) : null,
        desiredCurrency: dto.desiredCurrency,
        availableStartDate: dto.availableStartDate ?? null,
      }),
    ]);
    if (!profile) {
      throw new NotFoundException({ code: "PROFILE_NOT_FOUND", message: "Profile missing" });
    }

    void this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "user.onboarding.preferences_updated",
      entityType: "candidate_profile",
      entityId: user.id,
      ...requestMeta,
    });

    return this.toResponse(profile, candidateProfile);
  }

  async complete(
    user: AuthUser,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<CandidateProfileMeDto> {
    this.assertCandidate(user);

    const [profile, candidateProfile] = await Promise.all([
      this.repo.findById(user.id),
      this.repo.updateCandidateProfile(user.id, { profileCompleted: true }),
    ]);
    if (!profile) {
      throw new NotFoundException({ code: "PROFILE_NOT_FOUND", message: "Profile missing" });
    }

    void this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "user.onboarding.completed",
      entityType: "candidate_profile",
      entityId: user.id,
      details: { role: "candidate" },
      ...requestMeta,
    });

    return this.toResponse(profile, candidateProfile);
  }

  private assertCandidate(user: AuthUser): void {
    if (user.role !== "candidate") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Candidate role required" });
    }
  }

  private toResponse(profile: Profile, candidateProfile: CandidateProfile): CandidateProfileMeDto {
    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      phone: profile.phone,
      headline: candidateProfile.headline,
      summary: candidateProfile.summary,
      locationCity: candidateProfile.locationCity,
      locationRegion: candidateProfile.locationRegion,
      locationCountry: candidateProfile.locationCountry,
      desiredRoles: candidateProfile.desiredRoles,
      desiredSeniority: candidateProfile.desiredSeniority,
      openTo: candidateProfile.openTo,
      desiredSalaryMin: candidateProfile.desiredSalaryMin
        ? Number(candidateProfile.desiredSalaryMin)
        : null,
      desiredSalaryMax: candidateProfile.desiredSalaryMax
        ? Number(candidateProfile.desiredSalaryMax)
        : null,
      desiredCurrency: candidateProfile.desiredCurrency ?? "USD",
      availableStartDate: candidateProfile.availableStartDate
        ? candidateProfile.availableStartDate.toString()
        : null,
      profileCompleted: candidateProfile.profileCompleted,
    };
  }
}
