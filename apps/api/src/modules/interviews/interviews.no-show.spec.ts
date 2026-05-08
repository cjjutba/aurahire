/**
 * Unit tests for InterviewsService.markNoShow
 *
 * Covers:
 *  1. Marks scheduled → no-show: status updated, audit INTERVIEW_NO_SHOW_MARKED, realtime emit fired.
 *  2. Marks completed → no-show: same behaviour.
 *  3. Throws BadRequestException (INVALID_STATUS_TRANSITION) from cancelled / no-show / rescheduled.
 *
 * No database is hit — all dependencies are mocked.
 */

import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { InterviewsService } from "./interviews.service";
import { InterviewsRepository } from "./interviews.repository";
import { ApplicationsRepository } from "../applications/applications.repository";
import { JobsRepository } from "../jobs/jobs.repository";
import { ProfilesRepository } from "../profiles/profiles.repository";
import { EmailService } from "../../email/email.service";
import { AuditService } from "../../audit";
import { AUDIT_ACTIONS } from "../../audit/audit.types";
import { CacheService } from "../../cache";
import { EventsService } from "../../realtime";
import { NotificationsService } from "../notifications/notifications.service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const RECRUITER_ID = uuid(1);
const COMPANY_ID = uuid(10);
const INTERVIEW_ID = uuid(50);
const APPLICATION_ID = uuid(100);
const CANDIDATE_ID = uuid(200);

const recruiterUser = {
  id: RECRUITER_ID,
  role: "recruiter",
  email: "recruiter@example.com",
  status: "active",
  fullName: "Test Recruiter",
  profileCompleted: true,
} as any;

function makeInterview(status: string) {
  return {
    id: INTERVIEW_ID,
    applicationId: APPLICATION_ID,
    scheduledBy: RECRUITER_ID,
    status,
    recommendation: null,
    scheduledAt: new Date(),
    durationMinutes: 60,
    format: "in-person",
    locationOrLink: null,
    feedback: null,
    rating: null,
    candidateSummary: null,
    sharedWithCandidateAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
}

function makeNoShowInterview() {
  return { ...makeInterview("no-show") };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("InterviewsService.markNoShow", () => {
  let service: InterviewsService;
  let repo: jest.Mocked<InterviewsRepository>;
  let applicationsRepo: jest.Mocked<ApplicationsRepository>;
  let audit: jest.Mocked<AuditService>;
  let events: jest.Mocked<EventsService>;
  let cache: jest.Mocked<CacheService>;

  beforeEach(async () => {
    repo = {
      findById: jest.fn(),
      update: jest.fn(),
      insert: jest.fn(),
      findByApplicationId: jest.fn(),
      findByCandidateId: jest.fn(),
      listForCompanyPaginated: jest.fn(),
      findOverlapping: jest.fn(),
    } as any;

    applicationsRepo = {
      findApplicationContextForCompany: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      findApplicationContextForCompanyByUser: jest.fn(),
    } as any;

    audit = { log: jest.fn().mockResolvedValue(undefined) } as any;

    events = {
      emitApplicationRecommendationSet: jest.fn(),
      emitApplicationStatusChanged: jest.fn(),
      emitInterviewScheduled: jest.fn(),
      emitInterviewStatusChanged: jest.fn(),
    } as any;

    cache = {
      bustTags: jest.fn().mockResolvedValue(undefined),
      getOrSet: jest.fn(),
    } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        InterviewsService,
        { provide: InterviewsRepository, useValue: repo },
        { provide: ApplicationsRepository, useValue: applicationsRepo },
        {
          provide: JobsRepository,
          useValue: { findById: jest.fn(), findByIdWithCompany: jest.fn() },
        },
        { provide: ProfilesRepository, useValue: { findById: jest.fn() } },
        { provide: EmailService, useValue: { send: jest.fn() } },
        { provide: AuditService, useValue: audit },
        { provide: CacheService, useValue: cache },
        { provide: EventsService, useValue: events },
        {
          provide: NotificationsService,
          useValue: { emit: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = moduleRef.get(InterviewsService);
  });

  it("marks scheduled → no-show: updates status, audits INTERVIEW_NO_SHOW_MARKED, emits realtime", async () => {
    repo.findById.mockResolvedValue(makeInterview("scheduled"));
    applicationsRepo.findApplicationContextForCompany.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
      jobId: uuid(300),
      companyId: COMPANY_ID,
    } as any);
    repo.update.mockResolvedValue(makeNoShowInterview());
    applicationsRepo.findById.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
    } as any);

    const result = await service.markNoShow(recruiterUser, COMPANY_ID, INTERVIEW_ID, {});

    // Status persisted as no-show.
    expect(repo.update).toHaveBeenCalledWith(INTERVIEW_ID, { status: "no-show" });

    // Correct audit action logged.
    const auditActions = audit.log.mock.calls.map((c) => c[0].action);
    expect(auditActions).toContain(AUDIT_ACTIONS.INTERVIEW_NO_SHOW_MARKED);

    // Audit details include the previous status.
    const noShowAudit = audit.log.mock.calls.find(
      (c) => c[0].action === AUDIT_ACTIONS.INTERVIEW_NO_SHOW_MARKED,
    )!;
    expect(noShowAudit[0].details).toMatchObject({ from: "scheduled", applicationId: APPLICATION_ID });

    // Realtime event fired.
    expect(events.emitInterviewStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        interviewId: INTERVIEW_ID,
        applicationId: APPLICATION_ID,
        recruiterId: RECRUITER_ID,
        candidateId: CANDIDATE_ID,
        previousStatus: "scheduled",
        status: "no-show",
      }),
    );

    // DTO returned correctly.
    expect(result.status).toBe("no-show");
  });

  it("marks completed → no-show: updates status, audits INTERVIEW_NO_SHOW_MARKED, emits realtime", async () => {
    repo.findById.mockResolvedValue(makeInterview("completed"));
    applicationsRepo.findApplicationContextForCompany.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
      jobId: uuid(300),
      companyId: COMPANY_ID,
    } as any);
    repo.update.mockResolvedValue(makeNoShowInterview());
    applicationsRepo.findById.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
    } as any);

    await service.markNoShow(recruiterUser, COMPANY_ID, INTERVIEW_ID, {});

    expect(repo.update).toHaveBeenCalledWith(INTERVIEW_ID, { status: "no-show" });

    const auditActions = audit.log.mock.calls.map((c) => c[0].action);
    expect(auditActions).toContain(AUDIT_ACTIONS.INTERVIEW_NO_SHOW_MARKED);

    const noShowAudit = audit.log.mock.calls.find(
      (c) => c[0].action === AUDIT_ACTIONS.INTERVIEW_NO_SHOW_MARKED,
    )!;
    expect(noShowAudit[0].details).toMatchObject({ from: "completed" });

    expect(events.emitInterviewStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStatus: "completed",
        status: "no-show",
      }),
    );
  });

  it.each(["cancelled", "no-show", "rescheduled"])(
    "throws BadRequestException (INVALID_STATUS_TRANSITION) when status is '%s'",
    async (status) => {
      repo.findById.mockResolvedValue(makeInterview(status));
      applicationsRepo.findApplicationContextForCompany.mockResolvedValue({
        id: APPLICATION_ID,
        candidateId: CANDIDATE_ID,
        jobId: uuid(300),
        companyId: COMPANY_ID,
      } as any);

      await expect(
        service.markNoShow(recruiterUser, COMPANY_ID, INTERVIEW_ID, {}),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.markNoShow(recruiterUser, COMPANY_ID, INTERVIEW_ID, {}),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "INVALID_STATUS_TRANSITION" }),
      });

      expect(repo.update).not.toHaveBeenCalled();
    },
  );
});
