import { NOTIFICATION_EVENT_TYPE } from "@aurahire/db";
import {
  buildTitle,
  buildBody,
  buildLink,
  emailSubject,
  getIconName,
} from "./templates";

describe("template registry", () => {
  it("every event type has a non-empty title, body, subject, and icon", () => {
    for (const eventType of NOTIFICATION_EVENT_TYPE) {
      expect(buildTitle(eventType, {})).toBeTruthy();
      expect(buildBody(eventType, {})).toBeTruthy();
      expect(emailSubject(eventType, {})).toBeTruthy();
      expect(getIconName(eventType)).toBeTruthy();
    }
  });

  it("buildLink returns null or an absolute path", () => {
    for (const eventType of NOTIFICATION_EVENT_TYPE) {
      const link = buildLink(eventType, "candidate", { applicationId: "x" });
      expect(link === null || link.startsWith("/")).toBe(true);
    }
  });

  it("application_status_changed renders the new status in the title", () => {
    expect(
      buildTitle("application_status_changed", { newStatus: "Interview" }),
    ).toContain("Interview");
  });

  it("system events route to /admin/* paths", () => {
    expect(
      buildLink("system_bias_flag_raised", "admin", { flagId: "f1" }),
    ).toBe("/admin/bias-flags/f1");
    expect(buildLink("system_moderation_queue_item", "admin", {})).toBe(
      "/admin/moderation",
    );
  });

  it("account events route to the recipient's role-specific security page", () => {
    expect(buildLink("account_password_reset", "candidate", {})).toBe(
      "/candidate/settings/security",
    );
    expect(buildLink("account_password_reset", "recruiter", {})).toBe(
      "/recruiter/settings/security",
    );
    expect(buildLink("account_password_reset", "admin", {})).toBe(
      "/admin/settings/security",
    );
  });
});
