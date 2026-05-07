import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { LowConfidenceBanner } from "./low-confidence-banner";

describe("LowConfidenceBanner", () => {
  it("renders banner when confidence is 'low'", () => {
    render(<LowConfidenceBanner confidence="low" />);
    expect(screen.getByText(/low-confidence parse/i)).toBeInTheDocument();
    expect(screen.getByText(/Double-check every prefilled field/i)).toBeInTheDocument();
  });

  it("renders nothing for 'high' confidence", () => {
    const { container } = render(<LowConfidenceBanner confidence="high" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for 'medium' confidence", () => {
    const { container } = render(<LowConfidenceBanner confidence="medium" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for null", () => {
    const { container } = render(<LowConfidenceBanner confidence={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for undefined", () => {
    const { container } = render(<LowConfidenceBanner confidence={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
