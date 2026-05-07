import type { AuthUser } from "@aurahire/shared";
import type { CandidateProfile, Profile, Resume } from "@aurahire/db";

import { CandidateProfilesService } from "./candidate-profiles.service";
import type { ProfilesRepository } from "../profiles/profiles.repository";
import type { ResumesRepository } from "../resumes/resumes.repository";
import type { AuditService } from "../../audit";

const candidateUser: AuthUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "candidate@example.com",
  role: "candidate",
  status: "active",
  fullName: "Test Candidate",
  profileCompleted: false,
};

function buildProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: candidateUser.id,
    role: "candidate",
    fullName: "Test Candidate",
    email: "candidate@example.com",
    phone: null,
    avatarUrl: null,
    status: "active",
    lastLoginAt: null,
    lastActiveCompanyId: null,
    createdAt: new Date("2026-05-05T00:00:00Z"),
    updatedAt: new Date("2026-05-05T00:00:00Z"),
    ...overrides,
  };
}

function buildCandidateProfile(
  overrides: Partial<CandidateProfile> = {},
): CandidateProfile {
  return {
    id: candidateUser.id,
    headline: null,
    summary: null,
    locationCity: null,
    locationRegion: null,
    locationCountry: null,
    desiredRoles: ["Software Engineer"],
    desiredSeniority: null,
    openTo: ["remote"],
    desiredSalaryMin: null,
    desiredSalaryMax: null,
    desiredCurrency: "USD",
    availableStartDate: null,
    defaultResumeId: null,
    profileCompleted: false,
    createdAt: new Date("2026-05-05T00:00:00Z"),
    updatedAt: new Date("2026-05-05T00:00:00Z"),
    ...overrides,
  };
}

function buildResume(parsedData: unknown): Resume {
  return {
    id: "33333333-3333-3333-3333-333333333333",
    candidateId: candidateUser.id,
    filename: "resume.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    storagePath: `${candidateUser.id}/resume.pdf`,
    canonicalPdfPath: null,
    rawText: "raw resume text",
    parsedData: parsedData as Record<string, unknown> | null,
    parseStatus: "parsed",
    parseError: null,
    isDefault: true,
    createdAt: new Date("2026-05-05T00:00:00Z"),
    updatedAt: new Date("2026-05-05T00:00:00Z"),
  };
}

function buildSvc(opts: {
  profile: Profile | null;
  candidateProfile: CandidateProfile | null;
  defaultResume: Resume | null;
}) {
  const profilesRepo = {
    findById: jest.fn().mockResolvedValue(opts.profile),
    findCandidateProfile: jest.fn().mockResolvedValue(opts.candidateProfile),
    updateCandidateProfile: jest.fn(
      async (_id: string, patch: Partial<CandidateProfile>) => {
        return {
          ...(opts.candidateProfile ?? buildCandidateProfile()),
          ...patch,
          updatedAt: new Date(),
        };
      },
    ),
  } as unknown as jest.Mocked<ProfilesRepository>;

  const resumesRepo = {
    findDefaultByCandidateId: jest.fn().mockResolvedValue(opts.defaultResume),
  } as unknown as jest.Mocked<ResumesRepository>;

  const audit = {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;

  const svc = new CandidateProfilesService(profilesRepo, audit, resumesRepo);
  return { svc, profilesRepo, resumesRepo, audit };
}

describe("CandidateProfilesService.completeOnboarding", () => {
  const validParsedResume = {
    contact: {},
    summary: null,
    education: [],
    experience: [
      {
        company: "Acme",
        company_source: "Acme Corp",
        title: "Engineer",
        title_source: "Software Engineer",
        start_date: null,
        end_date: null,
        period_source: "2020 — Present",
        is_current: true,
        responsibilities: [],
        responsibilities_source: [],
        technologies_used: [],
      },
    ],
    skills: [],
    certifications: [],
    languages: [],
    parse_confidence: "high",
  };

  it("sets profileCompleted=true and writes audit log when valid", async () => {
    const { svc, profilesRepo, audit } = buildSvc({
      profile: buildProfile({ fullName: "Jane Doe" }),
      candidateProfile: buildCandidateProfile({
        desiredRoles: ["Software Engineer"],
        openTo: ["remote"],
      }),
      defaultResume: buildResume(validParsedResume),
    });

    const result = await svc.completeOnboarding(candidateUser, {
      ipAddress: "127.0.0.1",
      userAgent: "jest",
    });

    expect(profilesRepo.updateCandidateProfile).toHaveBeenCalledWith(
      candidateUser.id,
      { profileCompleted: true },
    );
    expect(audit.log).toHaveBeenCalledTimes(1);
    const auditArgs = (audit.log as jest.Mock).mock.calls[0][0];
    expect(auditArgs.action).toBe("user.onboarding.completed");
    expect(auditArgs.entityType).toBe("candidate_profile");
    expect(auditArgs.entityId).toBe(candidateUser.id);
    expect(auditArgs.actorId).toBe(candidateUser.id);
    expect(auditArgs.actorType).toBe("user");

    expect(result.profileCompleted).toBe(true);
    expect(result.id).toBe(candidateUser.id);
  });

  it("rejects with INCOMPLETE_PERSONAL when fullName empty", async () => {
    const { svc, profilesRepo, audit } = buildSvc({
      profile: buildProfile({ fullName: "" }),
      candidateProfile: buildCandidateProfile(),
      defaultResume: buildResume(validParsedResume),
    });

    await expect(svc.completeOnboarding(candidateUser)).rejects.toMatchObject({
      response: expect.objectContaining({ code: "INCOMPLETE_PERSONAL" }),
    });
    expect(profilesRepo.updateCandidateProfile).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it("rejects with INCOMPLETE_REVIEW when no experience, education, or 3 skills", async () => {
    const { svc, profilesRepo, audit } = buildSvc({
      profile: buildProfile({ fullName: "Jane Doe" }),
      candidateProfile: buildCandidateProfile(),
      defaultResume: buildResume({
        contact: {},
        summary: null,
        education: [],
        experience: [],
        skills: [
          { name: "TypeScript", source: "TypeScript" },
          { name: "React", source: "React" },
        ],
        certifications: [],
        languages: [],
        parse_confidence: "high",
      }),
    });

    await expect(svc.completeOnboarding(candidateUser)).rejects.toMatchObject({
      response: expect.objectContaining({ code: "INCOMPLETE_REVIEW" }),
    });
    expect(profilesRepo.updateCandidateProfile).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it("rejects with INCOMPLETE_PREFERENCES when desiredRoles empty", async () => {
    const { svc, profilesRepo, audit } = buildSvc({
      profile: buildProfile({ fullName: "Jane Doe" }),
      candidateProfile: buildCandidateProfile({
        desiredRoles: [],
        openTo: ["remote"],
      }),
      defaultResume: buildResume(validParsedResume),
    });

    await expect(svc.completeOnboarding(candidateUser)).rejects.toMatchObject({
      response: expect.objectContaining({ code: "INCOMPLETE_PREFERENCES" }),
    });
    expect(profilesRepo.updateCandidateProfile).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
