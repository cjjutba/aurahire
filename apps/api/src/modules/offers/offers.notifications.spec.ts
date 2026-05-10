/**
 * Unit tests for OffersService notification emissions (Plan Task 15).
 *
 * Covers:
 *  1. accept()  — emits 'offer_accepted'  to the recruiter team via emitMany.
 *  2. decline() — emits 'offer_declined'  to the recruiter team via emitMany.
 *
 * No database is hit — all dependencies are mocked.
 */

import { Test } from "@nestjs/testing";

import { OffersService } from "./offers.service";
import { OffersRepository } from "./offers.repository";
import { ApplicationsRepository } from "../applications/applications.repository";
import { ApplicationsService } from "../applications/applications.service";
import { JobsRepository } from "../jobs/jobs.repository";
import { NotificationsService } from "../notifications/notifications.service";
import { ProfilesRepository } from "../profiles/profiles.repository";
import { EmailService } from "../../email/email.service";
import { AuditService } from "../../audit";
import { EventsService } from "../../realtime";
import { DRIZZLE_CLIENT } from "../../db/db.module";

// ── Test IDs ────────────────────────────────────────────────────────────────

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const CANDIDATE_ID = uuid(1);
const RECRUITER_ID = uuid(2);
const COMPANY_ID = uuid(10);
const JOB_ID = uuid(20);
const APPLICATION_ID = uuid(100);
const OFFER_ID = uuid(500);

const candidateUser = {
  id: CANDIDATE_ID,
  role: "candidate",
  email: "candidate@example.com",
  status: "active",
  fullName: "Test Candidate",
  profileCompleted: true,
} as any;

function makeOffer(overrides: Record<string, unknown> = {}) {
  return {
    id: OFFER_ID,
    applicationId: APPLICATION_ID,
    sentBy: RECRUITER_ID,
    title: "Senior Software Engineer",
    salary: "150000",
    salaryCurrency: "USD",
    startDate: new Date("2026-06-01"),
    managerName: null,
    benefitsSummary: null,
    customMessage: null,
    status: "pending",
    sentAt: new Date(),
    respondedAt: null,
    expiresAt: null,
    ...overrides,
  } as any;
}

function makeApplication() {
  return {
    id: APPLICATION_ID,
    jobId: JOB_ID,
    candidateId: CANDIDATE_ID,
    companyId: COMPANY_ID,
    status: "offer",
    statusUpdatedAt: new Date(),
    appliedAt: new Date(),
    shortlistedAt: null,
    coverLetter: null,
    recruiterNotes: null,
    scoreStatus: "completed",
    resumeId: uuid(50),
  } as any;
}

function makeJob() {
  return {
    id: JOB_ID,
    companyId: COMPANY_ID,
    recruiterId: RECRUITER_ID,
    title: "Senior Software Engineer",
  } as any;
}

function fakeDb() {
  return {
    transaction: jest.fn(async <T>(fn: (tx: unknown) => Promise<T>) => fn({})),
  };
}

// ── Suite ───────────────────────────────────────────────────────────────────

describe("OffersService — accept/decline notifications", () => {
  let service: OffersService;
  let repo: jest.Mocked<OffersRepository>;
  let applicationsRepo: jest.Mocked<ApplicationsRepository>;
  let applicationsService: jest.Mocked<ApplicationsService>;
  let jobsRepo: jest.Mocked<JobsRepository>;
  let profilesRepo: jest.Mocked<ProfilesRepository>;
  let email: jest.Mocked<EmailService>;
  let audit: jest.Mocked<AuditService>;
  let events: jest.Mocked<EventsService>;
  let notifications: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    repo = {
      findById: jest.fn(),
      findPendingByApplicationId: jest.fn(),
      findByCandidateId: jest.fn(),
      findByApplicationId: jest.fn(),
      insert: jest.fn(),
      update: jest.fn().mockResolvedValue(makeOffer()),
    } as any;

    applicationsRepo = {
      findById: jest.fn().mockResolvedValue(makeApplication()),
      findApplicationContextForCompany: jest.fn(),
      findByIdForUpdate: jest.fn().mockResolvedValue(makeApplication()),
    } as any;

    applicationsService = {
      transitionFromSystem: jest.fn().mockResolvedValue(undefined),
    } as any;

    jobsRepo = {
      findById: jest.fn().mockResolvedValue(makeJob()),
      findByIdWithCompany: jest.fn().mockResolvedValue({
        id: JOB_ID,
        companyId: COMPANY_ID,
        recruiterId: RECRUITER_ID,
        title: "Senior Software Engineer",
        company: { id: COMPANY_ID, name: "AcmeCorp", logoUrl: null },
      }),
    } as any;

    profilesRepo = {
      findById: jest.fn().mockResolvedValue({
        id: CANDIDATE_ID,
        fullName: "Test Candidate",
        email: "candidate@example.com",
      }),
    } as any;

    email = { send: jest.fn().mockResolvedValue(undefined) } as any;
    audit = { log: jest.fn().mockResolvedValue(undefined) } as any;

    events = {
      emitOfferSent: jest.fn(),
    } as any;

    notifications = {
      emit: jest.fn().mockResolvedValue(undefined),
      emitMany: jest.fn().mockResolvedValue(undefined),
    } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        OffersService,
        { provide: OffersRepository, useValue: repo },
        { provide: ApplicationsRepository, useValue: applicationsRepo },
        { provide: ApplicationsService, useValue: applicationsService },
        { provide: JobsRepository, useValue: jobsRepo },
        { provide: ProfilesRepository, useValue: profilesRepo },
        { provide: EmailService, useValue: email },
        { provide: AuditService, useValue: audit },
        { provide: EventsService, useValue: events },
        { provide: NotificationsService, useValue: notifications },
        { provide: DRIZZLE_CLIENT, useValue: fakeDb() },
      ],
    }).compile();

    service = moduleRef.get(OffersService);
  });

  // ── Task 15 — accept emits offer_accepted ──────────────────────────────

  it("accept() emits 'offer_accepted' to the recruiter team via emitMany", async () => {
    repo.findById.mockResolvedValue(makeOffer({ status: "pending" }));
    repo.update.mockResolvedValue(makeOffer({ status: "accepted", respondedAt: new Date() }));

    await service.accept(candidateUser, OFFER_ID);

    expect(notifications.emitMany).toHaveBeenCalledWith(
      expect.arrayContaining([RECRUITER_ID]),
      expect.objectContaining({
        eventType: "offer_accepted",
        entityType: "offer",
        entityId: OFFER_ID,
        actorId: CANDIDATE_ID,
        metadata: expect.objectContaining({
          offerId: OFFER_ID,
          applicationId: APPLICATION_ID,
          candidateId: CANDIDATE_ID,
          // Required so the template renders "<name> accepted your offer
          // — <jobTitle>" without using "Candidate"/"your role" fallbacks.
          candidateName: "Test Candidate",
          jobId: JOB_ID,
          jobTitle: "Senior Software Engineer",
          occurredAt: expect.any(String),
        }),
      }),
    );
  });

  // ── Task 15 — decline emits offer_declined ─────────────────────────────

  it("decline() emits 'offer_declined' to the recruiter team via emitMany", async () => {
    repo.findById.mockResolvedValue(makeOffer({ status: "pending" }));
    repo.update.mockResolvedValue(makeOffer({ status: "declined", respondedAt: new Date() }));

    await service.decline(candidateUser, OFFER_ID, { reason: "Other offer" } as any);

    expect(notifications.emitMany).toHaveBeenCalledWith(
      expect.arrayContaining([RECRUITER_ID]),
      expect.objectContaining({
        eventType: "offer_declined",
        entityType: "offer",
        entityId: OFFER_ID,
        actorId: CANDIDATE_ID,
        metadata: expect.objectContaining({
          offerId: OFFER_ID,
          applicationId: APPLICATION_ID,
          candidateId: CANDIDATE_ID,
          candidateName: "Test Candidate",
          jobId: JOB_ID,
          jobTitle: "Senior Software Engineer",
        }),
      }),
    );
  });
});
