/**
 * Unit tests for InterviewsService.reschedule
 *
 * Covers:
 *  1. From `scheduled`: marks original rescheduled, creates new with rescheduledFromId,
 *     audits INTERVIEW_RESCHEDULED, emits realtime interview.rescheduled, returns new InterviewDto.
 *  2. From `no-show`: same successful path.
 *  3. Throws BadRequestException (INVALID_STATUS_TRANSITION) from cancelled, completed, rescheduled.
 *  4. Throws BadRequestException (PAST_DATE) when scheduledAt < now.
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
import { InterviewVenuesService } from "../interview-venues/interview-venues.service";
import { ScoringRepository } from "../scoring/scoring.repository";
import { DRIZZLE_CLIENT } from "../../db/db.module";

// ── Helpers ───────────────────────────────────────────────────────────────────

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const RECRUITER_ID = uuid(1);
const COMPANY_ID = uuid(10);
const INTERVIEW_ID = uuid(50);
const NEW_INTERVIEW_ID = uuid(51);
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

function makeFutureIso(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

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
    venueName: "HQ",
    addressLine: "123 Main St",
    roomOrFloor: null,
    mapUrl: null,
    reportingInstructions: null,
    whatToBring: null,
    interviewerName: null,
    interviewerTitle: null,
    feedback: null,
    rating: null,
    candidateSummary: null,
    sharedWithCandidateAt: null,
    rescheduledFromId: null,
    rescheduledToId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
}

function makeNewInterview() {
  return {
    ...makeInterview("scheduled"),
    id: NEW_INTERVIEW_ID,
    rescheduledFromId: INTERVIEW_ID,
  } as any;
}

function makeRescheduleDto(scheduledAt?: string) {
  return {
    scheduledAt: scheduledAt ?? makeFutureIso(),
    durationMinutes: 60,
    format: "in-person",
    venueName: "New Office",
    addressLine: "456 New St",
    roomOrFloor: null,
    mapUrl: null,
    reportingInstructions: null,
    whatToBring: null,
    interviewerName: null,
    interviewerTitle: null,
    saveAsTemplate: false,
  } as any;
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("InterviewsService.reschedule", () => {
  let service: InterviewsService;
  let repo: jest.Mocked<InterviewsRepository>;
  let applicationsRepo: jest.Mocked<ApplicationsRepository>;
  let jobsRepo: jest.Mocked<JobsRepository>;
  let audit: jest.Mocked<AuditService>;
  let events: jest.Mocked<EventsService>;
  let cache: jest.Mocked<CacheService>;
  let notifications: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    repo = {
      findById: jest.fn(),
      update: jest.fn(),
      insert: jest.fn(),
      markRescheduled: jest.fn(),
      setRescheduledTo: jest.fn(),
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

    jobsRepo = {
      findById: jest.fn(),
      findByIdWithCompany: jest.fn(),
    } as any;

    audit = { log: jest.fn().mockResolvedValue(undefined) } as any;

    events = {
      emitApplicationRecommendationSet: jest.fn(),
      emitApplicationStatusChanged: jest.fn(),
      emitInterviewScheduled: jest.fn(),
      emitInterviewStatusChanged: jest.fn(),
      emitInterviewRescheduled: jest.fn(),
      emitInterviewFeedbackShared: jest.fn(),
    } as any;

    cache = {
      bustTags: jest.fn().mockResolvedValue(undefined),
      getOrSet: jest.fn(),
    } as any;

    notifications = {
      emit: jest.fn().mockResolvedValue(undefined),
    } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        InterviewsService,
        { provide: InterviewsRepository, useValue: repo },
        { provide: ApplicationsRepository, useValue: applicationsRepo },
        { provide: JobsRepository, useValue: jobsRepo },
        { provide: ProfilesRepository, useValue: { findById: jest.fn() } },
        { provide: EmailService, useValue: { send: jest.fn() } },
        { provide: AuditService, useValue: audit },
        { provide: CacheService, useValue: cache },
        { provide: EventsService, useValue: events },
        { provide: NotificationsService, useValue: notifications },
        { provide: InterviewVenuesService, useValue: { create: jest.fn() } },
        {
          // Per thesis panel revision (May 2026): score-based interview
          // eligibility gate — null score means the gate is a no-op.
          provide: ScoringRepository,
          useValue: {
            findMatchScoreByApplicationId: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: DRIZZLE_CLIENT,
          useValue: {
            select: jest.fn().mockReturnValue({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  limit: jest
                    .fn()
                    .mockResolvedValue([{ autoRejectThreshold: 75 }]),
                }),
              }),
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(InterviewsService);
  });

  it("from scheduled: marks original rescheduled, creates new linked row, audits INTERVIEW_RESCHEDULED, emits realtime, returns new InterviewDto", async () => {
    repo.findById.mockResolvedValue(makeInterview("scheduled"));
    applicationsRepo.findApplicationContextForCompany.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
      jobId: uuid(300),
      companyId: COMPANY_ID,
    } as any);
    repo.markRescheduled.mockResolvedValue({ id: INTERVIEW_ID });
    repo.insert.mockResolvedValue(makeNewInterview());
    repo.setRescheduledTo.mockResolvedValue(undefined);
    applicationsRepo.findById.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
    } as any);

    const result = await service.reschedule(
      recruiterUser,
      COMPANY_ID,
      INTERVIEW_ID,
      makeRescheduleDto(),
      {},
    );

    // Original marked rescheduled.
    expect(repo.markRescheduled).toHaveBeenCalledWith(INTERVIEW_ID);

    // New interview inserted with rescheduledFromId.
    expect(repo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: APPLICATION_ID,
        rescheduledFromId: INTERVIEW_ID,
        status: "scheduled",
      }),
    );

    // Forward link set.
    expect(repo.setRescheduledTo).toHaveBeenCalledWith(
      INTERVIEW_ID,
      NEW_INTERVIEW_ID,
    );

    // Audit action logged.
    const auditActions = audit.log.mock.calls.map((c) => c[0].action);
    expect(auditActions).toContain(AUDIT_ACTIONS.INTERVIEW_RESCHEDULED);

    const rescheduledAudit = audit.log.mock.calls.find(
      (c) => c[0].action === AUDIT_ACTIONS.INTERVIEW_RESCHEDULED,
    )!;
    expect(rescheduledAudit[0].details).toMatchObject({
      previousInterviewId: INTERVIEW_ID,
      applicationId: APPLICATION_ID,
    });
    expect(rescheduledAudit[0].entityId).toBe(NEW_INTERVIEW_ID);

    // Realtime event emitted.
    expect(events.emitInterviewRescheduled).toHaveBeenCalledWith(
      expect.objectContaining({
        oldInterviewId: INTERVIEW_ID,
        newInterviewId: NEW_INTERVIEW_ID,
        applicationId: APPLICATION_ID,
        candidateId: CANDIDATE_ID,
        recruiterId: RECRUITER_ID,
      }),
    );

    // Returns the new interview DTO.
    expect(result.id).toBe(NEW_INTERVIEW_ID);
    expect(result.status).toBe("scheduled");
  });

  it("from no-show: same successful path — marks rescheduled, inserts new, audits, emits", async () => {
    repo.findById.mockResolvedValue(makeInterview("no-show"));
    applicationsRepo.findApplicationContextForCompany.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
      jobId: uuid(300),
      companyId: COMPANY_ID,
    } as any);
    repo.markRescheduled.mockResolvedValue({ id: INTERVIEW_ID });
    repo.insert.mockResolvedValue(makeNewInterview());
    repo.setRescheduledTo.mockResolvedValue(undefined);
    applicationsRepo.findById.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
    } as any);

    const result = await service.reschedule(
      recruiterUser,
      COMPANY_ID,
      INTERVIEW_ID,
      makeRescheduleDto(),
      {},
    );

    expect(repo.markRescheduled).toHaveBeenCalledWith(INTERVIEW_ID);
    expect(repo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        rescheduledFromId: INTERVIEW_ID,
        status: "scheduled",
      }),
    );
    expect(events.emitInterviewRescheduled).toHaveBeenCalled();
    expect(result.id).toBe(NEW_INTERVIEW_ID);
  });

  it.each(["cancelled", "completed", "rescheduled"])(
    "throws INVALID_STATUS_TRANSITION when status is '%s'",
    async (status) => {
      repo.findById.mockResolvedValue(makeInterview(status));
      applicationsRepo.findApplicationContextForCompany.mockResolvedValue({
        id: APPLICATION_ID,
        candidateId: CANDIDATE_ID,
        jobId: uuid(300),
        companyId: COMPANY_ID,
      } as any);

      await expect(
        service.reschedule(
          recruiterUser,
          COMPANY_ID,
          INTERVIEW_ID,
          makeRescheduleDto(),
          {},
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.reschedule(
          recruiterUser,
          COMPANY_ID,
          INTERVIEW_ID,
          makeRescheduleDto(),
          {},
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "INVALID_STATUS_TRANSITION",
        }),
      });

      expect(repo.markRescheduled).not.toHaveBeenCalled();
      expect(repo.insert).not.toHaveBeenCalled();
    },
  );

  it("throws PAST_DATE when scheduledAt is in the past", async () => {
    repo.findById.mockResolvedValue(makeInterview("scheduled"));
    applicationsRepo.findApplicationContextForCompany.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
      jobId: uuid(300),
      companyId: COMPANY_ID,
    } as any);

    // 2 minutes in the past — well beyond the 60s grace window in the service.
    const pastIso = new Date(Date.now() - 120_000).toISOString();

    await expect(
      service.reschedule(
        recruiterUser,
        COMPANY_ID,
        INTERVIEW_ID,
        makeRescheduleDto(pastIso),
        {},
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.reschedule(
        recruiterUser,
        COMPANY_ID,
        INTERVIEW_ID,
        makeRescheduleDto(pastIso),
        {},
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PAST_DATE" }),
    });

    expect(repo.markRescheduled).not.toHaveBeenCalled();
  });

  it("emits interview_rescheduled notification to candidate (instant mode -> queue picks up email)", async () => {
    // Verifies that reschedule() fires NotificationsService.emit() so that:
    //  (a) an in-app notification row is created for the candidate, and
    //  (b) the instant-mode path enqueues an email job (queue.add is called by emit()
    //      internally — we assert on the emit call here; the queue path is covered in
    //      notifications.service.spec).
    repo.findById.mockResolvedValue(makeInterview("scheduled"));
    applicationsRepo.findApplicationContextForCompany.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
      jobId: uuid(300),
      companyId: COMPANY_ID,
    } as any);
    repo.markRescheduled.mockResolvedValue({ id: INTERVIEW_ID });
    repo.insert.mockResolvedValue(makeNewInterview());
    repo.setRescheduledTo.mockResolvedValue(undefined);
    applicationsRepo.findById.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
      jobId: uuid(300),
    } as any);
    jobsRepo.findByIdWithCompany.mockResolvedValue({
      id: uuid(300),
      title: "Senior Engineer",
      company: { id: COMPANY_ID, name: "Acme", logoUrl: null },
    } as any);

    await service.reschedule(
      recruiterUser,
      COMPANY_ID,
      INTERVIEW_ID,
      makeRescheduleDto(),
      {},
    );

    // Allow any pending microtasks (the emit is fire-and-forget via void).
    await new Promise((resolve) => setImmediate(resolve));

    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: CANDIDATE_ID,
        eventType: "interview_rescheduled",
        entityType: "interview",
        entityId: NEW_INTERVIEW_ID,
        metadata: expect.objectContaining({
          interviewId: NEW_INTERVIEW_ID,
          applicationId: APPLICATION_ID,
          jobTitle: "Senior Engineer",
        }),
      }),
    );
  });
});
