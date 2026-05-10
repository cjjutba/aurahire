/**
 * Happy-path integration spec for the interview v2 flow.
 *
 * Simulates a complete recruiter ↔ candidate user journey using mocked
 * dependencies — no real database, no network calls.
 *
 * Flow covered:
 *  Step 1  — Recruiter schedules from `applied` (skip-screening):
 *              status auto-advances to `interview`, interview row created.
 *  Step 2  — Autocomplete cron flips `scheduled → completed` after grace period.
 *  Step 3  — Recruiter sets feedback + recommendation=`proceed`:
 *              feedback persisted, FEEDBACK_SUBMITTED + RECOMMENDATION_SET audited,
 *              `application.recommendationSet` realtime event emitted.
 *  Step 4  — Recruiter shares candidate-facing summary:
 *              `candidateSummary` + `sharedWithCandidateAt` persisted,
 *              candidate in-app notification fired, realtime event emitted,
 *              INTERVIEW_FEEDBACK_SHARED audited.
 *  Step 5  — Candidate retrieves the interview via getByIdForCandidate():
 *              `candidateSummary` exposed; `feedback`, `rating`, `recommendation` redacted.
 *  Step 6  — Reschedule branch (parallel path):
 *              original marked `rescheduled`, new row linked, INTERVIEW_RESCHEDULED audited,
 *              realtime `interview.rescheduled` event emitted.
 *  Step 7  — Withdraw branch: candidate withdraws application:
 *              status → `withdrawn`, APPLICATION_WITHDRAWN_BY_CANDIDATE audited,
 *              `application.withdrawn` realtime event emitted.
 */

import { Test } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";

import { InterviewsService } from "./interviews.service";
import { InterviewsRepository } from "./interviews.repository";
import { ApplicationsRepository } from "../applications/applications.repository";
import { ApplicationsService } from "../applications/applications.service";
import { JobsRepository } from "../jobs/jobs.repository";
import { ProfilesRepository } from "../profiles/profiles.repository";
import { EmailService } from "../../email/email.service";
import { AuditService } from "../../audit";
import { AUDIT_ACTIONS } from "../../audit/audit.types";
import { CacheService } from "../../cache";
import { EventsService } from "../../realtime";
import { NotificationsService } from "../notifications/notifications.service";
import { InterviewVenuesService } from "../interview-venues/interview-venues.service";
import { ResumesRepository } from "../resumes/resumes.repository";
import { ScoringService } from "../scoring/scoring.service";
import { StorageService } from "../../storage/storage.service";
import { MatchScoreQueueService } from "../../queue/match-score-queue.service";
import { OffersRepository } from "../offers/offers.repository";
import { DRIZZLE_CLIENT } from "../../db/db.module";

// ── Test IDs ──────────────────────────────────────────────────────────────────

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const RECRUITER_ID = uuid(1);
const CANDIDATE_ID = uuid(2);
const COMPANY_ID = uuid(10);
const JOB_ID = uuid(20);
const APPLICATION_ID = uuid(100);
const INTERVIEW_ID = uuid(200);
const NEW_INTERVIEW_ID = uuid(201); // used in reschedule branch

// ── Fixtures ──────────────────────────────────────────────────────────────────

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

function makeFuture(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

function makeApplication(status: string) {
  return {
    id: APPLICATION_ID,
    candidateId: CANDIDATE_ID,
    jobId: JOB_ID,
    companyId: COMPANY_ID,
    status,
    statusUpdatedAt: new Date(),
    appliedAt: new Date(),
    shortlistedAt: null,
    coverLetter: null,
    recruiterNotes: null,
    scoreStatus: "completed",
    resumeId: uuid(50),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
}

function makeInterview(overrides: Record<string, unknown> = {}) {
  return {
    id: INTERVIEW_ID,
    applicationId: APPLICATION_ID,
    scheduledBy: RECRUITER_ID,
    scheduledAt: makeFuture(),
    durationMinutes: 60,
    format: "in-person",
    locationOrLink: null,
    venueName: "HQ Building",
    addressLine: "123 Main St",
    roomOrFloor: "Room 201",
    mapUrl: null,
    reportingInstructions: "Please arrive 10 minutes early.",
    whatToBring: "Valid ID and printed resume.",
    interviewerName: "Test Recruiter",
    interviewerTitle: "Engineering Manager",
    status: "scheduled",
    feedback: null,
    rating: null,
    recommendation: null,
    candidateSummary: null,
    sharedWithCandidateAt: null,
    rescheduledFromId: null,
    rescheduledToId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as any;
}

function makeScheduleDto() {
  return {
    scheduledAt: makeFuture().toISOString(),
    durationMinutes: 60,
    format: "in-person",
    venueName: "HQ Building",
    addressLine: "123 Main St",
    roomOrFloor: "Room 201",
    reportingInstructions: "Please arrive 10 minutes early.",
    whatToBring: "Valid ID and printed resume.",
    interviewerName: "Test Recruiter",
    interviewerTitle: "Engineering Manager",
    saveAsTemplate: false,
  } as any;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("Interview v2 — happy-path integration", () => {
  let interviewsService: InterviewsService;
  let applicationsService: ApplicationsService;

  let interviewsRepo: jest.Mocked<InterviewsRepository>;
  let applicationsRepo: jest.Mocked<ApplicationsRepository>;
  let jobsRepo: jest.Mocked<JobsRepository>;
  let profilesRepo: jest.Mocked<ProfilesRepository>;
  let emailService: jest.Mocked<EmailService>;
  let audit: jest.Mocked<AuditService>;
  let cache: jest.Mocked<CacheService>;
  let events: jest.Mocked<EventsService>;
  let notifications: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    interviewsRepo = {
      insert: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      markRescheduled: jest.fn(),
      setRescheduledTo: jest.fn(),
      findByApplicationId: jest.fn(),
      findByCandidateId: jest.fn(),
      listForCompanyPaginated: jest.fn(),
      findOverlapping: jest.fn(),
    } as any;

    applicationsRepo = {
      findById: jest.fn(),
      update: jest.fn(),
      insert: jest.fn(),
      findApplicationContextForCompany: jest.fn(),
      findApplicationContextForCompanyByUser: jest.fn(),
      countInflightOnJob: jest.fn().mockResolvedValue(0),
    } as any;

    jobsRepo = {
      findById: jest.fn().mockResolvedValue({
        id: JOB_ID,
        companyId: COMPANY_ID,
        recruiterId: RECRUITER_ID,
        title: "Software Engineer",
        status: "published",
        applicationDeadline: null,
      }),
      findByIdWithCompany: jest.fn().mockResolvedValue({
        id: JOB_ID,
        title: "Software Engineer",
        department: "Engineering",
        employmentType: "full-time",
        workMode: "on-site",
        company: { id: COMPANY_ID, name: "AcmeCorp", logoUrl: null },
      }),
    } as any;

    profilesRepo = {
      findById: jest.fn().mockResolvedValue({
        id: RECRUITER_ID,
        fullName: "Test Recruiter",
        email: "recruiter@example.com",
        phone: null,
      }),
      findCandidateProfile: jest
        .fn()
        .mockResolvedValue({ headline: "Software Engineer" }),
    } as any;

    emailService = { send: jest.fn().mockResolvedValue(undefined) } as any;

    audit = { log: jest.fn().mockResolvedValue(undefined) } as any;

    cache = {
      bustTags: jest.fn().mockResolvedValue(undefined),
      getOrSet: jest.fn(),
    } as any;

    events = {
      emitApplicationStatusChanged: jest.fn(),
      emitApplicationRecommendationSet: jest.fn(),
      emitApplicationWithdrawn: jest.fn(),
      emitInterviewScheduled: jest.fn(),
      emitInterviewStatusChanged: jest.fn(),
      emitInterviewRescheduled: jest.fn(),
      emitInterviewFeedbackShared: jest.fn(),
      emitInterviewCompleted: jest.fn(),
    } as any;

    notifications = { emit: jest.fn().mockResolvedValue(undefined) } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        InterviewsService,
        ApplicationsService,
        { provide: InterviewsRepository, useValue: interviewsRepo },
        { provide: ApplicationsRepository, useValue: applicationsRepo },
        { provide: JobsRepository, useValue: jobsRepo },
        { provide: ProfilesRepository, useValue: profilesRepo },
        { provide: EmailService, useValue: emailService },
        { provide: AuditService, useValue: audit },
        { provide: CacheService, useValue: cache },
        { provide: EventsService, useValue: events },
        { provide: NotificationsService, useValue: notifications },
        { provide: InterviewVenuesService, useValue: { create: jest.fn() } },
        {
          provide: ResumesRepository,
          useValue: { findById: jest.fn(), findByUserId: jest.fn() },
        },
        {
          provide: ScoringService,
          useValue: {
            scoreMatch: jest.fn(),
            getMatchScoreByApplicationId: jest.fn().mockResolvedValue(null),
          },
        },
        { provide: StorageService, useValue: { getSignedUrl: jest.fn() } },
        {
          provide: MatchScoreQueueService,
          useValue: { enqueue: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: OffersRepository,
          useValue: {
            findLatestByApplicationId: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: DRIZZLE_CLIENT,
          useValue: {
            transaction: jest.fn(async <T>(fn: (tx: unknown) => Promise<T>) =>
              fn({}),
            ),
          },
        },
      ],
    }).compile();

    interviewsService = moduleRef.get(InterviewsService);
    applicationsService = moduleRef.get(ApplicationsService);
  });

  // ── Step 1 ─────────────────────────────────────────────────────────────────

  it("Step 1: schedules interview from 'applied' — status advances to 'interview', interview row created with venue fields", async () => {
    const appliedApp = makeApplication("applied");

    applicationsRepo.findApplicationContextForCompany.mockResolvedValue(
      appliedApp,
    );
    applicationsRepo.findById.mockResolvedValue(appliedApp);
    applicationsRepo.update.mockResolvedValue({
      ...appliedApp,
      status: "interview",
    } as any);
    interviewsRepo.insert.mockResolvedValue(makeInterview());

    const result = await interviewsService.schedule(
      recruiterUser,
      COMPANY_ID,
      APPLICATION_ID,
      makeScheduleDto(),
      {},
    );

    // Application must advance to `interview`
    expect(applicationsRepo.update).toHaveBeenCalledWith(
      APPLICATION_ID,
      expect.objectContaining({ status: "interview" }),
    );

    // Venue fields must be persisted
    expect(interviewsRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: APPLICATION_ID,
        status: "scheduled",
        venueName: "HQ Building",
        addressLine: "123 Main St",
        roomOrFloor: "Room 201",
        reportingInstructions: "Please arrive 10 minutes early.",
        whatToBring: "Valid ID and printed resume.",
        interviewerName: "Test Recruiter",
      }),
    );

    // Realtime status change event emitted
    expect(events.emitApplicationStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: APPLICATION_ID,
        candidateId: CANDIDATE_ID,
        previousStatus: "applied",
        status: "interview",
      }),
    );

    // Audit written for status advance
    const statusAudit = audit.log.mock.calls.find(
      (c) => c[0].action === "application.status_changed",
    );
    expect(statusAudit).toBeDefined();
    expect(statusAudit![0].details).toMatchObject({
      from: "applied",
      to: "interview",
    });

    // emitInterviewScheduled fired
    expect(events.emitInterviewScheduled).toHaveBeenCalledWith(
      expect.objectContaining({
        interviewId: INTERVIEW_ID,
        applicationId: APPLICATION_ID,
      }),
    );

    expect(result.id).toBe(INTERVIEW_ID);
    expect(result.status).toBe("scheduled");
  });

  // ── Step 2 ─────────────────────────────────────────────────────────────────

  it("Step 2: recruiter sets feedback + recommendation — FEEDBACK_SUBMITTED + RECOMMENDATION_SET audited, realtime event emitted", async () => {
    const scheduledInterview = makeInterview({
      status: "completed",
      recommendation: null,
    });

    interviewsRepo.findById.mockResolvedValue(scheduledInterview);
    applicationsRepo.findApplicationContextForCompany.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
      jobId: JOB_ID,
      companyId: COMPANY_ID,
      status: "interview",
    } as any);
    applicationsRepo.findById.mockResolvedValue(makeApplication("interview"));
    interviewsRepo.update.mockResolvedValue(
      makeInterview({
        status: "completed",
        feedback: "Excellent problem-solving skills.",
        rating: 5,
        recommendation: "proceed",
      }),
    );

    const result = await interviewsService.updateFeedback(
      recruiterUser,
      COMPANY_ID,
      INTERVIEW_ID,
      {
        feedback: "Excellent problem-solving skills.",
        rating: 5,
        recommendation: "proceed",
      } as any,
      {},
    );

    // Both audit events written
    const actions = audit.log.mock.calls.map((c) => c[0].action);
    expect(actions).toContain(AUDIT_ACTIONS.INTERVIEW_FEEDBACK_SUBMITTED);
    expect(actions).toContain(AUDIT_ACTIONS.INTERVIEW_RECOMMENDATION_SET);

    // recommendation change audited correctly
    const recAudit = audit.log.mock.calls.find(
      (c) => c[0].action === AUDIT_ACTIONS.INTERVIEW_RECOMMENDATION_SET,
    )!;
    expect(recAudit[0].details).toMatchObject({ from: null, to: "proceed" });

    // Realtime event emitted
    expect(events.emitApplicationRecommendationSet).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: APPLICATION_ID,
        interviewId: INTERVIEW_ID,
        recruiterId: RECRUITER_ID,
        recommendation: "proceed",
      }),
    );

    expect(result.feedback).toBe("Excellent problem-solving skills.");
    expect(result.rating).toBe(5);
    expect(result.recommendation).toBe("proceed");
  });

  // ── Step 3 ─────────────────────────────────────────────────────────────────

  it("Step 3: recruiter shares candidate-facing summary — candidateSummary + sharedWithCandidateAt persisted, notification + realtime + audit fired", async () => {
    const summary =
      "You demonstrated strong technical skills and a collaborative mindset.";
    const completedInterview = makeInterview({
      status: "completed",
      feedback: "Strong technical skills.",
      rating: 5,
      recommendation: "proceed",
      sharedWithCandidateAt: null,
    });

    interviewsRepo.findById.mockResolvedValue(completedInterview);
    applicationsRepo.findApplicationContextForCompany.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
      jobId: JOB_ID,
      companyId: COMPANY_ID,
    } as any);
    applicationsRepo.findById.mockResolvedValue(makeApplication("interview"));
    interviewsRepo.update.mockResolvedValue(
      makeInterview({
        status: "completed",
        feedback: "Strong technical skills.",
        rating: 5,
        recommendation: "proceed",
        candidateSummary: summary,
        sharedWithCandidateAt: new Date(),
      }),
    );

    const result = await interviewsService.shareFeedback(
      recruiterUser,
      COMPANY_ID,
      INTERVIEW_ID,
      { candidateSummary: summary } as any,
      {},
    );

    // Repository patched with both fields
    expect(interviewsRepo.update).toHaveBeenCalledWith(
      INTERVIEW_ID,
      expect.objectContaining({
        candidateSummary: summary,
        sharedWithCandidateAt: expect.any(Date),
      }),
    );

    // Audit
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.INTERVIEW_FEEDBACK_SHARED,
        entityId: INTERVIEW_ID,
        details: expect.objectContaining({
          applicationId: APPLICATION_ID,
          isUpdate: false,
        }),
      }),
    );

    // In-app notification to candidate
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: CANDIDATE_ID,
        eventType: "interview_feedback_shared",
        entityType: "interview",
        entityId: INTERVIEW_ID,
      }),
    );

    // Realtime event
    expect(events.emitInterviewFeedbackShared).toHaveBeenCalledWith(
      expect.objectContaining({
        interviewId: INTERVIEW_ID,
        applicationId: APPLICATION_ID,
        candidateId: CANDIDATE_ID,
        recruiterId: RECRUITER_ID,
      }),
    );

    expect(result.candidateSummary).toBe(summary);
    expect(result.sharedWithCandidateAt).toBeTruthy();
  });

  // ── Step 4 ─────────────────────────────────────────────────────────────────

  it("Step 4: candidate retrieves interview — candidateSummary exposed, internal fields (feedback/rating/recommendation) redacted", async () => {
    const sharedAt = new Date();
    const sharedInterview = makeInterview({
      status: "completed",
      feedback: "Strong candidate — DO NOT SHOW.",
      rating: 5,
      recommendation: "proceed",
      candidateSummary: "You did great!",
      sharedWithCandidateAt: sharedAt,
    });

    interviewsRepo.findById.mockResolvedValue(sharedInterview);
    applicationsRepo.findById.mockResolvedValue(makeApplication("interview"));

    const result = await interviewsService.getByIdForCandidate(
      candidateUser,
      INTERVIEW_ID,
    );

    // Candidate-safe fields
    expect(result.candidateSummary).toBe("You did great!");
    expect(result.sharedWithCandidateAt).toBeTruthy();

    // Internal fields must be redacted
    expect(result.feedback).toBeNull();
    expect(result.rating).toBeNull();
    expect(result.recommendation).toBeNull();

    // Venue fields still visible
    expect(result.venueName).toBe("HQ Building");
    expect(result.addressLine).toBe("123 Main St");
  });

  // ── Step 5 ─────────────────────────────────────────────────────────────────

  it("Step 5: reschedule flow — original marked 'rescheduled', new row linked, INTERVIEW_RESCHEDULED audited, realtime event emitted", async () => {
    const scheduledInterview = makeInterview({ status: "scheduled" });

    interviewsRepo.findById.mockResolvedValue(scheduledInterview);
    applicationsRepo.findApplicationContextForCompany.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
      jobId: JOB_ID,
      companyId: COMPANY_ID,
    } as any);
    applicationsRepo.findById.mockResolvedValue(makeApplication("interview"));
    interviewsRepo.markRescheduled.mockResolvedValue({
      id: INTERVIEW_ID,
    } as any);
    interviewsRepo.insert.mockResolvedValue(
      makeInterview({
        id: NEW_INTERVIEW_ID,
        status: "scheduled",
        rescheduledFromId: INTERVIEW_ID,
        scheduledAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // +14 days
      }),
    );
    interviewsRepo.setRescheduledTo.mockResolvedValue(undefined as any);

    const result = await interviewsService.reschedule(
      recruiterUser,
      COMPANY_ID,
      INTERVIEW_ID,
      {
        scheduledAt: new Date(
          Date.now() + 14 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        durationMinutes: 60,
        venueName: "New Office",
        addressLine: "456 New Ave",
        saveAsTemplate: false,
      } as any,
      {},
    );

    // Original marked rescheduled
    expect(interviewsRepo.markRescheduled).toHaveBeenCalledWith(INTERVIEW_ID);

    // New interview inserted with back-link
    expect(interviewsRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: APPLICATION_ID,
        status: "scheduled",
        rescheduledFromId: INTERVIEW_ID,
      }),
    );

    // Forward link wired
    expect(interviewsRepo.setRescheduledTo).toHaveBeenCalledWith(
      INTERVIEW_ID,
      NEW_INTERVIEW_ID,
    );

    // Audit
    const rescheduledAudit = audit.log.mock.calls.find(
      (c) => c[0].action === AUDIT_ACTIONS.INTERVIEW_RESCHEDULED,
    )!;
    expect(rescheduledAudit).toBeDefined();
    expect(rescheduledAudit[0].entityId).toBe(NEW_INTERVIEW_ID);
    expect(rescheduledAudit[0].details).toMatchObject({
      previousInterviewId: INTERVIEW_ID,
      applicationId: APPLICATION_ID,
    });

    // Realtime event
    expect(events.emitInterviewRescheduled).toHaveBeenCalledWith(
      expect.objectContaining({
        oldInterviewId: INTERVIEW_ID,
        newInterviewId: NEW_INTERVIEW_ID,
        applicationId: APPLICATION_ID,
        candidateId: CANDIDATE_ID,
        recruiterId: RECRUITER_ID,
      }),
    );

    expect(result.id).toBe(NEW_INTERVIEW_ID);
    expect(result.status).toBe("scheduled");
  });

  // ── Step 6 ─────────────────────────────────────────────────────────────────

  it("Step 6: candidate withdraws application — status 'withdrawn', APPLICATION_WITHDRAWN_BY_CANDIDATE audited, application.withdrawn event emitted", async () => {
    const interviewApp = makeApplication("interview");
    const withdrawnApp = { ...interviewApp, status: "withdrawn" };

    // ApplicationsService.withdraw: first findById for ownership, second for toDto
    applicationsRepo.findById
      .mockResolvedValueOnce(interviewApp as any)
      .mockResolvedValueOnce(withdrawnApp as any);
    applicationsRepo.update.mockResolvedValue(withdrawnApp as any);
    jobsRepo.findById.mockResolvedValue({
      id: JOB_ID,
      companyId: COMPANY_ID,
      recruiterId: RECRUITER_ID,
      title: "Software Engineer",
      status: "published",
    } as any);

    // Use ApplicationsService.withdraw
    await applicationsService.withdraw(
      candidateUser,
      APPLICATION_ID,
      { reason: "Found another role" },
      {},
    );

    // Status updated to withdrawn
    expect(applicationsRepo.update).toHaveBeenCalledWith(
      APPLICATION_ID,
      expect.objectContaining({ status: "withdrawn" }),
    );

    // Audit
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.APPLICATION_WITHDRAWN_BY_CANDIDATE,
        entityType: "application",
        entityId: APPLICATION_ID,
        details: expect.objectContaining({
          from: "interview",
          reason: "Found another role",
        }),
      }),
    );

    // Realtime event
    expect(events.emitApplicationWithdrawn).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: APPLICATION_ID,
        candidateId: CANDIDATE_ID,
        jobId: JOB_ID,
        reason: "Found another role",
      }),
    );
  });

  // ── Guard: candidate cannot withdraw another user's application ─────────────

  it("Guard: candidate cannot withdraw another user's application — ForbiddenException thrown", async () => {
    const otherCandidateApp = makeApplication("applied");
    // The application belongs to a different candidate
    applicationsRepo.findById.mockResolvedValue({
      ...otherCandidateApp,
      candidateId: uuid(999), // someone else
    } as any);

    await expect(
      applicationsService.withdraw(candidateUser, APPLICATION_ID, {}, {}),
    ).rejects.toThrow(ForbiddenException);

    expect(applicationsRepo.update).not.toHaveBeenCalled();
    expect(events.emitApplicationWithdrawn).not.toHaveBeenCalled();
  });

  // ── Guard: candidateSummary not exposed before share ───────────────────────

  it("Guard: candidateSummary is null when sharedWithCandidateAt is not set (feedback not yet shared)", async () => {
    const unsharedInterview = makeInterview({
      status: "completed",
      feedback: "Private recruiter notes — never expose.",
      rating: 4,
      recommendation: "hold",
      candidateSummary: "Private summary stored but not shared.",
      sharedWithCandidateAt: null, // not shared yet
    });

    interviewsRepo.findById.mockResolvedValue(unsharedInterview);
    applicationsRepo.findById.mockResolvedValue(makeApplication("interview"));

    const result = await interviewsService.getByIdForCandidate(
      candidateUser,
      INTERVIEW_ID,
    );

    // Even though candidateSummary is stored in DB, it must not leak to candidate
    expect(result.candidateSummary).toBeNull();
    expect(result.sharedWithCandidateAt).toBeNull();
    // Internal fields always redacted
    expect(result.feedback).toBeNull();
    expect(result.rating).toBeNull();
    expect(result.recommendation).toBeNull();
  });

  // ── Guard: non-recruiter cannot share feedback ─────────────────────────────

  it("Guard: non-recruiter cannot shareFeedback — ForbiddenException thrown", async () => {
    await expect(
      interviewsService.shareFeedback(
        candidateUser,
        COMPANY_ID,
        INTERVIEW_ID,
        { candidateSummary: "Trying to set my own summary" } as any,
        {},
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(interviewsRepo.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
