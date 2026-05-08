import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { EventEmitter } from "node:events";

import { RealtimeEvent } from "@aurahire/shared";

// We mock the socket provider hook to return a controllable EventEmitter so
// the channel hook can `.on/.off` against it the same way socket.io-client
// behaves at runtime.
class FakeSocket extends EventEmitter {
  // socket.io clients carry many other properties, but the hooks under
  // test only touch `.on` / `.off`, both inherited from EventEmitter.
}

const fakeSocket = new FakeSocket();

vi.mock("@/components/providers/socket-provider", () => ({
  useSocket: () => ({ socket: fakeSocket, status: "connected" }),
}));

import { useCandidateRealtime } from "./use-candidate-realtime";

const CANDIDATE_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_CANDIDATE_ID = "22222222-2222-2222-2222-222222222222";
const JOB_ID = "33333333-3333-3333-3333-333333333333";
const RESUME_ID = "44444444-4444-4444-4444-444444444444";

function makeMatchPreviewPayload(overrides: Partial<{ candidateId: string }> = {}) {
  return {
    candidateId: overrides.candidateId ?? CANDIDATE_ID,
    jobId: JOB_ID,
    resumeId: RESUME_ID,
    source: "system" as const,
    overallScore: 80,
    band: "strong" as const,
    createdAt: new Date().toISOString(),
  };
}

function makeProfileScorePayload(overrides: Partial<{ candidateId: string }> = {}) {
  return {
    candidateId: overrides.candidateId ?? CANDIDATE_ID,
    resumeId: RESUME_ID,
    overallScore: 72,
    band: "partial" as const,
    reason: "resume_change" as const,
    updatedAt: new Date().toISOString(),
  };
}

describe("useCandidateRealtime", () => {
  beforeEach(() => {
    fakeSocket.removeAllListeners();
  });

  it("returns zero counts and null payloads on initial mount", () => {
    const { result } = renderHook(() => useCandidateRealtime(CANDIDATE_ID));
    expect(result.current.matchPreviewCount).toBe(0);
    expect(result.current.latestMatchPreview).toBeNull();
    expect(result.current.latestProfileScore).toBeNull();
  });

  it("increments matchPreviewCount and caches the payload on match-preview.created", () => {
    const { result } = renderHook(() => useCandidateRealtime(CANDIDATE_ID));
    const payload = makeMatchPreviewPayload();

    act(() => {
      fakeSocket.emit(RealtimeEvent.MatchPreviewCreated, payload);
    });

    expect(result.current.matchPreviewCount).toBe(1);
    expect(result.current.latestMatchPreview).toEqual(payload);
  });

  it("ignores match-preview.created events for other candidates", () => {
    const { result } = renderHook(() => useCandidateRealtime(CANDIDATE_ID));

    act(() => {
      fakeSocket.emit(
        RealtimeEvent.MatchPreviewCreated,
        makeMatchPreviewPayload({ candidateId: OTHER_CANDIDATE_ID }),
      );
    });

    expect(result.current.matchPreviewCount).toBe(0);
    expect(result.current.latestMatchPreview).toBeNull();
  });

  it("accumulates the count across multiple match-preview events", () => {
    const { result } = renderHook(() => useCandidateRealtime(CANDIDATE_ID));

    act(() => {
      fakeSocket.emit(RealtimeEvent.MatchPreviewCreated, makeMatchPreviewPayload());
      fakeSocket.emit(RealtimeEvent.MatchPreviewCreated, makeMatchPreviewPayload());
      fakeSocket.emit(RealtimeEvent.MatchPreviewCreated, makeMatchPreviewPayload());
    });

    expect(result.current.matchPreviewCount).toBe(3);
  });

  it("caches the latest profile-score.updated payload", () => {
    const { result } = renderHook(() => useCandidateRealtime(CANDIDATE_ID));
    const payload = makeProfileScorePayload();

    act(() => {
      fakeSocket.emit(RealtimeEvent.ProfileScoreUpdated, payload);
    });

    expect(result.current.latestProfileScore).toEqual(payload);
  });

  it("ignores profile-score.updated for other candidates", () => {
    const { result } = renderHook(() => useCandidateRealtime(CANDIDATE_ID));

    act(() => {
      fakeSocket.emit(
        RealtimeEvent.ProfileScoreUpdated,
        makeProfileScorePayload({ candidateId: OTHER_CANDIDATE_ID }),
      );
    });

    expect(result.current.latestProfileScore).toBeNull();
  });

  it("is a no-op when candidateId is null (no listener crashes)", () => {
    const { result } = renderHook(() => useCandidateRealtime(null));

    act(() => {
      fakeSocket.emit(RealtimeEvent.MatchPreviewCreated, makeMatchPreviewPayload());
    });

    expect(result.current.matchPreviewCount).toBe(0);
    expect(result.current.latestMatchPreview).toBeNull();
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => useCandidateRealtime(CANDIDATE_ID));
    expect(fakeSocket.listenerCount(RealtimeEvent.MatchPreviewCreated)).toBe(1);
    expect(fakeSocket.listenerCount(RealtimeEvent.ProfileScoreUpdated)).toBe(1);
    unmount();
    expect(fakeSocket.listenerCount(RealtimeEvent.MatchPreviewCreated)).toBe(0);
    expect(fakeSocket.listenerCount(RealtimeEvent.ProfileScoreUpdated)).toBe(0);
  });
});
