import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { matchScoreColors, JobCard } from "./job-card";

describe("matchScoreColors", () => {
  it("returns score-high tokens for scores >= 70", () => {
    expect(matchScoreColors(70)).toEqual({
      fill: "var(--color-score-high)",
      track: "var(--color-score-high-soft)",
    });
    expect(matchScoreColors(100)).toEqual({
      fill: "var(--color-score-high)",
      track: "var(--color-score-high-soft)",
    });
  });

  it("returns score-mid tokens for scores in [40, 70)", () => {
    expect(matchScoreColors(40)).toEqual({
      fill: "var(--color-score-mid)",
      track: "var(--color-score-mid-soft)",
    });
    expect(matchScoreColors(69)).toEqual({
      fill: "var(--color-score-mid)",
      track: "var(--color-score-mid-soft)",
    });
  });

  it("returns score-low tokens for scores below 40", () => {
    expect(matchScoreColors(0)).toEqual({
      fill: "var(--color-score-low)",
      track: "var(--color-score-low-soft)",
    });
    expect(matchScoreColors(39)).toEqual({
      fill: "var(--color-score-low)",
      track: "var(--color-score-low-soft)",
    });
  });
});

const baseJob = {
  id: "job-1",
  title: "Staff Backend Engineer",
  department: "Engineering",
  employmentType: "full-time",
  workMode: "remote",
  locationCity: "Manila",
  locationCountry: "Philippines",
  salaryMin: 220000,
  salaryMax: 340000,
  salaryCurrency: "PHP",
  status: "published" as const,
  publishedAt: "2026-05-01T00:00:00Z",
  company: { name: "TechCorp Inc.", logoUrl: null },
};

describe("JobCard score row", () => {
  it("renders MatchBandChip + numeric score + filled progress bar when matchPreview is present", () => {
    const { container } = render(
      <JobCard
        job={baseJob}
        href="/candidate/jobs/job-1"
        matchPreview={{ overallScore: 76, band: "strong" }}
      />,
    );

    expect(screen.getByText(/strong match/i)).toBeInTheDocument();
    expect(screen.getByText("76")).toBeInTheDocument();
    expect(screen.getByText("/ 100")).toBeInTheDocument();

    const fillBar = container.querySelector<HTMLDivElement>(
      "[data-testid='job-card-match-fill']",
    );
    expect(fillBar).not.toBeNull();
    expect(fillBar!.style.width).toBe("76%");
    expect(fillBar!.style.backgroundColor).toBe("var(--color-score-high)");
  });

  it("omits the score row entirely when no matchPreview and not loading", () => {
    const { container } = render(
      <JobCard job={baseJob} href="/candidate/jobs/job-1" />,
    );

    expect(
      screen.queryByText(/strong match|partial match|limited match/i),
    ).toBeNull();
    expect(
      container.querySelector("[data-testid='job-card-match-fill']"),
    ).toBeNull();
    expect(
      container.querySelector("[data-testid='job-card-match-skeleton']"),
    ).toBeNull();
  });

  it("renders the skeleton placeholder when matchPreviewLoading and no matchPreview", () => {
    const { container } = render(
      <JobCard
        job={baseJob}
        href="/candidate/jobs/job-1"
        matchPreviewLoading
      />,
    );

    expect(
      container.querySelector("[data-testid='job-card-match-skeleton']"),
    ).not.toBeNull();
    expect(
      screen.queryByText(/strong match|partial match|limited match/i),
    ).toBeNull();
  });

  it("matchPreview wins over matchPreviewLoading (no skeleton when both set)", () => {
    const { container } = render(
      <JobCard
        job={baseJob}
        href="/candidate/jobs/job-1"
        matchPreview={{ overallScore: 45, band: "partial" }}
        matchPreviewLoading
      />,
    );

    expect(screen.getByText(/partial match/i)).toBeInTheDocument();
    expect(
      container.querySelector("[data-testid='job-card-match-skeleton']"),
    ).toBeNull();
  });
});
