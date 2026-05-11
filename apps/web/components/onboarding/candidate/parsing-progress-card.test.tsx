import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ParsingProgressCard } from "./parsing-progress-card";
import type { ParsedResumeV2 } from "@/app/onboarding/candidate/_steps";

const FILE = { name: "resume.pdf", size: 10240, type: "application/pdf" };

function makeParsed(
  partial: Partial<{
    experience: number;
    education: number;
    skills: number;
    certifications: number;
    confidence: "high" | "medium" | "low";
  }> = {},
): ParsedResumeV2 {
  const exp = partial.experience ?? 3;
  const edu = partial.education ?? 1;
  const skl = partial.skills ?? 12;
  const crt = partial.certifications ?? 1;
  return {
    contact: {
      full_name: null,
      full_name_source: null,
      email: null,
      email_source: null,
      phone: null,
      phone_source: null,
      location_city: null,
      location_city_source: null,
      location_country: null,
      location_country_source: null,
      linkedin_url: null,
      linkedin_url_source: null,
      portfolio_url: null,
      portfolio_url_source: null,
    },
    summary: null,
    education: Array.from({ length: edu }, () => ({
      institution: "Stanford",
      institution_source: "Stanford",
      degree: null,
      degree_source: null,
      field_of_study: null,
      field_of_study_source: null,
      start_year: null,
      end_year: null,
      period_source: null,
      gpa: null,
      gpa_source: null,
    })),
    experience: Array.from({ length: exp }, () => ({
      company: "Acme",
      company_source: "Acme",
      title: "Engineer",
      title_source: "Engineer",
      start_date: null,
      end_date: null,
      period_source: "",
      is_current: false,
      responsibilities: [],
      responsibilities_source: [],
      technologies_used: [],
    })),
    skills: Array.from({ length: skl }, (_, i) => ({
      name: `skill-${i}`,
      source: `skill-${i}`,
    })),
    certifications: Array.from({ length: crt }, () => ({
      name: "AWS",
      name_source: "AWS",
      issuing_organization: null,
      issuing_organization_source: null,
      issue_date: null,
      issue_date_source: null,
      expires: null,
    })),
    languages: [],
    parse_confidence: partial.confidence ?? "high",
  };
}

describe("ParsingProgressCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders all four stage labels in parsing state", () => {
    render(
      <ParsingProgressCard file={FILE} parseStatus="parsing" parsed={null} />,
    );
    expect(screen.getByText("Uploading file")).toBeInTheDocument();
    expect(screen.getByText("Extracting text")).toBeInTheDocument();
    expect(
      screen.getByText("Identifying experience & skills"),
    ).toBeInTheDocument();
    expect(screen.getByText("Polishing the details")).toBeInTheDocument();
  });

  it("renders the 'Done · ...' summary line when parseStatus is 'done'", () => {
    render(
      <ParsingProgressCard
        file={FILE}
        parseStatus="done"
        parsed={makeParsed({
          experience: 3,
          education: 1,
          skills: 12,
          certifications: 1,
        })}
      />,
    );
    const line = screen.getByTestId("parse-done-summary");
    expect(line).toHaveTextContent(
      "Done · 3 experiences, 1 school, 12 skills, 1 cert extracted",
    );
  });

  it("omits zero-count categories from the summary line", () => {
    render(
      <ParsingProgressCard
        file={FILE}
        parseStatus="done"
        parsed={makeParsed({
          experience: 2,
          education: 0,
          skills: 5,
          certifications: 0,
        })}
      />,
    );
    const line = screen.getByTestId("parse-done-summary");
    expect(line).toHaveTextContent("Done · 2 experiences, 5 skills extracted");
    expect(line).not.toHaveTextContent("school");
    expect(line).not.toHaveTextContent("cert");
  });

  it("appends 'Some fields may need review' suffix on low confidence", () => {
    render(
      <ParsingProgressCard
        file={FILE}
        parseStatus="done"
        parsed={makeParsed({
          confidence: "low",
          experience: 1,
          education: 1,
          skills: 4,
          certifications: 0,
        })}
      />,
    );
    const line = screen.getByTestId("parse-done-summary");
    expect(line).toHaveTextContent("Some fields may need review");
  });

  it("does not append the low-confidence suffix on high or medium confidence", () => {
    render(
      <ParsingProgressCard
        file={FILE}
        parseStatus="done"
        parsed={makeParsed({ confidence: "medium" })}
      />,
    );
    expect(screen.queryByText(/Some fields may need review/)).toBeNull();
  });

  it("swaps the caption above the file row when in done state", () => {
    const { rerender } = render(
      <ParsingProgressCard file={FILE} parseStatus="parsing" parsed={null} />,
    );
    expect(screen.getByTestId("parse-caption")).toHaveTextContent(
      "Hang tight, this usually takes 5-15 seconds.",
    );
    rerender(
      <ParsingProgressCard
        file={FILE}
        parseStatus="done"
        parsed={makeParsed()}
      />,
    );
    expect(screen.getByTestId("parse-caption")).toHaveTextContent(
      "Routing to your details...",
    );
  });

  it("fires onAutoAdvance exactly once 1500 ms after entering 'done'", () => {
    const onAutoAdvance = vi.fn();
    render(
      <ParsingProgressCard
        file={FILE}
        parseStatus="done"
        parsed={makeParsed()}
        onAutoAdvance={onAutoAdvance}
      />,
    );
    expect(onAutoAdvance).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1499);
    });
    expect(onAutoAdvance).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onAutoAdvance).toHaveBeenCalledTimes(1);
    // Should not fire again on additional time advance.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onAutoAdvance).toHaveBeenCalledTimes(1);
  });

  it("does not fire onAutoAdvance while still in 'parsing' state", () => {
    const onAutoAdvance = vi.fn();
    render(
      <ParsingProgressCard
        file={FILE}
        parseStatus="parsing"
        parsed={null}
        onAutoAdvance={onAutoAdvance}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onAutoAdvance).not.toHaveBeenCalled();
  });

  it("clears the auto-advance timer if unmounted before it fires", () => {
    const onAutoAdvance = vi.fn();
    const { unmount } = render(
      <ParsingProgressCard
        file={FILE}
        parseStatus="done"
        parsed={makeParsed()}
        onAutoAdvance={onAutoAdvance}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(500);
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onAutoAdvance).not.toHaveBeenCalled();
  });
});
