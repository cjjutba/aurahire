/**
 * Unit tests for InterviewVenuesService
 *
 * Covers:
 *  1. create → list round-trip: inserted row appears in list; audit fired with INTERVIEW_VENUE_CREATED.
 *  2. create with isDefault:true calls clearDefaultForCompany first.
 *  3. setDefault clears other defaults (with exceptId) then updates target to isDefault:true.
 *  4. update with mapUrl "javascript:..." rejects via sanitizer.
 *  5. remove fires INTERVIEW_VENUE_DELETED audit.
 *  6. Forbidden when user is not recruiter/admin.
 *
 * No database is hit — all dependencies are mocked.
 */

import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { InterviewVenuesService } from "./interview-venues.service";
import { InterviewVenuesRepository } from "./interview-venues.repository";
import { AuditService } from "../../audit";
import { AUDIT_ACTIONS } from "../../audit/audit.types";
import { CacheService } from "../../cache";

// ── Helpers ────────────────────────────────────────────────────────────────────

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const RECRUITER_ID = uuid(1);
const COMPANY_ID = uuid(10);
const VENUE_ID = uuid(50);

const recruiterUser = {
  id: RECRUITER_ID,
  role: "recruiter",
  email: "recruiter@example.com",
  status: "active",
  fullName: "Test Recruiter",
  profileCompleted: true,
} as any;

const candidateUser = {
  id: uuid(2),
  role: "candidate",
  email: "candidate@example.com",
  status: "active",
  fullName: "Test Candidate",
  profileCompleted: true,
} as any;

function makeVenueRow(overrides: Record<string, unknown> = {}) {
  return {
    id: VENUE_ID,
    companyId: COMPANY_ID,
    createdBy: RECRUITER_ID,
    label: "Main Office",
    venueName: "AuraHire HQ",
    addressLine: "123 Main St",
    roomOrFloor: null,
    mapUrl: null,
    reportingInstructions: null,
    whatToBring: null,
    interviewerName: null,
    interviewerTitle: null,
    isDefault: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as any;
}

const VALID_INPUT = {
  label: "Main Office",
  venueName: "AuraHire HQ",
  addressLine: "123 Main St",
  isDefault: false,
} as any;

// ── Test suite ─────────────────────────────────────────────────────────────────

describe("InterviewVenuesService", () => {
  let service: InterviewVenuesService;
  let repo: jest.Mocked<InterviewVenuesRepository>;
  let audit: jest.Mocked<AuditService>;
  let cache: jest.Mocked<CacheService>;

  beforeEach(async () => {
    repo = {
      list: jest.fn(),
      findById: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      clearDefaultForCompany: jest.fn().mockResolvedValue(undefined),
    } as any;

    audit = {
      log: jest.fn().mockResolvedValue(undefined),
    } as any;

    cache = {
      bustTags: jest.fn().mockResolvedValue(undefined),
      getOrSet: jest.fn(),
    } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        InterviewVenuesService,
        { provide: InterviewVenuesRepository, useValue: repo },
        { provide: AuditService, useValue: audit },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = moduleRef.get(InterviewVenuesService);
  });

  // ── Test 1: create → list round-trip ──────────────────────────────────────

  it("create → list: inserted row returned; INTERVIEW_VENUE_CREATED audit fired", async () => {
    const venueRow = makeVenueRow();
    repo.insert.mockResolvedValue(venueRow);
    repo.list.mockResolvedValue([venueRow]);

    const created = await service.create(
      recruiterUser,
      COMPANY_ID,
      VALID_INPUT,
      {},
    );

    // ID matches the inserted row
    expect(created.id).toBe(VENUE_ID);
    expect(created.companyId).toBe(COMPANY_ID);

    // Audit action was fired with INTERVIEW_VENUE_CREATED
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: RECRUITER_ID,
        action: AUDIT_ACTIONS.INTERVIEW_VENUE_CREATED,
        entityId: VENUE_ID,
        entityType: "interview_venue",
        companyId: COMPANY_ID,
      }),
    );

    // List round-trip: service.list uses repo.list
    const listed = await service.list(recruiterUser, COMPANY_ID);
    expect(listed).toHaveLength(1);
    expect(listed[0]!.id).toBe(VENUE_ID);
  });

  // ── Test 2: create with isDefault:true clears others first ────────────────

  it("create with isDefault:true calls clearDefaultForCompany before insert", async () => {
    const callOrder: string[] = [];
    repo.clearDefaultForCompany.mockImplementation(async () => {
      callOrder.push("clear");
    });
    repo.insert.mockImplementation(async () => {
      callOrder.push("insert");
      return makeVenueRow({ isDefault: true });
    });

    await service.create(
      recruiterUser,
      COMPANY_ID,
      { ...VALID_INPUT, isDefault: true },
      {},
    );

    expect(repo.clearDefaultForCompany).toHaveBeenCalledWith(COMPANY_ID);
    expect(callOrder).toEqual(["clear", "insert"]);
  });

  // ── Test 3: setDefault clears others with exceptId, then sets target ──────

  it("setDefault: clears other defaults with exceptId, then updates target to isDefault:true", async () => {
    const existingVenue = makeVenueRow({ isDefault: false });
    const updatedVenue = makeVenueRow({ isDefault: true });

    repo.findById.mockResolvedValue(existingVenue);
    repo.update.mockResolvedValue(updatedVenue);

    const result = await service.setDefault(recruiterUser, VENUE_ID, {});

    // clearDefaultForCompany must be called with exceptId = VENUE_ID
    expect(repo.clearDefaultForCompany).toHaveBeenCalledWith(
      COMPANY_ID,
      VENUE_ID,
    );

    // update must set isDefault to true on the target venue
    expect(repo.update).toHaveBeenCalledWith(VENUE_ID, { isDefault: true });

    // Result reflects updated state
    expect(result.isDefault).toBe(true);

    // Audit logged with setDefault detail
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.INTERVIEW_VENUE_UPDATED,
        entityId: VENUE_ID,
        details: expect.objectContaining({ setDefault: true }),
      }),
    );
  });

  // ── Test 4: update with javascript: mapUrl throws ─────────────────────────

  it("update with mapUrl 'javascript:...' throws an error from sanitizer", async () => {
    repo.findById.mockResolvedValue(makeVenueRow());

    await expect(
      service.update(
        recruiterUser,
        VENUE_ID,
        { mapUrl: "javascript:alert(1)" } as any,
        {},
      ),
    ).rejects.toThrow(/invalid map url/i);

    // update on repo must NOT have been called
    expect(repo.update).not.toHaveBeenCalled();
  });

  // ── Test 5: remove fires INTERVIEW_VENUE_DELETED ──────────────────────────

  it("remove: deletes venue and fires INTERVIEW_VENUE_DELETED audit", async () => {
    const existingVenue = makeVenueRow();
    repo.findById.mockResolvedValue(existingVenue);
    repo.delete.mockResolvedValue(undefined);

    await service.remove(recruiterUser, VENUE_ID, {});

    expect(repo.delete).toHaveBeenCalledWith(VENUE_ID);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: RECRUITER_ID,
        action: AUDIT_ACTIONS.INTERVIEW_VENUE_DELETED,
        entityId: VENUE_ID,
        entityType: "interview_venue",
        companyId: COMPANY_ID,
        details: expect.objectContaining({ label: existingVenue.label }),
      }),
    );
  });

  // ── Test 6: forbidden for non-recruiter/admin ──────────────────────────────

  it("list throws ForbiddenException when user is candidate", async () => {
    await expect(service.list(candidateUser, COMPANY_ID)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("create throws ForbiddenException when user is candidate", async () => {
    await expect(
      service.create(candidateUser, COMPANY_ID, VALID_INPUT, {}),
    ).rejects.toThrow(ForbiddenException);
  });

  it("remove throws ForbiddenException when user is candidate", async () => {
    await expect(service.remove(candidateUser, VENUE_ID, {})).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("setDefault throws ForbiddenException when user is candidate", async () => {
    await expect(
      service.setDefault(candidateUser, VENUE_ID, {}),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── Bonus: 404 for unknown venueId ────────────────────────────────────────

  it("update throws NotFoundException for unknown venueId", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(
      service.update(
        recruiterUser,
        uuid(999),
        { label: "New Label" } as any,
        {},
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("setDefault throws NotFoundException for unknown venueId", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(
      service.setDefault(recruiterUser, uuid(999), {}),
    ).rejects.toThrow(NotFoundException);
  });
});
