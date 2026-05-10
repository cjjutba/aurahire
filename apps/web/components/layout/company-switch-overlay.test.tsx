import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { CompanySwitchOverlay } from "./company-switch-overlay";
import {
  ActiveCompanyContextForTesting,
  type ActiveCompanyContextValue,
} from "@/contexts/active-company-context";

function harness(value: Partial<ActiveCompanyContextValue>) {
  const full: ActiveCompanyContextValue = {
    activeCompanyId: null,
    activeMembership: null,
    memberships: [],
    isLoading: false,
    isSwitching: false,
    pendingCompanyName: null,
    switchCompany: async () => {},
    prefetchCompanyDashboard: () => {},
    ...value,
  };
  return (
    <ActiveCompanyContextForTesting.Provider value={full}>
      <CompanySwitchOverlay />
    </ActiveCompanyContextForTesting.Provider>
  );
}

describe("CompanySwitchOverlay", () => {
  it("returns null when not switching", () => {
    const { container } = render(harness({ isSwitching: false }));
    expect(container.firstChild).toBeNull();
  });

  it("renders the overlay with the target company name when switching", () => {
    render(
      harness({
        isSwitching: true,
        pendingCompanyName: "Test Company",
      }),
    );
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent(/switching to/i);
    expect(status).toHaveTextContent("Test Company");
  });

  it("falls back to 'company' caption if pendingCompanyName is null", () => {
    render(harness({ isSwitching: true, pendingCompanyName: null }));
    expect(screen.getByRole("status")).toHaveTextContent(
      /switching to company/i,
    );
  });

  it("spinner has aria-label='Loading'", () => {
    render(harness({ isSwitching: true, pendingCompanyName: "X" }));
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });
});
