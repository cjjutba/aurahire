/**
 * Unit tests for InterviewsService.updateFeedback
 *
 * Covers:
 *  1. Persists recommendation, audits FEEDBACK_SUBMITTED + RECOMMENDATION_SET, and emits
 *     the realtime event when the recommendation value changes.
 *  2. Does NOT emit or audit RECOMMENDATION_SET when the recommendation value is unchanged.
 *
 * No database is hit — all dependencies are mocked.
 */

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const RECRUITER_ID = uuid(1);
const COMPANY_ID = uuid(10);
const INTERVIEW_ID = uuid(50);
const APPLICATION_ID = uuid(100);
const CANDIDATE_ID = uuid(200);
const JOB_ID = uuid(300);

const recruiterUser = {
  id: RECRUITER_ID,
  role: "recruiter",
  email: "recruiter@example.com",
  status: "active",
  fullName: "Test Recruiter",
  profileCompleted: true,
} as any;

function makeBaseInterview(recommendation: string | null = null) {
  return {
    id: INTERVIEW_ID,
    applicationId: APPLICATION_ID,
    scheduledBy: RECRUITER_ID,
    status: "completed",
    recommendation,
    scheduledAt: new Date(),
    durationMinutes: 60,
    format: "in-person",
    locationOrLink: null,
    feedback: null,
    rating: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
}

function makeUpdatedInterview(recommendation: string | null) {
  return {
    ...makeBaseInterview(recommendation),
    feedback: "Strong candidate",
    rating: 5,
  } as any;
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("InterviewsService.updateFeedback", () => {
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
      ],
    }).compile();

    service = moduleRef.get(InterviewsService);
  });

  it("persists recommendation, audits FEEDBACK_SUBMITTED + RECOMMENDATION_SET when changed, emits realtime", async () => {
    // Interview currently has no recommendation (null).
    repo.findById.mockResolvedValue(makeBaseInterview(null));
    applicationsRepo.findApplicationContextForCompany.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
      jobId: JOB_ID,
      companyId: COMPANY_ID,
    } as any);
    repo.update.mockResolvedValue(makeUpdatedInterview("proceed"));
    applicationsRepo.findById.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
    } as any);

    await service.updateFeedback(
      recruiterUser,
      COMPANY_ID,
      INTERVIEW_ID,
      { feedback: "Strong candidate", rating: 5, recommendation: "proceed" } as any,
      {},
    );

    // 1. Repository must receive recommendation in the patch.
    expect(repo.update).toHaveBeenCalledWith(
      INTERVIEW_ID,
      expect.objectContaining({ feedback: "Strong candidate", rating: 5, recommendation: "proceed" }),
    );

    // 2. Both audit actions must be logged.
    const auditActions = audit.log.mock.calls.map((c) => c[0].action);
    expect(auditActions).toContain(AUDIT_ACTIONS.INTERVIEW_FEEDBACK_SUBMITTED);
    expect(auditActions).toContain(AUDIT_ACTIONS.INTERVIEW_RECOMMENDATION_SET);

    // 3. Realtime event must be emitted with correct payload.
    expect(events.emitApplicationRecommendationSet).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: APPLICATION_ID,
        interviewId: INTERVIEW_ID,
        recruiterId: RECRUITER_ID,
        recommendation: "proceed",
      }),
    );
  });

  it("does NOT emit recommendationSet when recommendation is unchanged", async () => {
    // Interview already has recommendation "proceed".
    repo.findById.mockResolvedValue(makeBaseInterview("proceed"));
    applicationsRepo.findApplicationContextForCompany.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
      jobId: JOB_ID,
      companyId: COMPANY_ID,
    } as any);
    repo.update.mockResolvedValue({
      ...makeUpdatedInterview("proceed"),
      feedback: "Updated notes",
      rating: 4,
    } as any);
    applicationsRepo.findById.mockResolvedValue({
      id: APPLICATION_ID,
      candidateId: CANDIDATE_ID,
    } as any);

    await service.updateFeedback(
      recruiterUser,
      COMPANY_ID,
      INTERVIEW_ID,
      { feedback: "Updated notes", rating: 4, recommendation: "proceed" } as any,
      {},
    );

    // RECOMMENDATION_SET must NOT be audited.
    const auditActions = audit.log.mock.calls.map((c) => c[0].action);
    expect(auditActions).toContain(AUDIT_ACTIONS.INTERVIEW_FEEDBACK_SUBMITTED);
    expect(auditActions).not.toContain(AUDIT_ACTIONS.INTERVIEW_RECOMMENDATION_SET);

    // Realtime event must NOT be emitted.
    expect(events.emitApplicationRecommendationSet).not.toHaveBeenCalled();
  });
});
