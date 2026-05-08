import { describe, expect, it } from "vitest";

import { matchScoreColors } from "./job-card";

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
