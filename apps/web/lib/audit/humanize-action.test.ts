import { describe, expect, it } from "vitest";
import { humanizeAuditAction } from "./humanize-action";

describe("humanizeAuditAction", () => {
  describe("known action codes", () => {
    it("humanizes score.match.preview.computed", () => {
      expect(humanizeAuditAction("score.match.preview.computed")).toBe(
        "Job match preview computed",
      );
    });

    it("humanizes resume.parsed", () => {
      expect(humanizeAuditAction("resume.parsed")).toBe("Resume parsed");
    });

    it("humanizes user.registered.candidate", () => {
      expect(humanizeAuditAction("user.registered.candidate")).toBe(
        "Candidate joined",
      );
    });

    it("humanizes user.registered.recruiter", () => {
      expect(humanizeAuditAction("user.registered.recruiter")).toBe(
        "Recruiter joined",
      );
    });

    it("humanizes user.email_verified", () => {
      expect(humanizeAuditAction("user.email_verified")).toBe("Email verified");
    });

    it("humanizes application.created", () => {
      expect(humanizeAuditAction("application.created")).toBe(
        "Application submitted",
      );
    });

    it("humanizes job.archived_by_cron", () => {
      expect(humanizeAuditAction("job.archived_by_cron")).toBe(
        "Job archived (deadline passed)",
      );
    });

    it("humanizes scoring_config.updated", () => {
      expect(humanizeAuditAction("scoring_config.updated")).toBe(
        "Scoring weights updated",
      );
    });

    it("humanizes bias_flag.overridden", () => {
      expect(humanizeAuditAction("bias_flag.overridden")).toBe(
        "Bias flag overridden",
      );
    });

    it("humanizes interview.scheduled", () => {
      expect(humanizeAuditAction("interview.scheduled")).toBe(
        "Interview scheduled",
      );
    });

    it("humanizes offer.accepted", () => {
      expect(humanizeAuditAction("offer.accepted")).toBe("Offer accepted");
    });

    it("humanizes cron.expire_offers.executed", () => {
      expect(humanizeAuditAction("cron.expire_offers.executed")).toBe(
        "Offer expiry cron ran",
      );
    });

    it("humanizes user.password_reset_forced", () => {
      expect(humanizeAuditAction("user.password_reset_forced")).toBe(
        "Password reset (forced by admin)",
      );
    });
  });

  describe("fallback for unknown codes", () => {
    it("title-cases dotted segments", () => {
      expect(humanizeAuditAction("foo.bar")).toBe("Foo Bar");
    });

    it("title-cases underscored tokens", () => {
      expect(humanizeAuditAction("foo.bar_baz")).toBe("Foo Bar Baz");
    });

    it("handles multi-segment unknowns", () => {
      expect(humanizeAuditAction("future.new_event.happened")).toBe(
        "Future New Event Happened",
      );
    });

    it("returns the input unchanged when it has no separators", () => {
      expect(humanizeAuditAction("Plain")).toBe("Plain");
    });
  });

  describe("edge cases", () => {
    it("returns an em-dash for an empty string", () => {
      expect(humanizeAuditAction("")).toBe("—");
    });

    it("trims whitespace before processing", () => {
      expect(humanizeAuditAction("  resume.parsed  ")).toBe("Resume parsed");
    });
  });
});
