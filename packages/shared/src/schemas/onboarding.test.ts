import { describe, expect, it } from "vitest";

import { onboardingSkippedAnalyzingSchema } from "./onboarding";

describe("onboardingSkippedAnalyzingSchema", () => {
  it("accepts a valid payload with score_ready=true and previews_ready in 0..5", () => {
    const parsed = onboardingSkippedAnalyzingSchema.parse({
      scoreReady: true,
      previewsReady: 3,
    });
    expect(parsed).toEqual({ scoreReady: true, previewsReady: 3 });
  });

  it("accepts previewsReady=0 (skip happened the moment score landed)", () => {
    const parsed = onboardingSkippedAnalyzingSchema.parse({
      scoreReady: true,
      previewsReady: 0,
    });
    expect(parsed.previewsReady).toBe(0);
  });

  it("accepts previewsReady=5 (skip happened after all five matches landed but before auto-redirect)", () => {
    const parsed = onboardingSkippedAnalyzingSchema.parse({
      scoreReady: true,
      previewsReady: 5,
    });
    expect(parsed.previewsReady).toBe(5);
  });

  it("rejects previewsReady > 5", () => {
    expect(() =>
      onboardingSkippedAnalyzingSchema.parse({ scoreReady: true, previewsReady: 6 }),
    ).toThrow();
  });

  it("rejects negative previewsReady", () => {
    expect(() =>
      onboardingSkippedAnalyzingSchema.parse({ scoreReady: true, previewsReady: -1 }),
    ).toThrow();
  });

  it("rejects non-integer previewsReady", () => {
    expect(() =>
      onboardingSkippedAnalyzingSchema.parse({ scoreReady: true, previewsReady: 2.5 }),
    ).toThrow();
  });

  it("rejects missing fields", () => {
    expect(() => onboardingSkippedAnalyzingSchema.parse({})).toThrow();
  });
});
