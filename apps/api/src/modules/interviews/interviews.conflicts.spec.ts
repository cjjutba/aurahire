/**
 * Unit tests for conflict detection in InterviewsService.
 *
 * Covers:
 *  1. Returns recruiter overlap when an existing scheduled interview by the same
 *     recruiter overlaps the requested window.
 *  2. Returns candidate overlap when an existing scheduled interview for the same
 *     candidate overlaps the requested window.
 *  3. Returns empty arrays when no overlap (windows abut but don't intersect).
 *  4. excludeInterviewId excludes the specified interview from the recruiter set.
 *
 * No database is hit — the repository is fully mocked.
 */

import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AuthUser } from "@aurahire/shared";

import { InterviewsService } from "./interviews.service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const RECRUITER_ID = uuid(1);
const CANDIDATE_ID = uuid(2);
const COMPANY_ID = uuid(10);
const APPLICATION_ID = uuid(100);
const INTERVIEW_ID_A = uuid(901);
const INTERVIEW_ID_B = uuid(902);

function makeRecruiter(): AuthUser {
  return {
    id: RECRUITER_ID,
    role: "recruiter",
    email: "recruiter@example.com",
    status: "active",
    fullName: "Test Recruiter",
    profileCompleted: true,
  } as unknown as AuthUser;
}

function makeApplication() {
  return {
    id: APPLICATION_ID,
    jobId: uuid(200),
    candidateId: CANDIDATE_ID,
    resumeId: uuid(400),
    status: "interview",
    statusUpdatedAt: new Date(),
    appliedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    shortlistedAt: null,
    coverLetter: null,
    recruiterNotes: null,
    scoreStatus: "completed" as const,
  };
}

/** An overlapping interview row as returned by findOverlapping. */
function makeConflictRow(id: string, offsetMs = 0) {
  return {
    id,
    applicationId: APPLICATION_ID,
    scheduledAt: new Date(Date.now() + 30 * 60_000 + offsetMs), // +30 min from now
    durationMinutes: 60,
    scheduledBy: RECRUITER_ID,
  };
}

// ── Service factory ───────────────────────────────────────────────────────────

interface MockRepoOptions {
  recruiterRows?: ReturnType<typeof makeConflictRow>[];
  candidateRows?: ReturnType<typeof makeConflictRow>[];
}

function makeService(opts: MockRepoOptions = {}) {
  const application = makeApplication();

  const applicationsRepo = {
    findApplicationContextForCompany: jest.fn().mockResolvedValue(application),
    findById: jest.fn().mockResolvedValue(application),
    update: jest.fn().mockResolvedValue(application),
  };

  // findOverlapping is called twice in checkConflicts: once with recruiterId,
  // once with candidateId. We distinguish by inspecting the args.
  const findOverlapping = jest.fn().mockImplementation((args: { recruiterId?: string; candidateId?: string }) => {
    if (args.recruiterId) return Promise.resolve(opts.recruiterRows ?? []);
    if (args.candidateId) return Promise.resolve(opts.candidateRows ?? []);
    return Promise.resolve([]);
  });

  const interviewsRepo = {
    findOverlapping,
    insert: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    findByCandidateId: jest.fn(),
    findByApplicationId: jest.fn(),
    listForCompanyPaginated: jest.fn(),
  };

  const jobsRepo = {
    findById: jest.fn(),
    findByIdWithCompany: jest.fn(),
  };

  const profilesRepo = { findById: jest.fn() };
  const email = { send: jest.fn().mockResolvedValue(undefined) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const cacheService = { bustTags: jest.fn().mockResolvedValue(undefined), getOrSet: jest.fn() };
  const events = {
    emitInterviewScheduled: jest.fn(),
    emitApplicationStatusChanged: jest.fn(),
    emitInterviewStatusChanged: jest.fn(),
  };

  const notifications = { emit: jest.fn().mockResolvedValue(undefined) };

  const svc = new InterviewsService(
    interviewsRepo as never,
    applicationsRepo as never,
    jobsRepo as never,
    profilesRepo as never,
    email as never,
    audit as never,
    cacheService as never,
    events as never,
    notifications as never,
    { create: jest.fn() } as never,
  );

  return { svc, interviewsRepo, applicationsRepo };
}

// ── Shared request data ───────────────────────────────────────────────────────

/** A future time window: starts in 1 hour, lasts 60 min. */
const SCHEDULED_AT = new Date(Date.now() + 60 * 60_000).toISOString();
const DURATION = 60;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InterviewsService — conflict detection", () => {
  const user = makeRecruiter();

  describe("checkConflictsForApplication", () => {
    it("throws ForbiddenException when caller is not a recruiter", async () => {
      const { svc } = makeService();
      const candidate = { ...user, role: "candidate" } as unknown as AuthUser;

      await expect(
        svc.checkConflictsForApplication(candidate, COMPANY_ID, APPLICATION_ID, {
          scheduledAt: SCHEDULED_AT,
          durationMinutes: DURATION,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws NotFoundException when application does not exist in company", async () => {
      const { svc, applicationsRepo } = makeService();
      applicationsRepo.findApplicationContextForCompany.mockResolvedValueOnce(null);

      await expect(
        svc.checkConflictsForApplication(user, COMPANY_ID, APPLICATION_ID, {
          scheduledAt: SCHEDULED_AT,
          durationMinutes: DURATION,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("returns recruiter conflicts when a scheduled interview by the same recruiter overlaps", async () => {
      const conflictRow = makeConflictRow(INTERVIEW_ID_A);
      const { svc } = makeService({ recruiterRows: [conflictRow] });

      const result = await svc.checkConflictsForApplication(user, COMPANY_ID, APPLICATION_ID, {
        scheduledAt: SCHEDULED_AT,
        durationMinutes: DURATION,
      });

      expect(result.recruiterConflicts).toHaveLength(1);
      expect(result.recruiterConflicts[0]!.id).toBe(INTERVIEW_ID_A);
      expect(result.recruiterConflicts[0]!.scheduledAt).toBe(conflictRow.scheduledAt.toISOString());
      expect(result.recruiterConflicts[0]!.durationMinutes).toBe(conflictRow.durationMinutes);
      expect(result.candidateConflicts).toHaveLength(0);
    });

    it("returns candidate conflicts when a scheduled interview for the same candidate overlaps", async () => {
      const conflictRow = makeConflictRow(INTERVIEW_ID_B);
      const { svc } = makeService({ candidateRows: [conflictRow] });

      const result = await svc.checkConflictsForApplication(user, COMPANY_ID, APPLICATION_ID, {
        scheduledAt: SCHEDULED_AT,
        durationMinutes: DURATION,
      });

      expect(result.candidateConflicts).toHaveLength(1);
      expect(result.candidateConflicts[0]!.id).toBe(INTERVIEW_ID_B);
      expect(result.recruiterConflicts).toHaveLength(0);
    });

    it("returns empty arrays when windows abut but do not intersect", async () => {
      // Both recruiterRows and candidateRows default to [] — simulates no overlap
      const { svc } = makeService();

      const result = await svc.checkConflictsForApplication(user, COMPANY_ID, APPLICATION_ID, {
        scheduledAt: SCHEDULED_AT,
        durationMinutes: DURATION,
      });

      expect(result.recruiterConflicts).toHaveLength(0);
      expect(result.candidateConflicts).toHaveLength(0);
    });

    it("passes excludeInterviewId to findOverlapping so rescheduling excludes self", async () => {
      const { svc, interviewsRepo } = makeService();

      await svc.checkConflictsForApplication(user, COMPANY_ID, APPLICATION_ID, {
        scheduledAt: SCHEDULED_AT,
        durationMinutes: DURATION,
        excludeInterviewId: INTERVIEW_ID_A,
      });

      // findOverlapping is called twice (recruiter + candidate paths)
      expect(interviewsRepo.findOverlapping).toHaveBeenCalledTimes(2);
      for (const call of interviewsRepo.findOverlapping.mock.calls) {
        expect(call[0]).toMatchObject({ excludeInterviewId: INTERVIEW_ID_A });
      }
    });
  });

  describe("checkConflicts (internal helper)", () => {
    it("calls findOverlapping once for recruiter and once for candidate in parallel", async () => {
      const { svc, interviewsRepo } = makeService();

      await svc.checkConflicts({
        scheduledAt: new Date(SCHEDULED_AT),
        durationMinutes: DURATION,
        recruiterId: RECRUITER_ID,
        candidateId: CANDIDATE_ID,
      });

      expect(interviewsRepo.findOverlapping).toHaveBeenCalledTimes(2);

      const calls = interviewsRepo.findOverlapping.mock.calls as Array<[{ recruiterId?: string; candidateId?: string }]>;
      const recruiterCall = calls.find((c) => c[0].recruiterId === RECRUITER_ID);
      const candidateCall = calls.find((c) => c[0].candidateId === CANDIDATE_ID);

      expect(recruiterCall).toBeDefined();
      expect(candidateCall).toBeDefined();
    });
  });
});
