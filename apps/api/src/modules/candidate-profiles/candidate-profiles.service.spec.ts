import type { AuthUser } from "@aurahire/shared";
import type { CandidateProfile, Profile, Resume } from "@aurahire/db";

import { CandidateProfilesService } from "./candidate-profiles.service";
import type { ProfilesRepository } from "../profiles/profiles.repository";
import type { ResumesRepository } from "../resumes/resumes.repository";
import type { AuditService } from "../../audit";
import type { MatchPreviewQueueService } from "../../queue/match-preview-queue.service";
import type { ProfileScoreQueueService } from "../../queue/profile-score-queue.service";
import type { ScoringRepository } from "../scoring/scoring.repository";
import type { ScoringService } from "../scoring/scoring.service";
import type { ProfileScoreDto } from "../scoring/dto/profile-score-response.dto";
import type { DrizzleClient } from "../../db/db.module";

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
    clerkUserId: null,
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
  /**
   * Optional precompute job id stub - defaults to a deterministic value so
   * happy-path tests can assert on it. Pass `null` to simulate enqueue
   * failure (BullMQ swallows the error and returns null).
   */
  precomputeJobId?: string | null;
  /**
   * Optional ScoringService.computeProfileScore stub. Defaults to a
   * resolved valid DTO so the happy path doesn't have to wire it. Pass
   * `() => Promise.reject(...)` to exercise the AI-failure branch.
   */
  computeProfileScore?: jest.Mock;
  /**
   * Optional ScoringRepository.hasCurrentProfileScore stub for the
   * backfill-guard tests. Defaults to `false` so most tests behave as
   * if the candidate has no current score row - closer to the
   * proactive-system happy path.
   */
  hasCurrentProfileScore?: jest.Mock;
}) {
  // Track profile_scores stale_at writes triggered through the db client.
  const profileScoresStaleCalls: Array<{ staleAt: Date }> = [];

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
    updateProfileAndCandidateProfileTx: jest.fn(
      async (
        _id: string,
        profilePatch: Partial<Profile>,
        candidatePatch: Partial<CandidateProfile>,
      ) => {
        return {
          profile: {
            ...(opts.profile ?? buildProfile()),
            ...profilePatch,
            updatedAt: new Date(),
          },
          candidateProfile: {
            ...(opts.candidateProfile ?? buildCandidateProfile()),
            ...candidatePatch,
            updatedAt: new Date(),
          },
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

  const profileScoreQueue = {
    enqueueRecompute: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<ProfileScoreQueueService>;

  const matchPreviewQueue = {
    enqueuePrecompute: jest
      .fn()
      .mockResolvedValue(opts.precomputeJobId ?? "precompute:job:1"),
  } as unknown as jest.Mocked<MatchPreviewQueueService>;

  // ScoringService stub. Default: resolve a valid Profile Score DTO so the
  // happy-path complete-onboarding test gets a non-null score back.
  const defaultProfileScoreDto: ProfileScoreDto = {
    id: "score-1",
    overallScore: 78,
    band: "strong",
    components: [],
    improvementSuggestions: [],
    redactedFields: [],
    promptVersion: "v1",
    modelUsed: "gpt-4o-mini",
    latencyMs: 1234,
    createdAt: "2026-05-08T00:00:00.000Z",
    calibrationWarnings: [],
  };
  const scoring = {
    computeProfileScore:
      opts.computeProfileScore ??
      jest.fn().mockResolvedValue(defaultProfileScoreDto),
  } as unknown as jest.Mocked<ScoringService>;

  const scoringRepo = {
    hasCurrentProfileScore:
      opts.hasCurrentProfileScore ?? jest.fn().mockResolvedValue(false),
  } as unknown as jest.Mocked<ScoringRepository>;

  // Drizzle stub: chainable update().set().where(); records stale_at writes.
  const db = {
    update: jest.fn(() => ({
      set: jest.fn((patch: { staleAt: Date }) => {
        profileScoresStaleCalls.push(patch);
        return { where: jest.fn().mockResolvedValue(undefined) };
      }),
    })),
  } as unknown as jest.Mocked<DrizzleClient>;

  const svc = new CandidateProfilesService(
    profilesRepo,
    audit,
    resumesRepo,
    profileScoreQueue,
    matchPreviewQueue,
    scoring,
    scoringRepo,
    db,
  );
  return {
    svc,
    profilesRepo,
    resumesRepo,
    audit,
    profileScoreQueue,
    matchPreviewQueue,
    scoring,
    scoringRepo,
    db,
    profileScoresStaleCalls,
    defaultProfileScoreDto,
  };
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
        period_source: "2020 - Present",
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
    expect(result.profile.id).toBe(candidateUser.id);
    expect(result.profile.profileCompleted).toBe(true);
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

describe("CandidateProfilesService.completeOnboarding (extended response)", () => {
  // Mirrors the validParsedResume in the parent describe - kept local so the
  // happy-path / AI-failure / missing-resume tests can stay self-contained.
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
        period_source: "2020 - Present",
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

  it("returns extended response with profileScore + precomputeJobId on happy path", async () => {
    const fakeScore: ProfileScoreDto = {
      id: "score-99",
      overallScore: 78,
      band: "strong",
      components: [],
      improvementSuggestions: [],
      redactedFields: [],
      promptVersion: "v1",
      modelUsed: "gpt-4o-mini",
      latencyMs: 1500,
      createdAt: "2026-05-08T12:00:00.000Z",
      calibrationWarnings: [],
    };
    const computeProfileScore = jest.fn().mockResolvedValue(fakeScore);

    const { svc, profilesRepo, matchPreviewQueue, profileScoreQueue, scoring } =
      buildSvc({
        profile: buildProfile({ fullName: "Jane Doe" }),
        candidateProfile: buildCandidateProfile({
          desiredRoles: ["Software Engineer"],
          openTo: ["remote"],
        }),
        defaultResume: buildResume(validParsedResume),
        precomputeJobId: "precompute:job:happy",
        computeProfileScore,
      });

    const result = await svc.completeOnboarding(candidateUser);

    expect(result.profileCompleted).toBe(true);
    expect(result.profileScore).toEqual(fakeScore);
    expect(result.precomputeJobId).toBe("precompute:job:happy");
    expect(result.errors).toBeUndefined();

    // profile flipped before AI call
    expect(profilesRepo.updateCandidateProfile).toHaveBeenCalledWith(
      candidateUser.id,
      { profileCompleted: true },
    );

    // AI compute called with the right candidate + resume + reason
    expect(scoring.computeProfileScore).toHaveBeenCalledWith(
      candidateUser.id,
      "33333333-3333-3333-3333-333333333333",
      expect.objectContaining({ reason: "onboarding" }),
    );

    // match-preview precompute kicked off
    expect(matchPreviewQueue.enqueuePrecompute).toHaveBeenCalledWith({
      candidateId: candidateUser.id,
      resumeId: "33333333-3333-3333-3333-333333333333",
    });

    // happy path: no recompute fallback enqueued
    expect(profileScoreQueue.enqueueRecompute).not.toHaveBeenCalled();
  });

  it("on AI failure: returns 200 with profileScore=null and errors.profileScore='transient'", async () => {
    const computeProfileScore = jest
      .fn()
      .mockRejectedValueOnce(new Error("simulated AI failure"));

    const { svc, profilesRepo, matchPreviewQueue, profileScoreQueue } =
      buildSvc({
        profile: buildProfile({ fullName: "Jane Doe" }),
        candidateProfile: buildCandidateProfile({
          desiredRoles: ["Software Engineer"],
          openTo: ["remote"],
        }),
        defaultResume: buildResume(validParsedResume),
        precomputeJobId: "precompute:job:transient",
        computeProfileScore,
      });

    const result = await svc.completeOnboarding(candidateUser);

    // Profile still flipped - candidate is NOT trapped by an AI failure.
    expect(profilesRepo.updateCandidateProfile).toHaveBeenCalledWith(
      candidateUser.id,
      { profileCompleted: true },
    );
    expect(result.profileCompleted).toBe(true);

    // No score, transient error, precompute still fired.
    expect(result.profileScore).toBeNull();
    expect(result.errors?.profileScore).toBe("transient");
    expect(result.precomputeJobId).toBe("precompute:job:transient");
    expect(matchPreviewQueue.enqueuePrecompute).toHaveBeenCalledTimes(1);

    // Retry job enqueued so a fresh score lands once the worker retries.
    expect(profileScoreQueue.enqueueRecompute).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId: candidateUser.id,
        resumeId: "33333333-3333-3333-3333-333333333333",
        reason: "onboarding",
      }),
    );
  });

  it("rejects with INCOMPLETE_REVIEW when default resume is missing (review-step gate fires before missing_resume branch)", async () => {
    // The `missing_resume` branch in completeOnboarding is defense-in-depth
    // for the AI-gate stage. In normal flow the review-step gate runs first
    // and rejects with INCOMPLETE_REVIEW because zero parsed counts can't
    // satisfy `experience>=1 || education>=1 || skills>=3`. This test
    // documents that ordering - a candidate without a default resume hits
    // the review error first, never reaches the AI step, and never marks
    // `profile_completed`. Frontend validation on the resume-upload step
    // makes this scenario unreachable in practice.
    const computeProfileScore = jest.fn();
    const { svc, matchPreviewQueue, profileScoreQueue, profilesRepo, audit } =
      buildSvc({
        profile: buildProfile({ fullName: "Jane Doe" }),
        candidateProfile: buildCandidateProfile({
          desiredRoles: ["Software Engineer"],
          openTo: ["remote"],
        }),
        defaultResume: null,
        computeProfileScore,
      });

    await expect(svc.completeOnboarding(candidateUser)).rejects.toMatchObject({
      response: expect.objectContaining({ code: "INCOMPLETE_REVIEW" }),
    });

    // Profile must NOT be flipped, no audit, no AI call, no queue side-effects.
    expect(profilesRepo.updateCandidateProfile).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
    expect(computeProfileScore).not.toHaveBeenCalled();
    expect(matchPreviewQueue.enqueuePrecompute).not.toHaveBeenCalled();
    expect(profileScoreQueue.enqueueRecompute).not.toHaveBeenCalled();
  });
});

describe("CandidateProfilesService - recompute on edit", () => {
  const RESUME_ID = "33333333-3333-3333-3333-333333333333";

  function buildDefaultResume(): Resume {
    return {
      id: RESUME_ID,
      candidateId: candidateUser.id,
      filename: "resume.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      storagePath: `${candidateUser.id}/resume.pdf`,
      canonicalPdfPath: null,
      rawText: "raw resume text",
      parsedData: null,
      parseStatus: "parsed",
      parseError: null,
      isDefault: true,
      createdAt: new Date("2026-05-05T00:00:00Z"),
      updatedAt: new Date("2026-05-05T00:00:00Z"),
    };
  }

  it("updatePersonal: marks profile_scores stale and enqueues recompute with reason='profile_change'", async () => {
    const { svc, resumesRepo, profileScoreQueue, db, profileScoresStaleCalls } =
      buildSvc({
        profile: buildProfile({ fullName: "Jane Doe" }),
        candidateProfile: buildCandidateProfile(),
        defaultResume: buildDefaultResume(),
      });

    await svc.updatePersonal(candidateUser, {
      fullName: "Jane Doe",
      phone: "+1 555 123 4567",
      headline: "Senior Engineer",
      summary: null,
      locationCity: null,
      locationRegion: null,
      locationCountry: null,
    });

    // Default resume looked up so we know what to score.
    expect(resumesRepo.findDefaultByCandidateId).toHaveBeenCalledWith(
      candidateUser.id,
    );

    // profile_scores marked stale via the drizzle client.
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(profileScoresStaleCalls).toHaveLength(1);
    expect(profileScoresStaleCalls[0]?.staleAt).toBeInstanceOf(Date);

    // Recompute job enqueued with the right reason.
    expect(profileScoreQueue.enqueueRecompute).toHaveBeenCalledTimes(1);
    expect(profileScoreQueue.enqueueRecompute).toHaveBeenCalledWith({
      candidateId: candidateUser.id,
      resumeId: RESUME_ID,
      reason: "profile_change",
    });
  });

  it("updatePreferences: marks profile_scores stale and enqueues recompute with reason='preferences_change'", async () => {
    const { svc, resumesRepo, profileScoreQueue, db, profileScoresStaleCalls } =
      buildSvc({
        profile: buildProfile({ fullName: "Jane Doe" }),
        candidateProfile: buildCandidateProfile(),
        defaultResume: buildDefaultResume(),
      });

    await svc.updatePreferences(candidateUser, {
      desiredRoles: ["Senior Engineer"],
      desiredSeniority: null,
      openTo: ["remote"],
      desiredSalaryMin: null,
      desiredSalaryMax: null,
      desiredCurrency: "USD",
      availableStartDate: null,
    });

    expect(resumesRepo.findDefaultByCandidateId).toHaveBeenCalledWith(
      candidateUser.id,
    );
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(profileScoresStaleCalls).toHaveLength(1);

    expect(profileScoreQueue.enqueueRecompute).toHaveBeenCalledTimes(1);
    expect(profileScoreQueue.enqueueRecompute).toHaveBeenCalledWith({
      candidateId: candidateUser.id,
      resumeId: RESUME_ID,
      reason: "preferences_change",
    });
  });

  it("updatePersonal: skips stale + enqueue when candidate has no default resume", async () => {
    const { svc, profileScoreQueue, db, profileScoresStaleCalls } = buildSvc({
      profile: buildProfile({ fullName: "Jane Doe" }),
      candidateProfile: buildCandidateProfile(),
      defaultResume: null,
    });

    await svc.updatePersonal(candidateUser, {
      fullName: "Jane Doe",
      phone: "+1 555 123 4567",
      headline: "Senior Engineer",
      summary: null,
      locationCity: null,
      locationRegion: null,
      locationCountry: null,
    });

    // Nothing to score → nothing to mark stale, nothing to enqueue.
    expect(db.update).not.toHaveBeenCalled();
    expect(profileScoresStaleCalls).toHaveLength(0);
    expect(profileScoreQueue.enqueueRecompute).not.toHaveBeenCalled();
  });

  it("updatePreferences: skips stale + enqueue when candidate has no default resume", async () => {
    const { svc, profileScoreQueue, db, profileScoresStaleCalls } = buildSvc({
      profile: buildProfile({ fullName: "Jane Doe" }),
      candidateProfile: buildCandidateProfile(),
      defaultResume: null,
    });

    await svc.updatePreferences(candidateUser, {
      desiredRoles: ["Senior Engineer"],
      desiredSeniority: null,
      openTo: ["remote"],
      desiredSalaryMin: null,
      desiredSalaryMax: null,
      desiredCurrency: "USD",
      availableStartDate: null,
    });

    expect(db.update).not.toHaveBeenCalled();
    expect(profileScoresStaleCalls).toHaveLength(0);
    expect(profileScoreQueue.enqueueRecompute).not.toHaveBeenCalled();
  });
});

describe("CandidateProfilesService.enqueueProfileScoreIfMissing", () => {
  const RESUME_ID = "33333333-3333-3333-3333-333333333333";

  function buildDefaultResume(): Resume {
    return {
      id: RESUME_ID,
      candidateId: candidateUser.id,
      filename: "resume.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      storagePath: `${candidateUser.id}/resume.pdf`,
      canonicalPdfPath: null,
      rawText: "raw resume text",
      parsedData: null,
      parseStatus: "parsed",
      parseError: null,
      isDefault: true,
      createdAt: new Date("2026-05-05T00:00:00Z"),
      updatedAt: new Date("2026-05-05T00:00:00Z"),
    };
  }

  it("enqueues backfill job when no current profile score exists and a default resume is present", async () => {
    const { svc, profileScoreQueue, scoringRepo, resumesRepo } = buildSvc({
      profile: buildProfile({ fullName: "Jane Doe" }),
      candidateProfile: buildCandidateProfile(),
      defaultResume: buildDefaultResume(),
      hasCurrentProfileScore: jest.fn().mockResolvedValue(false),
    });

    await svc.enqueueProfileScoreIfMissing(candidateUser.id);

    expect(scoringRepo.hasCurrentProfileScore).toHaveBeenCalledWith(
      candidateUser.id,
    );
    expect(resumesRepo.findDefaultByCandidateId).toHaveBeenCalledWith(
      candidateUser.id,
    );

    expect(profileScoreQueue.enqueueRecompute).toHaveBeenCalledTimes(1);
    expect(profileScoreQueue.enqueueRecompute).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId: candidateUser.id,
        resumeId: RESUME_ID,
        reason: "manual_recompute",
      }),
      expect.objectContaining({
        // jobId is the dedupe key - must include the candidate id so
        // backfills are scoped per-candidate.
        jobId: expect.stringContaining(candidateUser.id),
      }),
    );
  });

  it("no-op when a current (non-stale) profile score already exists", async () => {
    const { svc, profileScoreQueue, scoringRepo, resumesRepo } = buildSvc({
      profile: buildProfile({ fullName: "Jane Doe" }),
      candidateProfile: buildCandidateProfile(),
      defaultResume: buildDefaultResume(),
      hasCurrentProfileScore: jest.fn().mockResolvedValue(true),
    });

    await svc.enqueueProfileScoreIfMissing(candidateUser.id);

    expect(scoringRepo.hasCurrentProfileScore).toHaveBeenCalledWith(
      candidateUser.id,
    );
    // Short-circuited before the resume lookup - no enqueue at all.
    expect(resumesRepo.findDefaultByCandidateId).not.toHaveBeenCalled();
    expect(profileScoreQueue.enqueueRecompute).not.toHaveBeenCalled();
  });

  it("no-op when the candidate has no default resume to score against", async () => {
    const { svc, profileScoreQueue, scoringRepo, resumesRepo } = buildSvc({
      profile: buildProfile({ fullName: "Jane Doe" }),
      candidateProfile: buildCandidateProfile(),
      defaultResume: null,
      hasCurrentProfileScore: jest.fn().mockResolvedValue(false),
    });

    await svc.enqueueProfileScoreIfMissing(candidateUser.id);

    expect(scoringRepo.hasCurrentProfileScore).toHaveBeenCalledWith(
      candidateUser.id,
    );
    expect(resumesRepo.findDefaultByCandidateId).toHaveBeenCalledWith(
      candidateUser.id,
    );
    // Nothing to score → nothing to enqueue.
    expect(profileScoreQueue.enqueueRecompute).not.toHaveBeenCalled();
  });

  it("uses a stable jobId so repeat portal hits collapse into a single backfill", async () => {
    const { svc, profileScoreQueue } = buildSvc({
      profile: buildProfile({ fullName: "Jane Doe" }),
      candidateProfile: buildCandidateProfile(),
      defaultResume: buildDefaultResume(),
      hasCurrentProfileScore: jest.fn().mockResolvedValue(false),
    });

    await svc.enqueueProfileScoreIfMissing(candidateUser.id);
    await svc.enqueueProfileScoreIfMissing(candidateUser.id);

    // The service calls enqueueRecompute twice; idempotency lives inside
    // BullMQ via the jobId - assert both calls passed the SAME jobId so
    // BullMQ can dedupe them.
    expect(profileScoreQueue.enqueueRecompute).toHaveBeenCalledTimes(2);
    const firstJobId = (profileScoreQueue.enqueueRecompute as jest.Mock).mock
      .calls[0][1].jobId;
    const secondJobId = (profileScoreQueue.enqueueRecompute as jest.Mock).mock
      .calls[1][1].jobId;
    expect(firstJobId).toBe(secondJobId);
    expect(firstJobId).toContain(candidateUser.id);
    expect(firstJobId).toContain(RESUME_ID);
  });
});

describe("CandidateProfilesService.recordOnboardingSkipped", () => {
  it("writes an audit row with the skip telemetry payload and returns void", async () => {
    const { svc, audit } = buildSvc({
      profile: buildProfile({ fullName: "Jane Doe" }),
      candidateProfile: buildCandidateProfile(),
      defaultResume: null,
    });

    const requestMeta = { ipAddress: "127.0.0.1", userAgent: "jest" };

    const result = await svc.recordOnboardingSkipped(
      candidateUser,
      { scoreReady: true, previewsReady: 3 },
      requestMeta,
    );

    expect(result).toBeUndefined();
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith({
      actorId: candidateUser.id,
      actorType: "user",
      action: "user.onboarding.skipped_analyzing",
      entityType: "candidate_profile",
      entityId: candidateUser.id,
      details: { scoreReady: true, previewsReady: 3 },
      ipAddress: "127.0.0.1",
      userAgent: "jest",
    });
  });

  it("rejects non-candidate users", async () => {
    const { svc, audit } = buildSvc({
      profile: buildProfile({ fullName: "Jane Doe" }),
      candidateProfile: buildCandidateProfile(),
      defaultResume: null,
    });

    const recruiterUser: AuthUser = {
      id: "22222222-2222-2222-2222-222222222222",
      email: "recruiter@example.com",
      role: "recruiter",
      status: "active",
      fullName: "Test Recruiter",
      profileCompleted: true,
    };

    await expect(
      svc.recordOnboardingSkipped(
        recruiterUser,
        { scoreReady: true, previewsReady: 0 },
        {},
      ),
    ).rejects.toThrow();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
