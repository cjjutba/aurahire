/**
 * Unit tests for InterviewsService.shareFeedback
 *
 * Covers:
 *  1. Sets candidateSummary + sharedWithCandidateAt, audits INTERVIEW_FEEDBACK_SHARED,
 *     fires notifications.emit with interview_feedback_shared, emits realtime event.
 *  2. isUpdate: true in audit details when re-sharing (sharedWithCandidateAt already set).
 *  3. Throws ForbiddenException when user is not a recruiter.
 *
 * No database is hit — all dependencies are mocked.
 */

import { ForbiddenException } from "@nestjs/common";
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const RECRUITER_ID = uuid(1);
const CANDIDATE_ID = uuid(2);
const COMPANY_ID = uuid(10);
const INTERVIEW_ID = uuid(50);
const APPLICATION_ID = uuid(100);

const recruiterUser = {
  id: RECRUITER_ID,
  role: "recruiter",
  email: "recruiter@example.com",
  status: "active",
  fullName: "Test Recruiter",
  profileCompleted: true,
} as any;

const candidateUser = {
  id: CANDIDATE_ID,
  role: "candidate",
  email: "candidate@example.com",
  status: "active",
  fullName: "Test Candidate",
  profileCompleted: true,
} as any;

function makeBaseInterview(sharedWithCandidateAt: Date | null = null) {
  return {
    id: INTERVIEW_ID,
    applicationId: APPLICATION_ID,
    scheduledBy: RECRUITER_ID,
    status: "completed",
    recommendation: "proceed",
    scheduledAt: new Date(),
    durationMinutes: 60,
    format: "in-person",
    locationOrLink: null,
    feedback: "Strong candidate",
    rating: 5,
    candidateSummary: null,
    sharedWithCandidateAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
}

function makeUpdatedInterview(
  candidateSummary: string,
  sharedWithCandidateAt: Date,
) {
  return {
    ...makeBaseInterview(sharedWithCandidateAt),
    candidateSummary,
  } as any;
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("InterviewsService.shareFeedback", () => {
  let service: InterviewsService;
  let repo: jest.Mocked<InterviewsRepository>;
  let applicationsRepo: jest.Mocked<ApplicationsRepository>;
  let audit: jest.Mocked<AuditService>;
  let events: jest.Mocked<EventsService>;
  let cache: jest.Mocked<CacheService>;
  let notifications: jest.Mocked<NotificationsService>;

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
        {
          provide: JobsRepository,
          useValue: { findById: jest.fn(), findByIdWithCompany: jest.fn() },
        },
        { provide: ProfilesRepository, useValue: { findById: jest.fn() } },
        { provide: EmailService, useValue: { send: jest.fn() } },
        { provide: AuditService, useValue: audit },
        { provide: CacheService, useValue: cache },
        { provide: EventsService, useValue: events },
        { provide: NotificationsService, useValue: notifications },
        { provide: InterviewVenuesService, useValue: { create: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(InterviewsService);
  });

  it("sets candidateSummary + sharedWithCandidateAt, audits FEEDBACK_SHARED, fires notification + realtime", async () => {
    const summary =
      "You demonstrated excellent technical skills and cultural fit.";
    const baseInterview = makeBaseInterview(null);
    repo.findById.mockResolvedValue(baseInterview);
    applicationsRepo.findApplicationContextForCompany.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
      jobId: uuid(300),
      companyId: COMPANY_ID,
    } as any);
    const sharedAt = new Date();
    repo.update.mockResolvedValue(makeUpdatedInterview(summary, sharedAt));
    applicationsRepo.findById.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
    } as any);

    const result = await service.shareFeedback(
      recruiterUser,
      COMPANY_ID,
      INTERVIEW_ID,
      { candidateSummary: summary } as any,
      {},
    );

    // 1. Repository must receive candidateSummary + sharedWithCandidateAt in the patch.
    expect(repo.update).toHaveBeenCalledWith(
      INTERVIEW_ID,
      expect.objectContaining({
        candidateSummary: summary,
        sharedWithCandidateAt: expect.any(Date),
      }),
    );

    // 2. Audit must be logged with INTERVIEW_FEEDBACK_SHARED.
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.INTERVIEW_FEEDBACK_SHARED,
        entityId: INTERVIEW_ID,
        details: expect.objectContaining({
          applicationId: APPLICATION_ID,
          length: summary.length,
          isUpdate: false,
        }),
      }),
    );

    // 3. In-app notification must fire for the candidate.
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: CANDIDATE_ID,
        eventType: "interview_feedback_shared",
        entityType: "interview",
        entityId: INTERVIEW_ID,
      }),
    );

    // 4. Realtime event must be emitted.
    expect(events.emitInterviewFeedbackShared).toHaveBeenCalledWith(
      expect.objectContaining({
        interviewId: INTERVIEW_ID,
        applicationId: APPLICATION_ID,
        candidateId: CANDIDATE_ID,
        recruiterId: RECRUITER_ID,
      }),
    );

    // 5. Response DTO must include the new fields.
    expect(result.candidateSummary).toBe(summary);
    expect(result.sharedWithCandidateAt).toBeTruthy();
  });

  it("sets isUpdate: true in audit details when re-sharing (sharedWithCandidateAt already set)", async () => {
    const previousSharedAt = new Date(Date.now() - 86_400_000); // 1 day ago
    const baseInterview = makeBaseInterview(previousSharedAt);
    repo.findById.mockResolvedValue(baseInterview);
    applicationsRepo.findApplicationContextForCompany.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
      jobId: uuid(300),
      companyId: COMPANY_ID,
    } as any);
    const newSummary = "Updated: excellent fit for the senior role.";
    const newSharedAt = new Date();
    repo.update.mockResolvedValue(
      makeUpdatedInterview(newSummary, newSharedAt),
    );
    applicationsRepo.findById.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
    } as any);

    await service.shareFeedback(
      recruiterUser,
      COMPANY_ID,
      INTERVIEW_ID,
      { candidateSummary: newSummary } as any,
      {},
    );

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.INTERVIEW_FEEDBACK_SHARED,
        details: expect.objectContaining({
          isUpdate: true,
        }),
      }),
    );
  });

  it("throws ForbiddenException when user is not a recruiter", async () => {
    await expect(
      service.shareFeedback(
        candidateUser,
        COMPANY_ID,
        INTERVIEW_ID,
        { candidateSummary: "Some summary" } as any,
        {},
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(repo.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
    expect(events.emitInterviewFeedbackShared).not.toHaveBeenCalled();
  });
});
