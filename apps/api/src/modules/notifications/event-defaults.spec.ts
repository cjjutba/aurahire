import {
  DEFAULT_MODES,
  SECURITY_EVENTS,
  EVENT_CATEGORIES,
  ROLE_VISIBLE_EVENTS,
  EVENT_LABELS,
  EVENT_DESCRIPTIONS,
} from "./event-defaults";
import { NOTIFICATION_EVENT_TYPE } from "@aurahire/db";

describe("event-defaults", () => {
  it("DEFAULT_MODES has an entry for every NOTIFICATION_EVENT_TYPE", () => {
    for (const eventType of NOTIFICATION_EVENT_TYPE) {
      expect(DEFAULT_MODES[eventType]).toBeDefined();
    }
  });

  it("SECURITY_EVENTS contains the 4 always-instant event types", () => {
    expect(SECURITY_EVENTS.has("account_password_reset")).toBe(true);
    expect(SECURITY_EVENTS.has("account_email_verified")).toBe(true);
    expect(SECURITY_EVENTS.has("account_login_new_device")).toBe(true);
    expect(SECURITY_EVENTS.has("offer_expiring_soon")).toBe(true);
    expect(SECURITY_EVENTS.size).toBe(4);
  });

  it("default mode is 'digest' for the high-volume events", () => {
    expect(DEFAULT_MODES.new_application_received).toBe("digest");
    expect(DEFAULT_MODES.team_invite_accepted).toBe("digest");
    expect(DEFAULT_MODES.team_invite_declined).toBe("digest");
    expect(DEFAULT_MODES.system_moderation_queue_item).toBe("digest");
  });

  it("default mode is 'instant' for security and offer events", () => {
    expect(DEFAULT_MODES.account_password_reset).toBe("instant");
    expect(DEFAULT_MODES.offer_received).toBe("instant");
    expect(DEFAULT_MODES.offer_expiring_soon).toBe("instant");
    expect(DEFAULT_MODES.bias_flag_raised).toBe("instant");
  });

  it("EVENT_CATEGORIES maps each event to a category string", () => {
    for (const eventType of NOTIFICATION_EVENT_TYPE) {
      expect(EVENT_CATEGORIES[eventType]).toBeDefined();
    }
    expect(EVENT_CATEGORIES.application_status_changed).toBe("applications");
    expect(EVENT_CATEGORIES.account_password_reset).toBe("account");
    expect(EVENT_CATEGORIES.system_bias_flag_raised).toBe("system");
  });

  it("ROLE_VISIBLE_EVENTS lists the events each role's settings page can toggle", () => {
    expect(ROLE_VISIBLE_EVENTS.candidate).toContain(
      "application_status_changed",
    );
    expect(ROLE_VISIBLE_EVENTS.candidate).not.toContain(
      "new_application_received",
    );
    expect(ROLE_VISIBLE_EVENTS.recruiter).toContain("new_application_received");
    expect(ROLE_VISIBLE_EVENTS.admin).toContain("system_bias_flag_raised");
  });

  it("EVENT_LABELS and EVENT_DESCRIPTIONS have entries for every event type", () => {
    for (const eventType of NOTIFICATION_EVENT_TYPE) {
      expect(EVENT_LABELS[eventType]).toBeTruthy();
      expect(EVENT_DESCRIPTIONS[eventType]).toBeTruthy();
    }
  });
});
