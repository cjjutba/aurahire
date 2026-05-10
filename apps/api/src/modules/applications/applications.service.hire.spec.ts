import { Test, TestingModule } from "@nestjs/testing";
import { ApplicationsService } from "./applications.service";
import { ApplicationsRepository } from "./applications.repository";
import { JobsRepository } from "../jobs/jobs.repository";
import { OffersRepository } from "../offers/offers.repository";
import { AuditService } from "../../audit";
import { CacheService } from "../../cache";
import { EventsService } from "../../realtime";
import { EmailService } from "../../email/email.service";
import { MatchScoreQueueService } from "../../queue/match-score-queue.service";
import { ProfilesRepository } from "../profiles/profiles.repository";
import { ResumesRepository } from "../resumes/resumes.repository";
import { ScoringService } from "../scoring/scoring.service";
import { StorageService } from "../../storage/storage.service";
import { NotificationsService } from "../notifications/notifications.service";
import { DRIZZLE_CLIENT } from "../../db/db.module";
import { BadRequestException } from "@nestjs/common";

function makeRepoMock() {
  return {
    findById: jest.fn(),
    update: jest.fn(),
    findByIdForUpdate: jest.fn(),
    findInflightByJobId: jest.fn(),
    countInflightOnJob: jest.fn().mockResolvedValue(0),
  };
}
function makeJobsMock() {
  return {
    findById: jest.fn(),
    findByIdWithCompany: jest.fn().mockResolvedValue({
      id: "j-1",
      title: "Engineer",
      department: "Eng",
      employmentType: "full_time",
      workMode: "remote",
      company: { id: "co-1", name: "Acme", logoUrl: null },
    }),
  };
}
function makeOffersMock() { return { findLatestByApplicationId: jest.fn() }; }

function fakeDb() {
  return {
    transaction: jest.fn(async <T>(fn: (tx: unknown) => Promise<T>) => fn({})),
  };
}

const recruiter = { id: "rec-1", role: "recruiter" as const, email: "r@x" } as any;

describe("ApplicationsService.hire()", () => {
  let svc: ApplicationsService;
  let repo: ReturnType<typeof makeRepoMock>;
  let offers: ReturnType<typeof makeOffersMock>;
  let jobs: ReturnType<typeof makeJobsMock>;

  beforeEach(async () => {
    repo = makeRepoMock();
    offers = makeOffersMock();
    jobs = makeJobsMock();

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: ApplicationsRepository, useValue: repo },
        { provide: JobsRepository, useValue: jobs },
        { provide: OffersRepository, useValue: offers },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: CacheService, useValue: { bustTags: jest.fn() } },
        { provide: EventsService, useValue: { emitApplicationStatusChanged: jest.fn() } },
        { provide: EmailService, useValue: { send: jest.fn() } },
        { provide: MatchScoreQueueService, useValue: { enqueue: jest.fn() } },
        { provide: ProfilesRepository, useValue: { findById: jest.fn().mockResolvedValue({ id: "c-1", fullName: "Alice", email: "a@x", phone: null }), findCandidateProfile: jest.fn().mockResolvedValue(null) } },
        { provide: ResumesRepository, useValue: { findById: jest.fn() } },
        { provide: ScoringService, useValue: { getMatchScoreByApplicationId: jest.fn().mockResolvedValue(null) } },
        { provide: StorageService, useValue: {} },
        { provide: NotificationsService, useValue: { emit: jest.fn().mockResolvedValue(undefined), emitMany: jest.fn().mockResolvedValue(undefined) } },
        { provide: DRIZZLE_CLIENT, useValue: fakeDb() },
      ],
    }).compile();

    svc = mod.get(ApplicationsService);
  });

  it("rejects when latest offer is not accepted", async () => {
    repo.findByIdForUpdate.mockResolvedValue({ id: "a-1", status: "offer", jobId: "j-1", candidateId: "c-1" });
    jobs.findById.mockResolvedValue({ id: "j-1", companyId: "co-1", recruiterId: "rec-1" });
    offers.findLatestByApplicationId.mockResolvedValue({ status: "pending" });

    await expect(
      svc.hire(recruiter, "co-1", "a-1", { autoRejectOthers: false }, {}),
    ).rejects.toThrow(BadRequestException);
  });

  it("hires the candidate when offer is accepted, no cascade", async () => {
    repo.findByIdForUpdate.mockResolvedValue({ id: "a-1", status: "offer", jobId: "j-1", candidateId: "c-1", recruiterNotes: null });
    jobs.findById.mockResolvedValue({ id: "j-1", companyId: "co-1", recruiterId: "rec-1" });
    offers.findLatestByApplicationId.mockResolvedValue({ status: "accepted" });
    repo.findInflightByJobId.mockResolvedValue([]);
    repo.update.mockResolvedValue({ id: "a-1", status: "hired" });

    // toDto will call findById again — mock it too
    repo.findById.mockResolvedValue({ id: "a-1", status: "hired", jobId: "j-1", candidateId: "c-1", recruiterNotes: null, resumeId: "r-1", coverLetter: null, scoreStatus: "completed", appliedAt: new Date(), statusUpdatedAt: new Date(), shortlistedAt: null });

    const result = await svc.hire(recruiter, "co-1", "a-1", { autoRejectOthers: false }, {});

    expect(repo.update).toHaveBeenCalledWith(
      "a-1",
      expect.objectContaining({ status: "hired" }),
      expect.anything(),
    );
    expect(result.otherApplicationsRejected).toBe(0);
  });

  it("cascades — auto-rejects in-flight siblings when autoRejectOthers=true", async () => {
    repo.findByIdForUpdate.mockResolvedValue({ id: "a-1", status: "offer", jobId: "j-1", candidateId: "c-1", recruiterNotes: null });
    jobs.findById.mockResolvedValue({ id: "j-1", companyId: "co-1", recruiterId: "rec-1" });
    offers.findLatestByApplicationId.mockResolvedValue({ status: "accepted" });
    repo.findInflightByJobId.mockResolvedValue([
      { id: "a-2", candidateId: "c-2", recruiterNotes: null },
      { id: "a-3", candidateId: "c-3", recruiterNotes: "prior note" },
    ]);
    repo.update.mockResolvedValue({ id: "a-1", status: "hired" });
    repo.findById.mockResolvedValue({ id: "a-1", status: "hired", jobId: "j-1", candidateId: "c-1", recruiterNotes: null, resumeId: "r-1", coverLetter: null, scoreStatus: "completed", appliedAt: new Date(), statusUpdatedAt: new Date(), shortlistedAt: null });

    const result = await svc.hire(recruiter, "co-1", "a-1", { autoRejectOthers: true }, {});

    // 1 hire UPDATE + 2 cascade UPDATEs = 3 total
    expect(repo.update).toHaveBeenCalledTimes(3);
    expect(result.otherApplicationsRejected).toBe(2);
  });

  it("does not touch siblings when autoRejectOthers=false", async () => {
    repo.findByIdForUpdate.mockResolvedValue({ id: "a-1", status: "offer", jobId: "j-1", candidateId: "c-1", recruiterNotes: null });
    jobs.findById.mockResolvedValue({ id: "j-1", companyId: "co-1", recruiterId: "rec-1" });
    offers.findLatestByApplicationId.mockResolvedValue({ status: "accepted" });
    repo.findInflightByJobId.mockResolvedValue([{ id: "a-2", candidateId: "c-2" }]);
    repo.update.mockResolvedValue({ id: "a-1", status: "hired" });
    repo.findById.mockResolvedValue({ id: "a-1", status: "hired", jobId: "j-1", candidateId: "c-1", recruiterNotes: null, resumeId: "r-1", coverLetter: null, scoreStatus: "completed", appliedAt: new Date(), statusUpdatedAt: new Date(), shortlistedAt: null });

    const result = await svc.hire(recruiter, "co-1", "a-1", { autoRejectOthers: false }, {});

    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(result.otherApplicationsRejected).toBe(0);
  });
});
