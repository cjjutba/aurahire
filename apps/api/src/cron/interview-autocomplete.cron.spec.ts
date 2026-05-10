import { Test } from "@nestjs/testing";

import { InterviewAutocompleteCron } from "./interview-autocomplete.cron";
import { DRIZZLE_CLIENT } from "../db/db.module";
import { NotificationsService } from "../modules/notifications/notifications.service";
import { EventsService } from "../realtime";
import { AuditService } from "../audit";

jest.mock("jose", () => ({}));

interface DueRow {
  id: string;
  applicationId: string;
  scheduledBy: string;
  candidateId: string;
  jobId: string;
}

function makeDb(dueRows: DueRow[], updatedRow?: { id: string } | null) {
  // Default: returning() resolves with the first updated row (simulates success).
  const returningFn = jest
    .fn()
    .mockResolvedValue(updatedRow === null ? [] : [updatedRow ?? { id: dueRows[0]?.id ?? "i1" }]);
  const updateWhereFn = jest.fn().mockReturnValue({ returning: returningFn });
  const setFn = jest.fn().mockReturnValue({ where: updateWhereFn });
  const update = jest.fn().mockReturnValue({ set: setFn });

  const limitFn = jest.fn().mockResolvedValue(dueRows);
  const whereFn = jest.fn().mockReturnValue({ limit: limitFn });
  // The query chains innerJoin → leftJoin (jobs) → leftJoin (companies) →
  // leftJoin (profiles) → where → limit. The chain object exposes all three
  // so any order of joins resolves to the same builder.
  const joinChain: Record<string, jest.Mock> = {};
  const innerJoinFn = jest.fn().mockReturnValue(joinChain);
  const leftJoinFn = jest.fn().mockReturnValue(joinChain);
  joinChain.innerJoin = innerJoinFn;
  joinChain.leftJoin = leftJoinFn;
  joinChain.where = whereFn as unknown as jest.Mock;
  const fromFn = jest.fn().mockReturnValue({ innerJoin: innerJoinFn, leftJoin: leftJoinFn });
  const selectFn = jest.fn().mockReturnValue({ from: fromFn });

  return { select: selectFn, update, _returning: returningFn };
}

describe("InterviewAutocompleteCron", () => {
  let cron: InterviewAutocompleteCron;
  let notifications: { emit: jest.Mock };
  let events: { emitInterviewCompleted: jest.Mock };
  let audit: { log: jest.Mock };

  async function setup(dueRows: DueRow[], updatedRow?: { id: string } | null) {
    const db = makeDb(dueRows, updatedRow);
    notifications = { emit: jest.fn().mockResolvedValue(undefined) };
    events = { emitInterviewCompleted: jest.fn() };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        InterviewAutocompleteCron,
        { provide: DRIZZLE_CLIENT, useValue: db },
        { provide: NotificationsService, useValue: notifications },
        { provide: EventsService, useValue: events },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    cron = moduleRef.get(InterviewAutocompleteCron);
    return { db };
  }

  it("flips qualifying rows to completed and emits notifications + realtime", async () => {
    const due: DueRow[] = [
      { id: "i1", applicationId: "a1", scheduledBy: "r1", candidateId: "c1", jobId: "j1" },
      { id: "i2", applicationId: "a2", scheduledBy: "r2", candidateId: "c2", jobId: "j2" },
    ];
    // Each update returns the row (UPDATE succeeds for both)
    const db = makeDb(due);
    notifications = { emit: jest.fn().mockResolvedValue(undefined) };
    events = { emitInterviewCompleted: jest.fn() };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    // Override returning to return each row in sequence
    db._returning
      .mockResolvedValueOnce([{ id: "i1" }])
      .mockResolvedValueOnce([{ id: "i2" }]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        InterviewAutocompleteCron,
        { provide: DRIZZLE_CLIENT, useValue: db },
        { provide: NotificationsService, useValue: notifications },
        { provide: EventsService, useValue: events },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    cron = moduleRef.get(InterviewAutocompleteCron);

    const result = await cron.execute();

    expect(result.completed).toBe(2);
    // 2 candidate + 2 recruiter = 4 notification emits
    expect(notifications.emit).toHaveBeenCalledTimes(4);
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "c1",
        eventType: "interview_completed",
        entityType: "interview",
        entityId: "i1",
      }),
    );
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "r1",
        eventType: "interview_record_feedback",
        entityType: "interview",
        entityId: "i1",
      }),
    );
    expect(events.emitInterviewCompleted).toHaveBeenCalledTimes(2);
    expect(events.emitInterviewCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        interviewId: "i1",
        applicationId: "a1",
        candidateId: "c1",
        recruiterId: "r1",
        jobId: "j1",
      }),
    );
  });

  it("is idempotent — returns completed: 0 when the UPDATE guard finds no row", async () => {
    const due: DueRow[] = [
      { id: "i1", applicationId: "a1", scheduledBy: "r1", candidateId: "c1", jobId: "j1" },
    ];
    // Simulate race: DB returns empty from .returning() (already moved by another path)
    await setup(due, null);

    const result = await cron.execute();

    expect(result.completed).toBe(0);
    expect(notifications.emit).not.toHaveBeenCalled();
    expect(events.emitInterviewCompleted).not.toHaveBeenCalled();
    // Run-level audit still written
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.stringContaining("interview_autocomplete"),
        details: expect.objectContaining({ completed: 0, scanned: 1 }),
      }),
    );
  });

  it("writes INTERVIEW_AUTOCOMPLETE_RUN audit summary even when zero rows processed", async () => {
    await setup([]);

    const result = await cron.execute();

    expect(result.completed).toBe(0);
    expect(notifications.emit).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: "system",
        action: expect.stringContaining("interview_autocomplete"),
        entityType: "cron",
        details: expect.objectContaining({ completed: 0, scanned: 0 }),
      }),
    );
  });

  it("continues processing other rows when one row throws", async () => {
    const due: DueRow[] = [
      { id: "i1", applicationId: "a1", scheduledBy: "r1", candidateId: "c1", jobId: "j1" },
      { id: "i2", applicationId: "a2", scheduledBy: "r2", candidateId: "c2", jobId: "j2" },
    ];
    const db = makeDb(due);
    notifications = { emit: jest.fn().mockResolvedValue(undefined) };
    events = { emitInterviewCompleted: jest.fn() };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    // First row: update succeeds but notifications.emit throws; second: everything works
    db._returning
      .mockResolvedValueOnce([{ id: "i1" }])
      .mockResolvedValueOnce([{ id: "i2" }]);
    notifications.emit
      .mockRejectedValueOnce(new Error("network failure"))
      .mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        InterviewAutocompleteCron,
        { provide: DRIZZLE_CLIENT, useValue: db },
        { provide: NotificationsService, useValue: notifications },
        { provide: EventsService, useValue: events },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    cron = moduleRef.get(InterviewAutocompleteCron);

    const result = await cron.execute();

    // Row 1 failed inside the try block, row 2 succeeded
    expect(result.completed).toBe(1);
    // Run-level audit is still written
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ completed: 1, scanned: 2 }),
      }),
    );
  });
});
