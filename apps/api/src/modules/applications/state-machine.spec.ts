import { canTransition, getNextStatuses } from "./state-machine";

describe("application state machine", () => {
  it("allows applied → screening | interview | rejected | withdrawn", () => {
    expect(canTransition("applied", "screening")).toBe(true);
    expect(canTransition("applied", "interview")).toBe(true);
    expect(canTransition("applied", "rejected")).toBe(true);
    expect(canTransition("applied", "withdrawn")).toBe(true);
    expect(canTransition("applied", "offer")).toBe(false);
    expect(canTransition("applied", "hired")).toBe(false);
  });

  it("allows screening → interview | rejected | withdrawn", () => {
    expect(canTransition("screening", "interview")).toBe(true);
    expect(canTransition("screening", "rejected")).toBe(true);
    expect(canTransition("screening", "withdrawn")).toBe(true);
    expect(canTransition("screening", "offer")).toBe(false);
  });

  it("allows interview → offer | rejected | withdrawn", () => {
    expect(canTransition("interview", "offer")).toBe(true);
    expect(canTransition("interview", "rejected")).toBe(true);
    expect(canTransition("interview", "withdrawn")).toBe(true);
  });

  it("allows offer → offer_accepted | offer_declined | rejected | withdrawn (no direct hired)", () => {
    expect(canTransition("offer", "offer_accepted")).toBe(true);
    expect(canTransition("offer", "offer_declined")).toBe(true);
    expect(canTransition("offer", "rejected")).toBe(true);
    expect(canTransition("offer", "withdrawn")).toBe(true);
    expect(canTransition("offer", "hired")).toBe(false);
  });

  it("allows offer_accepted → hired | rejected | withdrawn", () => {
    expect(canTransition("offer_accepted", "hired")).toBe(true);
    expect(canTransition("offer_accepted", "rejected")).toBe(true);
    expect(canTransition("offer_accepted", "withdrawn")).toBe(true);
  });

  it("disallows offer_accepted → applied | screening | interview | offer | offer_declined", () => {
    expect(canTransition("offer_accepted", "applied")).toBe(false);
    expect(canTransition("offer_accepted", "screening")).toBe(false);
    expect(canTransition("offer_accepted", "interview")).toBe(false);
    expect(canTransition("offer_accepted", "offer")).toBe(false);
    expect(canTransition("offer_accepted", "offer_declined")).toBe(false);
  });

  it("disallows transitions out of terminal states", () => {
    for (const t of ["hired", "rejected", "withdrawn"] as const) {
      expect(getNextStatuses(t).length).toBe(0);
    }
  });

  it("allows offer → offer_declined (system-initiated)", () => {
    expect(canTransition("offer", "offer_declined")).toBe(true);
  });

  it("allows offer_declined → offer (recruiter re-extend)", () => {
    expect(canTransition("offer_declined", "offer")).toBe(true);
  });

  it("allows offer_declined → rejected | withdrawn", () => {
    expect(canTransition("offer_declined", "rejected")).toBe(true);
    expect(canTransition("offer_declined", "withdrawn")).toBe(true);
  });

  it("disallows offer_declined → hired (must re-extend + accept first)", () => {
    expect(canTransition("offer_declined", "hired")).toBe(false);
  });

  it("disallows offer_declined → applied | screening | interview", () => {
    expect(canTransition("offer_declined", "applied")).toBe(false);
    expect(canTransition("offer_declined", "screening")).toBe(false);
    expect(canTransition("offer_declined", "interview")).toBe(false);
  });

  it("exports STATUSES_REQUIRING_ACCEPTED_OFFER containing 'hired'", () => {
    // Imported lazily so the failing test guards the export shape too.
    const sm = require("./state-machine") as typeof import("./state-machine");
    expect(sm.STATUSES_REQUIRING_ACCEPTED_OFFER).toContain("hired");
  });
});
