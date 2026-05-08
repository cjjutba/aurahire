import { Test } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import { NotificationsService } from "./notifications.service";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationPreferencesService } from "../notification-preferences/notification-preferences.service";
import { NOTIFICATION_EMAIL_QUEUE } from "./queues";
import { ProfilesRepository } from "../profiles/profiles.repository";
import { EventsService } from "../../realtime";

const mockRepo = () => ({
  insertOne: jest.fn(),
  insertMany: jest.fn(),
  setDigestPending: jest.fn(),
  countUnread: jest.fn().mockResolvedValue(0),
  markRead: jest.fn(),
  markAllRead: jest.fn(),
  archive: jest.fn(),
  archiveAllForUser: jest.fn(),
  dismiss: jest.fn(),
});
const mockPrefs = () => ({ getEffectiveMode: jest.fn() });
const mockQueue = () => ({ add: jest.fn() });
const mockProfiles = () => ({ findById: jest.fn() });
const mockEvents = () => ({
  emitNotificationCreated: jest.fn(),
  emitNotificationRead: jest.fn(),
  emitNotificationArchived: jest.fn(),
  emitNotificationArchiveAll: jest.fn(),
});

describe("NotificationsService.emit", () => {
  let service: NotificationsService;
  let repo: ReturnType<typeof mockRepo>;
  let prefs: ReturnType<typeof mockPrefs>;
  let queue: ReturnType<typeof mockQueue>;
  let profiles: ReturnType<typeof mockProfiles>;
  let events: ReturnType<typeof mockEvents>;

  beforeEach(async () => {
    repo = mockRepo();
    prefs = mockPrefs();
    queue = mockQueue();
    profiles = mockProfiles();
    events = mockEvents();

    profiles.findById.mockResolvedValue({ id: "u1", status: "active", role: "candidate" });

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsRepository, useValue: repo },
        { provide: NotificationPreferencesService, useValue: prefs },
        { provide: getQueueToken(NOTIFICATION_EMAIL_QUEUE), useValue: queue },
        { provide: ProfilesRepository, useValue: profiles },
        { provide: EventsService, useValue: events },
        Logger,
      ],
    }).compile();

    service = moduleRef.get(NotificationsService);
    repo.insertOne.mockResolvedValue({
      id: "n1",
      userId: "u1",
      eventType: "application_status_changed",
      title: "Status changed",
      body: "Your application moved to interview",
      link: "/candidate/applications/app1",
      createdAt: new Date("2026-05-08T12:00:00Z"),
    });
  });

  it("inserts a row and enqueues an email job when mode is 'instant'", async () => {
    prefs.getEffectiveMode.mockResolvedValue("instant");
    await service.emit({
      userId: "u1",
      eventType: "application_status_changed",
      entityType: "application",
      entityId: "app1",
      metadata: { newStatus: "interview" },
    });
    expect(repo.insertOne).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      "instant-email",
      { kind: "instant", notificationId: "n1" },
      expect.any(Object),
    );
    expect(repo.setDigestPending).not.toHaveBeenCalled();
  });

  it("marks digest_pending and skips queue when mode is 'digest'", async () => {
    prefs.getEffectiveMode.mockResolvedValue("digest");
    await service.emit({
      userId: "u1",
      eventType: "new_application_received",
    });
    expect(repo.insertOne).toHaveBeenCalled();
    expect(repo.setDigestPending).toHaveBeenCalledWith("n1", true);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("inserts but does not enqueue or mark digest when mode is 'off'", async () => {
    prefs.getEffectiveMode.mockResolvedValue("off");
    await service.emit({ userId: "u1", eventType: "team_invite_accepted" });
    expect(repo.insertOne).toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
    expect(repo.setDigestPending).not.toHaveBeenCalled();
  });

  it("ignores preferences for SECURITY_EVENTS and always sends instant", async () => {
    prefs.getEffectiveMode.mockResolvedValue("off");
    await service.emit({ userId: "u1", eventType: "account_password_reset" });
    expect(queue.add).toHaveBeenCalled();
  });

  it("does not insert a row when userId === actorId (self-targeting)", async () => {
    await service.emit({
      userId: "u1",
      actorId: "u1",
      eventType: "application_status_changed",
    });
    expect(repo.insertOne).not.toHaveBeenCalled();
  });

  it("does not insert a row for suspended users", async () => {
    profiles.findById.mockResolvedValue({ id: "u1", status: "suspended", role: "candidate" });
    await service.emit({ userId: "u1", eventType: "application_status_changed" });
    expect(repo.insertOne).not.toHaveBeenCalled();
  });

  it("does not insert a row when profile is null", async () => {
    profiles.findById.mockResolvedValue(null);
    await service.emit({ userId: "u1", eventType: "application_status_changed" });
    expect(repo.insertOne).not.toHaveBeenCalled();
  });

  it("swallows errors and never throws", async () => {
    repo.insertOne.mockRejectedValue(new Error("boom"));
    prefs.getEffectiveMode.mockResolvedValue("instant");
    await expect(
      service.emit({ userId: "u1", eventType: "application_status_changed" }),
    ).resolves.toBeUndefined();
  });

  it("emitMany fans out to all user ids", async () => {
    profiles.findById.mockResolvedValue({ id: "x", status: "active", role: "admin" });
    prefs.getEffectiveMode.mockResolvedValue("instant");
    await service.emitMany(["a", "b", "c"], {
      eventType: "system_bias_flag_raised",
      scope: "system",
    });
    expect(repo.insertOne).toHaveBeenCalledTimes(3);
  });

  it("broadcasts notification.created with the unread count", async () => {
    prefs.getEffectiveMode.mockResolvedValue("instant");
    repo.countUnread.mockResolvedValue(7);
    await service.emit({
      userId: "u1",
      eventType: "application_status_changed",
      metadata: { newStatus: "interview" },
    });
    expect(events.emitNotificationCreated).toHaveBeenCalledTimes(1);
    expect(events.emitNotificationCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "n1",
        userId: "u1",
        kind: "application_status_changed",
        unreadCount: 7,
        title: expect.any(String),
        bodyExcerpt: expect.any(String),
        createdAt: expect.any(String),
      }),
    );
  });

  it("does NOT emit notification.created when the row is not inserted (self-emit)", async () => {
    await service.emit({
      userId: "u1",
      actorId: "u1",
      eventType: "application_status_changed",
    });
    expect(events.emitNotificationCreated).not.toHaveBeenCalled();
  });
});

describe("NotificationsService mark/archive realtime emits", () => {
  let service: NotificationsService;
  let repo: ReturnType<typeof mockRepo>;
  let events: ReturnType<typeof mockEvents>;

  beforeEach(async () => {
    repo = mockRepo();
    const prefs = mockPrefs();
    const queue = mockQueue();
    const profiles = mockProfiles();
    events = mockEvents();

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsRepository, useValue: repo },
        { provide: NotificationPreferencesService, useValue: prefs },
        { provide: getQueueToken(NOTIFICATION_EMAIL_QUEUE), useValue: queue },
        { provide: ProfilesRepository, useValue: profiles },
        { provide: EventsService, useValue: events },
        Logger,
      ],
    }).compile();

    service = moduleRef.get(NotificationsService);
  });

  it("markRead emits notification.read with the new unreadCount", async () => {
    repo.markRead.mockResolvedValue({ unreadCount: 4 });
    await service.markRead("n1", "u1");
    expect(repo.markRead).toHaveBeenCalledWith("n1", "u1");
    expect(events.emitNotificationRead).toHaveBeenCalledWith("u1", {
      id: "n1",
      unreadCount: 4,
    });
  });

  it("archive sets dismissed_at via the repo and emits notification.archived", async () => {
    repo.archive.mockResolvedValue({ unreadCount: 2 });
    const result = await service.archive("n1", "u1");
    expect(repo.archive).toHaveBeenCalledWith("n1", "u1");
    expect(events.emitNotificationArchived).toHaveBeenCalledWith("u1", {
      id: "n1",
      unreadCount: 2,
    });
    expect(result.unreadCount).toBe(2);
  });

  it("dismiss is an alias for archive — same repo path, same event", async () => {
    repo.archive.mockResolvedValue({ unreadCount: 1 });
    await service.dismiss("n1", "u1");
    expect(repo.archive).toHaveBeenCalledWith("n1", "u1");
    expect(events.emitNotificationArchived).toHaveBeenCalledWith("u1", {
      id: "n1",
      unreadCount: 1,
    });
  });

  it("archiveAll empties the inbox and emits notification.archive_all with unreadCount 0", async () => {
    repo.archiveAllForUser.mockResolvedValue({ unreadCount: 0 });
    const result = await service.archiveAll("u1");
    expect(repo.archiveAllForUser).toHaveBeenCalledWith("u1");
    expect(events.emitNotificationArchiveAll).toHaveBeenCalledWith("u1", {
      unreadCount: 0,
    });
    expect(result).toEqual({ unreadCount: 0, count: 0, displayCount: "0" });
  });
});
