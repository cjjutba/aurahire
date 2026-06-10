/**
 * Unit tests for InterviewsService.schedule() v2 - venue + guidance + interviewer fields.
 *
 * Covers:
 *  1. schedule() persists all structured venue + guidance + interviewer fields via repo.insert.
 *  2. interviewerName defaults to the scheduling recruiter's fullName when not supplied.
 *  3. mapUrl with a non-http(s) scheme (e.g. javascript:) is rejected with "Invalid map URL".
 *
 * No database is hit - all dependencies are mocked.
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
const APPLICATION_ID = uuid(100);
const CANDIDATE_ID = uuid(200);
const INTERVIEW_ID = uuid(999);

const recruiterUser = {
  id: RECRUITER_ID,
  role: "recruiter",
  email: "recruiter@example.com",
  status: "active",
  fullName: "Test Recruiter",
  profileCompleted: true,
} as any;

function future(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

function makeInterviewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: INTERVIEW_ID,
    applicationId: APPLICATION_ID,
    scheduledBy: RECRUITER_ID,
    scheduledAt: future(),
    durationMinutes: 60,
    format: "in-person",
    locationOrLink: null,
    venueName: "JRMSU Main",
    addressLine: "Dapitan",
    roomOrFloor: "ICT 305",
    mapUrl: "https://maps.google.com/?q=foo",
    reportingInstructions: "Arrive 15 min early.",
    whatToBring: "Valid ID + resume.",
    interviewerName: "Maria Santos",
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

// ── Test suite ────────────────────────────────────────────────────────────────

describe("InterviewsService.schedule() - v2 venue/guidance/interviewer fields", () => {
  let service: InterviewsService;
  let repo: jest.Mocked<InterviewsRepository>;
  let applicationsRepo: jest.Mocked<ApplicationsRepository>;
  let profilesRepo: jest.Mocked<ProfilesRepository>;
  let audit: jest.Mocked<AuditService>;
  let events: jest.Mocked<EventsService>;
  let cache: jest.Mocked<CacheService>;
  let venuesService: { create: jest.Mock };

  beforeEach(async () => {
    repo = {
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
      findApplicationContextForCompany: jest.fn().mockResolvedValue({
        id: APPLICATION_ID,
        candidateId: CANDIDATE_ID,
        jobId: uuid(300),
        companyId: COMPANY_ID,
        status: "applied",
      }),
      findById: jest.fn().mockResolvedValue({
        id: APPLICATION_ID,
        candidateId: CANDIDATE_ID,
        jobId: uuid(300),
        status: "interview",
      }),
      update: jest.fn().mockResolvedValue(undefined),
      findApplicationContextForCompanyByUser: jest.fn(),
    } as any;

    profilesRepo = {
      findById: jest.fn().mockResolvedValue({
        id: RECRUITER_ID,
        fullName: "Test Recruiter",
        email: "recruiter@example.com",
      }),
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

    venuesService = { create: jest.fn().mockResolvedValue({ id: "venue-1" }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        InterviewsService,
        { provide: InterviewsRepository, useValue: repo },
        { provide: ApplicationsRepository, useValue: applicationsRepo },
        {
          provide: JobsRepository,
          useValue: { findById: jest.fn(), findByIdWithCompany: jest.fn() },
        },
        { provide: ProfilesRepository, useValue: profilesRepo },
        { provide: EmailService, useValue: { send: jest.fn() } },
        { provide: AuditService, useValue: audit },
        { provide: CacheService, useValue: cache },
        { provide: EventsService, useValue: events },
        {
          provide: NotificationsService,
          useValue: { emit: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: InterviewVenuesService, useValue: venuesService },
        // Per thesis panel revision (May 2026): score-based interview
        // eligibility gate - return a null score so the gate is a no-op
        // in tests that don't care about scoring.
        {
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

    // Default insert mock - returns a plausible interview row.
    repo.insert.mockResolvedValue(makeInterviewRow());
  });

  it("persists venue + guidance + interviewer fields via repo.insert", async () => {
    await service.schedule(
      recruiterUser,
      COMPANY_ID,
      APPLICATION_ID,
      {
        scheduledAt: future().toISOString(),
        durationMinutes: 60,
        venueName: "JRMSU Main",
        addressLine: "Dapitan",
        roomOrFloor: "ICT 305",
        mapUrl: "https://maps.google.com/?q=foo",
        reportingInstructions: "Arrive 15 min early.",
        whatToBring: "Valid ID + resume.",
        interviewerName: "Maria Santos",
        interviewerTitle: "Engineering Manager",
        saveAsTemplate: false,
      } as any,
      {},
    );

    expect(repo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        venueName: "JRMSU Main",
        addressLine: "Dapitan",
        roomOrFloor: "ICT 305",
        mapUrl: "https://maps.google.com/?q=foo",
        reportingInstructions: "Arrive 15 min early.",
        whatToBring: "Valid ID + resume.",
        interviewerName: "Maria Santos",
        interviewerTitle: "Engineering Manager",
        format: "in-person",
      }),
    );
  });

  it("defaults interviewerName to recruiter's fullName when omitted", async () => {
    profilesRepo.findById.mockResolvedValue({
      id: RECRUITER_ID,
      fullName: "Recruiter R",
      email: "r@example.com",
    } as any);

    repo.insert.mockResolvedValue(
      makeInterviewRow({
        interviewerName: "Recruiter R",
        interviewerTitle: null,
      }),
    );

    await service.schedule(
      recruiterUser,
      COMPANY_ID,
      APPLICATION_ID,
      {
        scheduledAt: future().toISOString(),
        durationMinutes: 60,
        venueName: "JRMSU",
        addressLine: "Dapitan",
        saveAsTemplate: false,
      } as any,
      {},
    );

    expect(repo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ interviewerName: "Recruiter R" }),
    );
  });

  it("sanitizes mapUrl rejecting non-http schemes (javascript:)", async () => {
    await expect(
      service.schedule(
        recruiterUser,
        COMPANY_ID,
        APPLICATION_ID,
        {
          scheduledAt: future().toISOString(),
          durationMinutes: 60,
          venueName: "X",
          addressLine: "Y",
          mapUrl: "javascript:alert(1)",
          saveAsTemplate: false,
        } as any,
        {},
      ),
    ).rejects.toThrow(/Invalid map URL/);

    // repo.insert must NOT be called when mapUrl is invalid.
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it("saves venue as template when saveAsTemplate=true and templateLabel is set", async () => {
    await service.schedule(
      recruiterUser,
      COMPANY_ID,
      APPLICATION_ID,
      {
        scheduledAt: future().toISOString(),
        durationMinutes: 60,
        venueName: "JRMSU Main",
        addressLine: "Dapitan",
        saveAsTemplate: true,
        templateLabel: "JRMSU - ICT Building",
      } as any,
      {},
    );

    expect(venuesService.create).toHaveBeenCalledWith(
      recruiterUser,
      COMPANY_ID,
      expect.objectContaining({
        label: "JRMSU - ICT Building",
        venueName: "JRMSU Main",
        addressLine: "Dapitan",
      }),
      expect.anything(),
    );
  });

  it("does not call venuesService when saveAsTemplate=false", async () => {
    await service.schedule(
      recruiterUser,
      COMPANY_ID,
      APPLICATION_ID,
      {
        scheduledAt: future().toISOString(),
        durationMinutes: 60,
        venueName: "X",
        addressLine: "Y",
        saveAsTemplate: false,
      } as any,
      {},
    );

    expect(venuesService.create).not.toHaveBeenCalled();
  });

  it("schedule succeeds even if template save throws", async () => {
    venuesService.create.mockRejectedValueOnce(new Error("unique violation"));

    const result = await service.schedule(
      recruiterUser,
      COMPANY_ID,
      APPLICATION_ID,
      {
        scheduledAt: future().toISOString(),
        durationMinutes: 60,
        venueName: "X",
        addressLine: "Y",
        saveAsTemplate: true,
        templateLabel: "Existing",
      } as any,
      {},
    );

    expect(result).toBeDefined();
  });
});
