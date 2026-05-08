import { Test } from "@nestjs/testing";

import { ArchivePastDeadlineJobsCron } from "./archive-past-deadline-jobs.cron";
import { DRIZZLE_CLIENT } from "../db/db.module";
import { AuditService } from "../audit";
import { NotificationsService } from "../modules/notifications/notifications.service";

// AuditService transitively imports jose (ESM); mock it.
jest.mock("jose", () => ({}));

interface JobRow {
  id: string;
  title: string;
  recruiterId: string;
  applicationDeadline: string | null;
}

function makeDb(rows: JobRow[]) {
  const updateWhere = jest.fn().mockResolvedValue(undefined);
  const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set: updateSet });

  const where = jest.fn().mockResolvedValue(rows);
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });

  return { select, update, _updateSet: updateSet, _updateWhere: updateWhere };
}

describe("ArchivePastDeadlineJobsCron", () => {
  let cron: ArchivePastDeadlineJobsCron;
  let audit: jest.Mocked<Pick<AuditService, "log">>;
  let notifications: jest.Mocked<Pick<NotificationsService, "emit">>;
  let db: ReturnType<typeof makeDb>;

  async function setup(rows: JobRow[]) {
    db = makeDb(rows);
    audit = { log: jest.fn() };
    notifications = { emit: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ArchivePastDeadlineJobsCron,
        { provide: DRIZZLE_CLIENT, useValue: db },
        { provide: AuditService, useValue: audit },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    cron = moduleRef.get(ArchivePastDeadlineJobsCron);
  }

  it("archives published jobs past deadline with archived_reason='deadline_passed'", async () => {
    await setup([
      { id: "j1", title: "Engineer", recruiterId: "r1", applicationDeadline: "2026-04-01" },
      { id: "j2", title: "PM", recruiterId: "r2", applicationDeadline: "2026-04-15" },
    ]);

    const result = await cron.execute();

    expect(db.update).toHaveBeenCalled();
    expect(db._updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "archived",
        archivedReason: "deadline_passed",
      }),
    );
    expect(result.affectedRows).toBe(2);
  });

  it("emits job_archived_by_deadline to the owning recruiter for each archived job", async () => {
    await setup([
      { id: "j1", title: "Engineer", recruiterId: "r1", applicationDeadline: "2026-04-01" },
      { id: "j2", title: "PM", recruiterId: "r2", applicationDeadline: "2026-04-15" },
    ]);

    await cron.execute();

    expect(notifications.emit).toHaveBeenCalledTimes(2);
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "r1",
        eventType: "job_archived_by_deadline",
        entityType: "job",
        entityId: "j1",
        metadata: expect.objectContaining({
          jobId: "j1",
          title: "Engineer",
          deadline: "2026-04-01",
        }),
      }),
    );
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "r2",
        eventType: "job_archived_by_deadline",
        entityType: "job",
        entityId: "j2",
      }),
    );
  });

  it("idempotent: empty match set does nothing apart from the audit row", async () => {
    await setup([]);
    const result = await cron.execute();
    expect(db.update).not.toHaveBeenCalled();
    expect(notifications.emit).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(result.affectedRows).toBe(0);
  });

  it("a notify failure does not abort the rest of the run", async () => {
    await setup([
      { id: "j1", title: "Engineer", recruiterId: "r1", applicationDeadline: "2026-04-01" },
      { id: "j2", title: "PM", recruiterId: "r2", applicationDeadline: "2026-04-15" },
    ]);
    (notifications.emit as jest.Mock)
      .mockRejectedValueOnce(new Error("notify boom"))
      .mockResolvedValue(undefined);

    const result = await cron.execute();
    expect(notifications.emit).toHaveBeenCalledTimes(2);
    expect(result.affectedRows).toBe(2);
  });
});
