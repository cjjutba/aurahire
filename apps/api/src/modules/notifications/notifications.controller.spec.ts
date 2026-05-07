// Mock jose (ESM-only) before any module in the chain loads it
jest.mock("jose", () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { Test } from "@nestjs/testing";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { AuditService } from "../../audit/audit.service";

const buildUser = (overrides: Partial<{ id: string; role: "candidate" | "recruiter" | "admin"; email: string }> = {}) => ({
  id: "u1",
  email: "u@x.io",
  role: "candidate" as const,
  status: "active" as const,
  fullName: "Test",
  profileCompleted: true,
  ...overrides,
});

describe("NotificationsController", () => {
  let controller: NotificationsController;
  let service: any;
  let audit: any;

  beforeEach(async () => {
    service = {
      listForUser: jest.fn(),
      getUnreadCount: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
      dismiss: jest.fn(),
    };
    audit = { log: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: service },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    controller = moduleRef.get(NotificationsController);
  });

  it("getUnreadCount returns the service's count and displayCount", async () => {
    service.getUnreadCount.mockResolvedValue({ count: 5, displayCount: "5" });
    const result = await controller.unreadCount(buildUser() as any);
    expect(result).toEqual({ count: 5, displayCount: "5" });
    expect(service.getUnreadCount).toHaveBeenCalledWith("u1");
  });

  it("list passes user.id and query through to the service", async () => {
    service.listForUser.mockResolvedValue({ items: [], nextCursor: null });
    await controller.list(buildUser() as any, { tab: "unread", limit: 20 } as any);
    expect(service.listForUser).toHaveBeenCalledWith("u1", { tab: "unread", limit: 20 });
  });

  it("markRead delegates to service and does NOT audit-log per-row reads", async () => {
    service.markRead.mockResolvedValue({ unreadCount: 4, count: 4, displayCount: "4" });
    await controller.markRead(buildUser() as any, "n1");
    expect(service.markRead).toHaveBeenCalledWith("n1", "u1");
    expect(audit.log).not.toHaveBeenCalled();
  });

  it("markAllRead writes an audit log entry with the role as actorType", async () => {
    service.markAllRead.mockResolvedValue({ unreadCount: 0, count: 0, displayCount: "0" });
    await controller.markAllRead(buildUser({ role: "recruiter" }) as any);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "u1",
        actorType: "user",
        action: expect.stringContaining("notifications.marked_all_read"),
        entityType: "notifications",
        entityId: "u1",
      }),
    );
  });

  it("dismiss returns the capped displayCount when count exceeds 99", async () => {
    service.dismiss.mockResolvedValue({ unreadCount: 150, count: 150, displayCount: "99+" });
    const result = await controller.dismiss(buildUser() as any, "n1");
    expect(result.displayCount).toBe("99+");
    expect(audit.log).not.toHaveBeenCalled();
  });

  it("dismiss does NOT audit-log per-row dismissals", async () => {
    service.dismiss.mockResolvedValue({ unreadCount: 3, count: 3, displayCount: "3" });
    await controller.dismiss(buildUser() as any, "n1");
    expect(audit.log).not.toHaveBeenCalled();
  });
});
