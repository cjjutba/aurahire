import { describe, expect, it } from "vitest";

import {
  analyzingReducer,
  canSkip,
  type AnalyzingProfileScore,
  type AnalyzingState,
} from "./_analyzing-client";

const SCORE: AnalyzingProfileScore = { overallScore: 78, band: "strong" };
const NOW = 1_000_000;

describe("analyzingReducer", () => {
  it("starts at computingProfileScore and transitions to profileScoreReady on PROFILE_SCORE_OK", () => {
    const next = analyzingReducer(
      { kind: "computingProfileScore" },
      { type: "PROFILE_SCORE_OK", score: SCORE, now: NOW },
    );
    expect(next).toEqual({
      kind: "profileScoreReady",
      score: SCORE,
      readyAt: NOW,
    });
  });

  it("transitions to profileScoreDegraded when PROFILE_SCORE_DEGRADED dispatches from initial state", () => {
    const next = analyzingReducer(
      { kind: "computingProfileScore" },
      { type: "PROFILE_SCORE_DEGRADED" },
    );
    expect(next.kind).toBe("profileScoreDegraded");
  });

  it("transitions to error and carries the message on PROFILE_SCORE_ERROR", () => {
    const next = analyzingReducer(
      { kind: "computingProfileScore" },
      { type: "PROFILE_SCORE_ERROR", message: "Network down" },
    );
    expect(next).toEqual({ kind: "error", message: "Network down" });
  });

  it("ignores PROFILE_SCORE_OK once the state has already moved past computing (no resurrection)", () => {
    const errored: AnalyzingState = { kind: "error", message: "Network down" };
    const next = analyzingReducer(errored, {
      type: "PROFILE_SCORE_OK",
      score: SCORE,
      now: NOW,
    });
    expect(next).toBe(errored);
  });

  it("ignores PROFILE_SCORE_DEGRADED once the state has moved past computing", () => {
    const ready: AnalyzingState = {
      kind: "profileScoreReady",
      score: SCORE,
      readyAt: NOW,
    };
    const next = analyzingReducer(ready, { type: "PROFILE_SCORE_DEGRADED" });
    expect(next).toBe(ready);
  });

  it("PREVIEW_TICK from profileScoreReady transitions to streamingPreviews with previewCount=1", () => {
    const ready: AnalyzingState = {
      kind: "profileScoreReady",
      score: SCORE,
      readyAt: NOW,
    };
    const next = analyzingReducer(ready, { type: "PREVIEW_TICK" });
    expect(next).toEqual({
      kind: "streamingPreviews",
      score: SCORE,
      readyAt: NOW,
      previewCount: 1,
    });
  });

  it("PREVIEW_TICK from streamingPreviews increments previewCount", () => {
    const streaming: AnalyzingState = {
      kind: "streamingPreviews",
      score: SCORE,
      readyAt: NOW,
      previewCount: 2,
    };
    const next = analyzingReducer(streaming, { type: "PREVIEW_TICK" });
    expect(next).toEqual({ ...streaming, previewCount: 3 });
  });

  it("PREVIEW_TICK is a no-op when fired before the score arrives", () => {
    const initial: AnalyzingState = { kind: "computingProfileScore" };
    const next = analyzingReducer(initial, { type: "PREVIEW_TICK" });
    expect(next).toBe(initial);
  });

  it("PREVIEW_TICK is a no-op in degraded/error/redirecting states", () => {
    const degraded: AnalyzingState = { kind: "profileScoreDegraded" };
    expect(analyzingReducer(degraded, { type: "PREVIEW_TICK" })).toBe(degraded);

    const errored: AnalyzingState = { kind: "error", message: "boom" };
    expect(analyzingReducer(errored, { type: "PREVIEW_TICK" })).toBe(errored);

    const redirecting: AnalyzingState = { kind: "redirecting" };
    expect(analyzingReducer(redirecting, { type: "PREVIEW_TICK" })).toBe(
      redirecting,
    );
  });

  it("REDIRECT collapses any state to redirecting", () => {
    const cases: AnalyzingState[] = [
      { kind: "computingProfileScore" },
      { kind: "profileScoreReady", score: SCORE, readyAt: NOW },
      {
        kind: "streamingPreviews",
        score: SCORE,
        readyAt: NOW,
        previewCount: 3,
      },
      { kind: "profileScoreDegraded" },
      { kind: "error", message: "x" },
    ];
    for (const c of cases) {
      expect(analyzingReducer(c, { type: "REDIRECT" }).kind).toBe(
        "redirecting",
      );
    }
  });
});

describe("canSkip", () => {
  it("is false during the initial computing state", () => {
    expect(canSkip({ kind: "computingProfileScore" })).toBe(false);
  });

  it("is true once the Profile Score is ready", () => {
    expect(
      canSkip({ kind: "profileScoreReady", score: SCORE, readyAt: NOW }),
    ).toBe(true);
  });

  it("is true while match previews are streaming", () => {
    expect(
      canSkip({
        kind: "streamingPreviews",
        score: SCORE,
        readyAt: NOW,
        previewCount: 2,
      }),
    ).toBe(true);
  });

  it("is true on the degraded path so the candidate can leave the spinner", () => {
    expect(canSkip({ kind: "profileScoreDegraded" })).toBe(true);
  });

  it("is false in the unrecoverable error state", () => {
    expect(canSkip({ kind: "error", message: "Network down" })).toBe(false);
  });

  it("is false in the validation-error state - the user must fix the wizard step", () => {
    expect(
      canSkip({
        kind: "validationError",
        message: "Add a desired role first",
        backToStep: "/onboarding/candidate/preferences",
        backLabel: "Go back to Preferences",
      }),
    ).toBe(false);
  });

  it("is false once a redirect is already in flight (no double-fire)", () => {
    expect(canSkip({ kind: "redirecting" })).toBe(false);
  });
});
