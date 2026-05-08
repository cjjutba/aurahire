import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";

import { NotificationsScheduler } from "./notifications.scheduler";
import { NotificationsService } from "./notifications.service";
import { NOTIFICATION_EMAIL_QUEUE } from "./queues";
import { DRIZZLE_CLIENT } from "../../db/db.module";

jest.mock("jose", () => ({}));

/**
 * Build a chainable mock for `db.select(...)...limit(N)` that resolves to the
 * given rows. Each invocation returns a fresh chain so callers can stack
 * multiple `selectRows()` results across the same db mock for crons that run
 * more than one query (e.g. runOfferExpiration's two passes).
 */
function selectRows<T>(rows: T[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const where = jest.fn().mockReturnValue({ limit });
  const innerJoin: jest.Mock = jest.fn();
  innerJoin.mockReturnValue({ innerJoin, where });
  const from = jest.fn().mockReturnValue({ innerJoin, where });
  return { from };
}

interface UpdateMock {
  set: jest.Mock;
  where: jest.Mock;
}

function makeUpdateMock(): { fn: jest.Mock; chain: UpdateMock } {
  const where = jest.fn().mockResolvedValue(undefined);
  const set = jest.fn().mockReturnValue({ where });
  const fn = jest.fn().mockReturnValue({ set });
  return { fn, chain: { set, where } };
}

describe("NotificationsScheduler", () => {
  // ---- F9: runInterviewReminder ----
  describe("runInterviewReminder", () => {
    async function setup(rows: Array<{ id: string; applicationId: string; scheduledAt: Date; candidateId: string; jobId: string }>) {
      const select = selectRows(rows);
      const db = { select: jest.fn().mockReturnValue(select), update: jest.fn() };
      const notifications = { emit: jest.fn(), emitMany: jest.fn() };
      const queue = { add: jest.fn() };

      const moduleRef = await Test.createTestingModule({
        providers: [
          NotificationsScheduler,
          { provide: DRIZZLE_CLIENT, useValue: db },
          { provide: NotificationsService, useValue: notifications },
          { provide: getQueueToken(NOTIFICATION_EMAIL_QUEUE), useValue: queue },
        ],
      }).compile();

      return {
        scheduler: moduleRef.get(NotificationsScheduler),
        notifications,
        queue,
        db,
      };
    }

    it("emits interview_reminder_24h for each in-window row", async () => {
      const scheduledAt = new Date(Date.now() + 23.5 * 3600 * 1000);
      const { scheduler, notifications } = await setup([
        { id: "iv1", applicationId: "app1", scheduledAt, candidateId: "c1", jobId: "j1" },
        { id: "iv2", applicationId: "app2", scheduledAt, candidateId: "c2", jobId: "j2" },
      ]);

      await scheduler.runInterviewReminder();

      expect(notifications.emit).toHaveBeenCalledTimes(2);
      expect(notifications.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "interview_reminder_24h",
          userId: "c1",
          entityType: "interview",
          entityId: "iv1",
        }),
      );
    });

    it("emits nothing when no rows match (out-of-window cases handled by SQL)", async () => {
      const { scheduler, notifications } = await setup([]);
      await scheduler.runInterviewReminder();
      expect(notifications.emit).not.toHaveBeenCalled();
    });

    it("a thrown emit does not abort iteration of remaining rows", async () => {
      const scheduledAt = new Date();
      const { scheduler, notifications } = await setup([
        { id: "iv1", applicationId: "app1", scheduledAt, candidateId: "c1", jobId: "j1" },
        { id: "iv2", applicationId: "app2", scheduledAt, candidateId: "c2", jobId: "j2" },
      ]);
      notifications.emit
        .mockRejectedValueOnce(new Error("emit boom"))
        .mockResolvedValueOnce(undefined);

      await expect(scheduler.runInterviewReminder()).resolves.toBeUndefined();
      expect(notifications.emit).toHaveBeenCalledTimes(2);
    });
  });

  // ---- F10: runOfferExpiration ----
  describe("runOfferExpiration", () => {
    async function setup(opts: {
      expiringSoon?: Array<{
        id: string;
        applicationId: string;
        expiresAt: Date | null;
        candidateId: string;
        jobId: string;
      }>;
      expired?: Array<{
        id: string;
        applicationId: string;
        candidateId: string;
        jobId: string;
        recruiterId: string;
      }>;
    }) {
      const expiringSoonRows = opts.expiringSoon ?? [];
      const expiredRows = opts.expired ?? [];
      const select = jest
        .fn()
        // first call → pass A (expiring soon)
        .mockReturnValueOnce(selectRows(expiringSoonRows))
        // second call → pass B (expired)
        .mockReturnValueOnce(selectRows(expiredRows));

      const update = makeUpdateMock();
      const db = { select, update: update.fn };
      const notifications = { emit: jest.fn(), emitMany: jest.fn() };
      const queue = { add: jest.fn() };

      const moduleRef = await Test.createTestingModule({
        providers: [
          NotificationsScheduler,
          { provide: DRIZZLE_CLIENT, useValue: db },
          { provide: NotificationsService, useValue: notifications },
          { provide: getQueueToken(NOTIFICATION_EMAIL_QUEUE), useValue: queue },
        ],
      }).compile();

      return {
        scheduler: moduleRef.get(NotificationsScheduler),
        notifications,
        queue,
        db,
        update,
      };
    }

    it("emits offer_expiring_soon for pending offers within 24h of expiry", async () => {
      const { scheduler, notifications } = await setup({
        expiringSoon: [
          {
            id: "o1",
            applicationId: "a1",
            expiresAt: new Date(Date.now() + 12 * 3600 * 1000),
            candidateId: "c1",
            jobId: "j1",
          },
        ],
      });

      await scheduler.runOfferExpiration();

      expect(notifications.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "offer_expiring_soon",
          userId: "c1",
          entityId: "o1",
        }),
      );
    });

    it("transitions past-due pending offers to 'expired' and notifies both parties", async () => {
      const { scheduler, notifications, update } = await setup({
        expired: [
          {
            id: "o1",
            applicationId: "a1",
            candidateId: "c1",
            jobId: "j1",
            recruiterId: "r1",
          },
        ],
      });

      await scheduler.runOfferExpiration();

      // status update fired
      expect(update.fn).toHaveBeenCalled();
      expect(update.chain.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: "expired" }),
      );

      // candidate notified directly
      expect(notifications.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "offer_expired",
          userId: "c1",
          entityId: "o1",
        }),
      );

      // recruiter notified via emitMany([recruiterId], …)
      expect(notifications.emitMany).toHaveBeenCalledWith(
        ["r1"],
        expect.objectContaining({
          eventType: "offer_expired",
          entityId: "o1",
        }),
      );
    });
  });

  // ---- F11: runJobDeadlineArchive ----
  describe("runJobDeadlineArchive", () => {
    async function setup(rows: Array<{ id: string; title: string; recruiterId: string; applicationDeadline: string | null }>) {
      const select = jest.fn().mockReturnValue(selectRows(rows));
      const update = makeUpdateMock();
      const db = { select, update: update.fn };
      const notifications = { emit: jest.fn(), emitMany: jest.fn() };
      const queue = { add: jest.fn() };

      const moduleRef = await Test.createTestingModule({
        providers: [
          NotificationsScheduler,
          { provide: DRIZZLE_CLIENT, useValue: db },
          { provide: NotificationsService, useValue: notifications },
          { provide: getQueueToken(NOTIFICATION_EMAIL_QUEUE), useValue: queue },
        ],
      }).compile();

      return {
        scheduler: moduleRef.get(NotificationsScheduler),
        notifications,
        update,
      };
    }

    it("archives published jobs past deadline and notifies recruiter", async () => {
      const { scheduler, notifications, update } = await setup([
        { id: "job1", title: "Engineer", recruiterId: "r1", applicationDeadline: "2026-04-01" },
      ]);

      await scheduler.runJobDeadlineArchive();

      expect(update.chain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "archived",
          archivedReason: "deadline_passed",
        }),
      );
      expect(notifications.emitMany).toHaveBeenCalledWith(
        ["r1"],
        expect.objectContaining({
          eventType: "job_archived_by_deadline",
          entityType: "job",
          entityId: "job1",
        }),
      );
    });

    it("does nothing when no jobs are past deadline", async () => {
      const { scheduler, notifications, update } = await setup([]);
      await scheduler.runJobDeadlineArchive();
      expect(update.chain.set).not.toHaveBeenCalled();
      expect(notifications.emitMany).not.toHaveBeenCalled();
    });
  });

  // ---- F12: runFeedbackDueReminder ----
  describe("runFeedbackDueReminder", () => {
    async function setup(rows: Array<{ id: string; applicationId: string; recruiterId: string; scheduledAt: Date; durationMinutes: number; candidateId: string; jobId: string }>) {
      const select = jest.fn().mockReturnValue(selectRows(rows));
      const update = makeUpdateMock();
      const db = { select, update: update.fn };
      const notifications = { emit: jest.fn(), emitMany: jest.fn() };
      const queue = { add: jest.fn() };

      const moduleRef = await Test.createTestingModule({
        providers: [
          NotificationsScheduler,
          { provide: DRIZZLE_CLIENT, useValue: db },
          { provide: NotificationsService, useValue: notifications },
          { provide: getQueueToken(NOTIFICATION_EMAIL_QUEUE), useValue: queue },
        ],
      }).compile();

      return {
        scheduler: moduleRef.get(NotificationsScheduler),
        notifications,
        update,
      };
    }

    it("emits interview_feedback_due to recruiter and stamps feedbackReminderSentAt", async () => {
      const { scheduler, notifications, update } = await setup([
        {
          id: "iv1",
          applicationId: "a1",
          recruiterId: "r1",
          scheduledAt: new Date(Date.now() - 26 * 3600 * 1000),
          durationMinutes: 60,
          candidateId: "c1",
          jobId: "j1",
        },
      ]);

      await scheduler.runFeedbackDueReminder();

      expect(notifications.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "interview_feedback_due",
          userId: "r1",
          entityType: "interview",
          entityId: "iv1",
        }),
      );
      expect(update.chain.set).toHaveBeenCalledWith(
        expect.objectContaining({ feedbackReminderSentAt: expect.any(Date) }),
      );
    });
  });

  // ---- F13: runDigest ----
  describe("runDigest", () => {
    async function setup(groupRows: Array<{ user_id: string; notification_ids: string[] }>) {
      const execute = jest.fn().mockResolvedValue(groupRows);
      const update = makeUpdateMock();
      const db = { execute, update: update.fn };
      const notifications = { emit: jest.fn(), emitMany: jest.fn() };
      const queue = { add: jest.fn() };

      const moduleRef = await Test.createTestingModule({
        providers: [
          NotificationsScheduler,
          { provide: DRIZZLE_CLIENT, useValue: db },
          { provide: NotificationsService, useValue: notifications },
          { provide: getQueueToken(NOTIFICATION_EMAIL_QUEUE), useValue: queue },
        ],
      }).compile();

      return {
        scheduler: moduleRef.get(NotificationsScheduler),
        queue,
        update,
        db,
      };
    }

    it("enqueues one digest job per user and clears digest_pending on the grouped ids", async () => {
      const { scheduler, queue, update } = await setup([
        { user_id: "u1", notification_ids: ["n1", "n2"] },
        { user_id: "u2", notification_ids: ["n3"] },
      ]);

      await scheduler.runDigest();

      const digestCalls = queue.add.mock.calls.filter(
        ([, payload]: [string, { kind?: string }]) => payload?.kind === "digest",
      );
      expect(digestCalls).toHaveLength(2);
      expect(queue.add).toHaveBeenCalledWith(
        "digest-email",
        expect.objectContaining({
          kind: "digest",
          userId: "u1",
          notificationIds: ["n1", "n2"],
        }),
        expect.any(Object),
      );
      // each user's grouped ids → one update setting digest_pending=false
      expect(update.chain.set).toHaveBeenCalledWith({ digestPending: false });
      expect(update.chain.set).toHaveBeenCalledTimes(2);
    });

    it("a single user's enqueue failure does not abort the remaining users", async () => {
      const { scheduler, queue } = await setup([
        { user_id: "u1", notification_ids: ["n1"] },
        { user_id: "u2", notification_ids: ["n2"] },
      ]);
      queue.add
        .mockRejectedValueOnce(new Error("redis down"))
        .mockResolvedValueOnce(undefined);

      await expect(scheduler.runDigest()).resolves.toBeUndefined();
      expect(queue.add).toHaveBeenCalledTimes(2);
    });

    it("accepts pg-style { rows: [...] } shape from db.execute", async () => {
      const { scheduler, queue, db } = await setup([]);
      (db.execute as jest.Mock).mockResolvedValueOnce({
        rows: [{ user_id: "u1", notification_ids: ["n1"] }],
      });

      await scheduler.runDigest();
      expect(queue.add).toHaveBeenCalledWith(
        "digest-email",
        expect.objectContaining({ kind: "digest", userId: "u1" }),
        expect.any(Object),
      );
    });
  });
});
