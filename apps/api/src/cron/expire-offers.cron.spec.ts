import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";

import { ExpireOffersCron } from "./expire-offers.cron";
import { DRIZZLE_CLIENT } from "../db/db.module";
import { AuditService } from "../audit";
import { EmailService } from "../email/email.service";
import { NotificationsService } from "../modules/notifications/notifications.service";
import { ApplicationsService } from "../modules/applications/applications.service";
import { ApplicationsRepository } from "../modules/applications/applications.repository";

// AuditService transitively imports jose (ESM); mock it.
jest.mock("jose", () => ({}));

interface ExpiredRow {
  offerId: string;
  applicationId: string;
  candidateId: string;
  candidateEmail: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  recruiterId: string;
  companyName: string;
  companyLogoUrl: string | null;
}

function makeDb(rows: ExpiredRow[]) {
  const updateWhere = jest.fn().mockResolvedValue(undefined);
  const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set: updateSet });

  const where = jest.fn().mockResolvedValue(rows);
  const innerJoin = jest.fn();
  innerJoin.mockReturnValue({ innerJoin, where });
  const from = jest.fn().mockReturnValue({ innerJoin });
  const select = jest.fn().mockReturnValue({ from });

  // transaction: execute the callback with a fake tx object so the cron's
  // inner db.transaction(async tx => { ... }) path is exercised.
  const transaction = jest
    .fn()
    .mockImplementation((cb: (tx: unknown) => Promise<void>) => cb({}));

  return {
    select,
    update,
    transaction,
    _updateSet: updateSet,
    _updateWhere: updateWhere,
  };
}

describe("ExpireOffersCron", () => {
  let cron: ExpireOffersCron;
  let audit: jest.Mocked<Pick<AuditService, "log">>;
  let email: jest.Mocked<Pick<EmailService, "send">>;
  let notifications: jest.Mocked<Pick<NotificationsService, "emit">>;
  let applicationsServiceMock: jest.Mocked<
    Pick<ApplicationsService, "transitionFromSystem">
  >;
  let applicationsRepoMock: jest.Mocked<
    Pick<ApplicationsRepository, "findByIdForUpdate">
  >;
  let db: ReturnType<typeof makeDb>;

  async function setup(rows: ExpiredRow[]) {
    db = makeDb(rows);
    audit = { log: jest.fn() };
    email = { send: jest.fn().mockResolvedValue(undefined) };
    notifications = { emit: jest.fn() };
    applicationsServiceMock = {
      transitionFromSystem: jest.fn().mockResolvedValue({}),
    };
    applicationsRepoMock = { findByIdForUpdate: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ExpireOffersCron,
        { provide: DRIZZLE_CLIENT, useValue: db },
        { provide: AuditService, useValue: audit },
        { provide: EmailService, useValue: email },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: NotificationsService, useValue: notifications },
        { provide: ApplicationsService, useValue: applicationsServiceMock },
        { provide: ApplicationsRepository, useValue: applicationsRepoMock },
      ],
    }).compile();
    cron = moduleRef.get(ExpireOffersCron);
  }

  const makeRow = (
    overrides: Partial<ExpiredRow> & Pick<ExpiredRow, "offerId">,
  ): ExpiredRow => ({
    applicationId: `app-${overrides.offerId}`,
    candidateId: `cand-${overrides.offerId}`,
    candidateEmail: `cand-${overrides.offerId}@example.com`,
    candidateName: "Candidate Name",
    jobId: `job-${overrides.offerId}`,
    jobTitle: "Engineer",
    recruiterId: `recr-${overrides.offerId}`,
    companyName: "ACME",
    companyLogoUrl: null,
    ...overrides,
  });

  it("transitions pending offers to 'expired' and notifies BOTH candidate and recruiter in-app", async () => {
    await setup([makeRow({ offerId: "o1" })]);

    const result = await cron.execute();

    expect(db._updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "expired" }),
    );
    // Candidate email still sent.
    expect(email.send).toHaveBeenCalledTimes(1);

    // In-app notify both parties on offer_expired.
    expect(notifications.emit).toHaveBeenCalledTimes(2);
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "cand-o1",
        eventType: "offer_expired",
        entityType: "offer",
        entityId: "o1",
      }),
    );
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "recr-o1",
        eventType: "offer_expired",
        entityType: "offer",
        entityId: "o1",
        metadata: expect.objectContaining({
          candidateId: "cand-o1",
          jobId: "job-o1",
        }),
      }),
    );
    expect(result.affectedRows).toBe(1);
  });

  it("audit-logs the run with affected counts", async () => {
    await setup([makeRow({ offerId: "o1" })]);
    await cron.execute();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: "system",
        action: expect.stringContaining("expire_offers.executed"),
        details: expect.objectContaining({ affectedRows: 1 }),
      }),
    );
  });

  it("idempotent: empty match set does nothing apart from the audit row", async () => {
    await setup([]);
    const result = await cron.execute();
    expect(db.update).not.toHaveBeenCalled();
    expect(notifications.emit).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(result.affectedRows).toBe(0);
  });

  it("a per-row side-effect failure (email) does not abort the rest of the run", async () => {
    await setup([makeRow({ offerId: "o1" }), makeRow({ offerId: "o2" })]);
    (email.send as jest.Mock)
      .mockRejectedValueOnce(new Error("email boom"))
      .mockResolvedValue(undefined);

    const result = await cron.execute();
    // Email was attempted twice; the second succeeded so notify fired for that row.
    expect(email.send).toHaveBeenCalledTimes(2);
    expect(result.affectedRows).toBe(2);
  });

  it("auto-transitions the application to offer_declined when app is still at offer", async () => {
    await setup([makeRow({ offerId: "o1" })]);
    applicationsRepoMock.findByIdForUpdate.mockResolvedValue({
      id: "app-o1",
      status: "offer",
      jobId: "job-o1",
      candidateId: "cand-o1",
    } as never);

    await cron.execute();

    expect(applicationsServiceMock.transitionFromSystem).toHaveBeenCalledWith(
      null,
      expect.any(String),
      "offer_declined",
      "Offer expired without response",
      {},
      expect.anything(),
    );
  });

  it("skips application transition when app is no longer at offer", async () => {
    await setup([makeRow({ offerId: "o1" })]);
    applicationsRepoMock.findByIdForUpdate.mockResolvedValue({
      id: "app-o1",
      status: "rejected",
      jobId: "job-o1",
      candidateId: "cand-o1",
    } as never);

    await cron.execute();

    expect(applicationsServiceMock.transitionFromSystem).not.toHaveBeenCalled();
  });
});
