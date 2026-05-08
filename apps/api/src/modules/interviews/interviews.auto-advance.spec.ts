/**
 * Unit tests for InterviewsService.schedule() auto-advance logic.
 *
 * Covers:
 *  1. applied → interview: status is updated + interview row created
 *  2. screening → interview: same advance
 *  3. interview → interview: no redundant status update (multi-round)
 *  4. Status change is audited with action "application.status_changed"
 *  5. emitApplicationStatusChanged is called with previousStatus + status:"interview"
 */

import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AuthUser } from "@aurahire/shared";

import { InterviewsService } from "./interviews.service";

// ── Helpers ──────────────────────────────────────────────────────────────────

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const FUTURE_DATE = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // +1 h

function makeScheduleDto() {
  return {
    scheduledAt: FUTURE_DATE,
    durationMinutes: 60,
    format: "video" as const,
    locationOrLink: "https://meet.example.com/room",
    venueName: "HQ",
    addressLine: "123 Main St",
    saveAsTemplate: false,
  };
}

function makeRecruiter(): AuthUser {
  return {
    id: uuid(1),
    role: "recruiter",
    email: "recruiter@example.com",
    status: "active",
    fullName: "Test Recruiter",
    profileCompleted: true,
  } as unknown as AuthUser;
}

/**
 * Build a minimal mock application row with the given status.
 */
function makeApplication(status: string) {
  return {
    id: uuid(100),
    jobId: uuid(200),
    candidateId: uuid(300),
    resumeId: uuid(400),
    status,
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

const INTERVIEW_ROW = {
  id: uuid(999),
  applicationId: uuid(100),
  scheduledBy: uuid(1),
  scheduledAt: new Date(FUTURE_DATE),
  durationMinutes: 60,
  format: "video",
  locationOrLink: "https://meet.example.com/room",
  status: "scheduled",
  feedback: null,
  rating: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Factory ───────────────────────────────────────────────────────────────────

function makeService(applicationStatus: string) {
  const application = makeApplication(applicationStatus);

  const applicationsRepo = {
    findApplicationContextForCompany: jest.fn().mockResolvedValue(application),
    findById: jest.fn().mockResolvedValue(application),
    update: jest.fn().mockResolvedValue({ ...application, status: "interview" }),
  };

  const interviewsRepo = {
    insert: jest.fn().mockResolvedValue(INTERVIEW_ROW),
    findById: jest.fn(),
    update: jest.fn(),
    findByCandidateId: jest.fn(),
    findByApplicationId: jest.fn(),
    listForCompanyPaginated: jest.fn(),
  };

  const jobsRepo = {
    findById: jest.fn().mockResolvedValue({ id: uuid(200), companyId: uuid(10), recruiterId: uuid(1) }),
    findByIdWithCompany: jest.fn(),
  };

  const profilesRepo = {
    findById: jest.fn(),
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
  );

  return { svc, applicationsRepo, interviewsRepo, audit, events };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InterviewsService.schedule() auto-advance", () => {
  const user = makeRecruiter();
  const companyId = uuid(10);
  const applicationId = uuid(100);
  const dto = makeScheduleDto();

  it("advances application from 'applied' to 'interview' and creates the interview row", async () => {
    const { svc, applicationsRepo, interviewsRepo } = makeService("applied");

    const result = await svc.schedule(user, companyId, applicationId, dto);

    expect(applicationsRepo.update).toHaveBeenCalledWith(
      applicationId,
      expect.objectContaining({ status: "interview" }),
    );
    expect(interviewsRepo.insert).toHaveBeenCalledTimes(1);
    expect(result.id).toBe(INTERVIEW_ROW.id);
  });

  it("advances application from 'screening' to 'interview'", async () => {
    const { svc, applicationsRepo } = makeService("screening");

    await svc.schedule(user, companyId, applicationId, dto);

    expect(applicationsRepo.update).toHaveBeenCalledWith(
      applicationId,
      expect.objectContaining({ status: "interview" }),
    );
  });

  it("does NOT call applicationsRepo.update when application is already 'interview' (multi-round)", async () => {
    const { svc, applicationsRepo } = makeService("interview");

    await svc.schedule(user, companyId, applicationId, dto);

    expect(applicationsRepo.update).not.toHaveBeenCalled();
  });

  it("writes an audit entry with action 'application.status_changed' when advancing", async () => {
    const { svc, audit } = makeService("applied");

    await svc.schedule(user, companyId, applicationId, dto);

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "application.status_changed",
        entityType: "application",
        entityId: applicationId,
        details: expect.objectContaining({ from: "applied", to: "interview" }),
      }),
    );
  });

  it("emits ApplicationStatusChanged with previousStatus and status:'interview' when advancing", async () => {
    const { svc, events } = makeService("screening");

    await svc.schedule(user, companyId, applicationId, dto);

    expect(events.emitApplicationStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId,
        previousStatus: "screening",
        status: "interview",
      }),
    );
  });

  it("does NOT emit ApplicationStatusChanged when application is already 'interview'", async () => {
    const { svc, events } = makeService("interview");

    await svc.schedule(user, companyId, applicationId, dto);

    expect(events.emitApplicationStatusChanged).not.toHaveBeenCalled();
  });
});
