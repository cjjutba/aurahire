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

  it("allows offer → hired | rejected | withdrawn", () => {
    expect(canTransition("offer", "hired")).toBe(true);
    expect(canTransition("offer", "rejected")).toBe(true);
    expect(canTransition("offer", "withdrawn")).toBe(true);
  });

  it("disallows transitions out of terminal states", () => {
    for (const t of ["hired", "rejected", "withdrawn"] as const) {
      expect(getNextStatuses(t).length).toBe(0);
    }
  });
});
