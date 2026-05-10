/**
 * Unit tests for ApplicationsService notification emissions (Plan Tasks 13 & 14).
 *
 * Covers:
 *  1. apply()         — emits 'new_application_received' to the recruiter team
 *                       via emitMany.
 *  2. updateStatus()  — emits 'application_status_changed' to the candidate
 *                       on every transition (the shared post-write path).
 *  3. transitionFromSystem() — emits 'application_status_changed' to the
 *                              candidate when status moves due to a system
 *                              actor (e.g. offer flow).
 *
 * No database is hit — all dependencies are mocked.
 */

import { Test } from "@nestjs/testing";

import { ApplicationsService } from "./applications.service";
import { ApplicationsRepository } from "./applications.repository";
import { JobsRepository } from "../jobs/jobs.repository";
import { NotificationsService } from "../notifications/notifications.service";
import { ProfilesRepository } from "../profiles/profiles.repository";
import { ResumesRepository } from "../resumes/resumes.repository";
import { ScoringService } from "../scoring/scoring.service";
import { StorageService } from "../../storage/storage.service";
import { EmailService } from "../../email/email.service";
import { AuditService } from "../../audit";
import { CacheService } from "../../cache";
import { EventsService } from "../../realtime";
import { MatchScoreQueueService } from "../../queue/match-score-queue.service";
import { OffersRepository } from "../offers/offers.repository";
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
const RESUME_ID = uuid(50);

const candidateUser = {
  id: CANDIDATE_ID,
  role: "candidate",
  email: "candidate@example.com",
  status: "active",
  fullName: "Test Candidate",
  profileCompleted: true,
} as any;

const recruiterUser = {
  id: RECRUITER_ID,
  role: "recruiter",
  email: "recruiter@example.com",
  status: "active",
  fullName: "Test Recruiter",
  profileCompleted: true,
} as any;

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    companyId: COMPANY_ID,
    recruiterId: RECRUITER_ID,
    title: "Software Engineer",
    department: "Engineering",
    experienceLevel: "mid",
    educationRequirement: null,
    requiredSkills: [],
    descriptionPlain: "Build things.",
    employmentType: "full-time",
    workMode: "on-site",
    status: "published",
    applicationDeadline: null,
    ...overrides,
  } as any;
}

function makeApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: APPLICATION_ID,
    jobId: JOB_ID,
    candidateId: CANDIDATE_ID,
    resumeId: RESUME_ID,
    coverLetter: null,
    status: "applied",
    statusUpdatedAt: new Date(),
    appliedAt: new Date(),
    shortlistedAt: null,
    recruiterNotes: null,
    scoreStatus: "completed",
    createdAt: new Date(),
    ...overrides,
  } as any;
}

// ── Suite ───────────────────────────────────────────────────────────────────

describe("ApplicationsService — notification emissions", () => {
  let service: ApplicationsService;
  let repo: jest.Mocked<ApplicationsRepository>;
  let jobsRepo: jest.Mocked<JobsRepository>;
  let profilesRepo: jest.Mocked<ProfilesRepository>;
  let resumesRepo: jest.Mocked<ResumesRepository>;
  let scoring: jest.Mocked<ScoringService>;
  let storage: jest.Mocked<StorageService>;
  let email: jest.Mocked<EmailService>;
  let audit: jest.Mocked<AuditService>;
  let cache: jest.Mocked<CacheService>;
  let events: jest.Mocked<EventsService>;
  let matchScoreQueue: jest.Mocked<MatchScoreQueueService>;
  let notifications: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    repo = {
      findById: jest.fn(),
      findExisting: jest.fn().mockResolvedValue(null),
      insert: jest.fn(),
      update: jest.fn().mockResolvedValue(makeApplication()),
      findByCandidateId: jest.fn(),
      findByJobIdSortedByMatchScore: jest.fn(),
      findApplicationContextForCompany: jest.fn(),
      setShortlistedAt: jest.fn(),
      listShortlistedForCompany: jest.fn(),
      listAllForCompany: jest.fn(),
      listRecentForCompany: jest.fn(),
      companyStats: jest.fn(),
      companyTopJobsByApplications: jest.fn(),
      companyApplicationsByStatus: jest.fn(),
    } as any;

    jobsRepo = {
      findById: jest.fn(),
      findByIdWithCompany: jest.fn().mockResolvedValue({
        id: JOB_ID,
        title: "Software Engineer",
        department: "Engineering",
        employmentType: "full-time",
        workMode: "on-site",
        recruiterId: RECRUITER_ID,
        companyId: COMPANY_ID,
        company: { id: COMPANY_ID, name: "AcmeCorp", logoUrl: null },
      }),
    } as any;

    profilesRepo = {
      findById: jest.fn().mockResolvedValue({
        id: CANDIDATE_ID,
        fullName: "Test Candidate",
        email: "candidate@example.com",
        phone: null,
      }),
      findCandidateProfile: jest.fn().mockResolvedValue({ headline: null }),
    } as any;

    resumesRepo = {
      findById: jest.fn().mockResolvedValue({
        id: RESUME_ID,
        candidateId: CANDIDATE_ID,
        parseStatus: "parsed",
        storagePath: "candidate/resume.pdf",
      }),
      findDefaultByCandidateId: jest.fn(),
    } as any;

    scoring = {
      tryPromoteMatchPreview: jest.fn().mockResolvedValue(null),
      getMatchScoreByApplicationId: jest.fn().mockResolvedValue(null),
      scoreMatch: jest.fn(),
    } as any;

    storage = {
      signedUrl: jest.fn(),
    } as any;

    email = { send: jest.fn().mockResolvedValue(undefined) } as any;

    audit = { log: jest.fn().mockResolvedValue(undefined) } as any;

    cache = {
      bustTags: jest.fn().mockResolvedValue(undefined),
      getOrSet: jest.fn(),
    } as any;

    events = {
      emitApplicationCreated: jest.fn(),
      emitApplicationScored: jest.fn(),
      emitApplicationStatusChanged: jest.fn(),
      emitApplicationWithdrawn: jest.fn(),
    } as any;

    matchScoreQueue = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    } as any;

    notifications = {
      emit: jest.fn().mockResolvedValue(undefined),
      emitMany: jest.fn().mockResolvedValue(undefined),
    } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: ApplicationsRepository, useValue: repo },
        { provide: JobsRepository, useValue: jobsRepo },
        { provide: ProfilesRepository, useValue: profilesRepo },
        { provide: ResumesRepository, useValue: resumesRepo },
        { provide: ScoringService, useValue: scoring },
        { provide: StorageService, useValue: storage },
        { provide: EmailService, useValue: email },
        { provide: AuditService, useValue: audit },
        { provide: CacheService, useValue: cache },
        { provide: EventsService, useValue: events },
        { provide: MatchScoreQueueService, useValue: matchScoreQueue },
        { provide: NotificationsService, useValue: notifications },
        { provide: OffersRepository, useValue: { findLatestByApplicationId: jest.fn() } },
        { provide: DRIZZLE_CLIENT, useValue: { transaction: jest.fn(async <T>(fn: (tx: unknown) => Promise<T>) => fn({})) } },
      ],
    }).compile();

    service = moduleRef.get(ApplicationsService);
  });

  // ── Task 14 — apply() emits new_application_received ────────────────────

  it("apply() emits 'new_application_received' to the recruiter team via emitMany", async () => {
    jobsRepo.findById.mockResolvedValue(makeJob());
    repo.insert.mockResolvedValue(makeApplication());
    repo.findById.mockResolvedValue(makeApplication());

    await service.apply(candidateUser, { jobId: JOB_ID, resumeId: RESUME_ID } as any);

    // emitMany must be called with the recruiter team (single recruiter today)
    // and the new_application_received envelope.
    expect(notifications.emitMany).toHaveBeenCalledWith(
      expect.arrayContaining([RECRUITER_ID]),
      expect.objectContaining({
        eventType: "new_application_received",
        entityType: "application",
        entityId: APPLICATION_ID,
        actorId: CANDIDATE_ID,
        metadata: expect.objectContaining({
          applicationId: APPLICATION_ID,
          jobId: JOB_ID,
          candidateId: CANDIDATE_ID,
          occurredAt: expect.any(String),
        }),
      }),
    );
  });

  // ── Task 13 — updateStatus() emits application_status_changed ────────────

  it("updateStatus() emits 'application_status_changed' to the candidate with metadata", async () => {
    const appBefore = makeApplication({ status: "applied" });
    repo.findById.mockResolvedValue(appBefore);
    jobsRepo.findById.mockResolvedValue(makeJob());

    await service.updateStatus(
      recruiterUser,
      COMPANY_ID,
      APPLICATION_ID,
      { newStatus: "screening" } as any,
    );

    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: CANDIDATE_ID,
        eventType: "application_status_changed",
        entityType: "application",
        entityId: APPLICATION_ID,
        actorId: RECRUITER_ID,
        metadata: expect.objectContaining({
          applicationId: APPLICATION_ID,
          jobId: JOB_ID,
          fromStatus: "applied",
          toStatus: "screening",
          occurredAt: expect.any(String),
        }),
      }),
    );
  });

  // ── Task 13 — transitionFromSystem() also emits ────────────────────────

  it("transitionFromSystem() emits 'application_status_changed' to the candidate (system path)", async () => {
    const appBefore = makeApplication({ status: "interview" });
    repo.findById.mockResolvedValue(appBefore);
    jobsRepo.findById.mockResolvedValue(makeJob());

    await service.transitionFromSystem(
      recruiterUser,
      APPLICATION_ID,
      "offer" as any,
      "Offer sent",
    );

    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: CANDIDATE_ID,
        eventType: "application_status_changed",
        entityType: "application",
        entityId: APPLICATION_ID,
        actorId: RECRUITER_ID,
        metadata: expect.objectContaining({
          applicationId: APPLICATION_ID,
          jobId: JOB_ID,
          fromStatus: "interview",
          toStatus: "offer",
          system: true,
        }),
      }),
    );
  });
});
