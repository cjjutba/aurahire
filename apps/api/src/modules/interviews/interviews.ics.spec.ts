/**
 * Unit tests for ICS download in InterviewsService.
 *
 * Covers:
 *  1. Throws NotFoundException when interview does not exist.
 *  2. Throws NotFoundException when a candidate tries to download another
 *     candidate's interview.
 *  3. Returns a valid ICS string containing BEGIN:VCALENDAR for an
 *     authorized candidate.
 *
 * No database is hit — all repositories are fully mocked.
 */

import { NotFoundException } from "@nestjs/common";
import type { AuthUser } from "@aurahire/shared";

import { InterviewsService } from "./interviews.service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const CANDIDATE_ID = uuid(1);
const OTHER_CANDIDATE_ID = uuid(2);
const INTERVIEW_ID = uuid(10);
const APPLICATION_ID = uuid(20);
const JOB_ID = uuid(30);

function makeCandidate(id = CANDIDATE_ID): AuthUser {
  return {
    id,
    role: "candidate",
    email: "candidate@example.com",
    status: "active",
    fullName: "Test Candidate",
    profileCompleted: true,
  } as unknown as AuthUser;
}

function makeInterview() {
  return {
    id: INTERVIEW_ID,
    applicationId: APPLICATION_ID,
    scheduledBy: uuid(99),
    scheduledAt: new Date("2026-06-01T10:00:00Z"),
    durationMinutes: 60,
    format: "in_person",
    locationOrLink: null,
    status: "scheduled",
    feedback: null,
    rating: null,
    venueName: "HQ",
    addressLine: "123 Main St",
    roomOrFloor: null,
    reportingInstructions: null,
    whatToBring: null,
    interviewerName: null,
    interviewerTitle: null,
    mapUrl: null,
    rescheduledFromId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeApplication(candidateId = CANDIDATE_ID) {
  return {
    id: APPLICATION_ID,
    jobId: JOB_ID,
    candidateId,
    resumeId: uuid(50),
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

function makeProfile() {
  return {
    id: CANDIDATE_ID,
    fullName: "Test Candidate",
    email: "candidate@example.com",
  };
}

function makeJobWithCompany() {
  return {
    id: JOB_ID,
    title: "Software Engineer",
    companyId: uuid(60),
    company: { id: uuid(60), name: "Acme Corp" },
  };
}

// ── Service factory ───────────────────────────────────────────────────────────

interface MockOptions {
  interview?: ReturnType<typeof makeInterview> | null;
  application?: ReturnType<typeof makeApplication> | null;
  profile?: ReturnType<typeof makeProfile> | null;
  jobWithCompany?: ReturnType<typeof makeJobWithCompany> | null;
}

function makeService(opts: MockOptions = {}) {
  const interviewsRepo = {
    findById: jest
      .fn()
      .mockResolvedValue(
        "interview" in opts ? opts.interview : makeInterview(),
      ),
    insert: jest.fn(),
    update: jest.fn(),
    findByCandidateId: jest.fn(),
    findByApplicationId: jest.fn(),
    listForCompanyPaginated: jest.fn(),
    findOverlapping: jest.fn(),
  };

  const applicationsRepo = {
    findById: jest
      .fn()
      .mockResolvedValue(
        "application" in opts ? opts.application : makeApplication(),
      ),
    findApplicationContextForCompany: jest.fn(),
    update: jest.fn(),
  };

  const jobsRepo = {
    findById: jest.fn().mockResolvedValue(makeJobWithCompany()),
    findByIdWithCompany: jest
      .fn()
      .mockResolvedValue(
        "jobWithCompany" in opts ? opts.jobWithCompany : makeJobWithCompany(),
      ),
  };

  const profilesRepo = {
    findById: jest
      .fn()
      .mockResolvedValue("profile" in opts ? opts.profile : makeProfile()),
  };

  const email = { send: jest.fn().mockResolvedValue(undefined) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const cacheService = {
    bustTags: jest.fn().mockResolvedValue(undefined),
    getOrSet: jest.fn(),
  };
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InterviewsService — getIcs", () => {
  it("throws NotFoundException when the interview does not exist", async () => {
    const { svc } = makeService({ interview: null });
    const user = makeCandidate();

    await expect(svc.getIcs(user, INTERVIEW_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("throws NotFoundException when a candidate tries to access another candidate's interview", async () => {
    // Interview belongs to APPLICATION_ID whose candidateId = CANDIDATE_ID,
    // but the requesting user is OTHER_CANDIDATE_ID.
    const { svc } = makeService({
      application: makeApplication(CANDIDATE_ID),
    });
    const otherUser = makeCandidate(OTHER_CANDIDATE_ID);

    await expect(svc.getIcs(otherUser, INTERVIEW_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("returns a string containing BEGIN:VCALENDAR for an authorized candidate", async () => {
    const { svc } = makeService();
    const user = makeCandidate(CANDIDATE_ID);

    const result = await svc.getIcs(user, INTERVIEW_ID);

    expect(typeof result).toBe("string");
    expect(result).toContain("BEGIN:VCALENDAR");
    expect(result).toContain("END:VCALENDAR");
    expect(result).toContain("BEGIN:VEVENT");
  });
});
