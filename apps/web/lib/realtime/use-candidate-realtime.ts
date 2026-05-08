"use client";

import { useCallback, useRef, useState } from "react";

import {
  RealtimeEvent,
  type MatchPreviewCreatedPayload,
  type ProfileScoreUpdatedPayload,
} from "@aurahire/shared";

import { useRealtimeChannel } from "@/hooks/use-realtime-channel";

export interface CandidateRealtimeState {
  /** Number of `match-preview.created` events received for this candidate
   * since the hook mounted. Used by the analyzing page to drive the
   * "found N matches" copy and by the dashboard to flag fresh matches. */
  matchPreviewCount: number;
  /** Most recent `match-preview.created` payload for this candidate. */
  latestMatchPreview: MatchPreviewCreatedPayload | null;
  /** Most recent `profile-score.updated` payload for this candidate. */
  latestProfileScore: ProfileScoreUpdatedPayload | null;
}

/**
 * Subscribes the calling component to the candidate's realtime user-room
 * for the two scoring events emitted by Phase 2:
 *
 *   - `match-preview.created` → increment `matchPreviewCount` + cache payload
 *   - `profile-score.updated` → cache payload
 *
 * Pass `null`/`undefined` when the candidate id is not yet known (parent
 * still hydrating); the hook becomes a no-op until a real id appears.
 *
 * Realtime delivery already routes events to the user's private room
 * (`user:{candidateId}`), but we still defend in depth here: if the server
 * ever broadcasts to the wrong room or an old payload arrives after a
 * route change, the `candidateId` check filters it out.
 *
 * Implementation note: `useRealtimeChannel` deliberately omits `handler`
 * from its effect deps to avoid re-subscribing on every render. To still
 * read the freshest `candidateId` inside the handler, we mirror the prop
 * through a ref. The handlers themselves are stabilised with `useCallback`
 * (no deps) so the channel binding is established exactly once per event.
 */
export function useCandidateRealtime(
  candidateId: string | null | undefined,
): CandidateRealtimeState {
  const [state, setState] = useState<CandidateRealtimeState>({
    matchPreviewCount: 0,
    latestMatchPreview: null,
    latestProfileScore: null,
  });

  const candidateIdRef = useRef<string | null | undefined>(candidateId);
  candidateIdRef.current = candidateId;

  const onMatchPreview = useCallback((payload: MatchPreviewCreatedPayload) => {
    const current = candidateIdRef.current;
    if (!current || payload.candidateId !== current) return;
    setState((prev) => ({
      ...prev,
      matchPreviewCount: prev.matchPreviewCount + 1,
      latestMatchPreview: payload,
    }));
  }, []);

  const onProfileScore = useCallback((payload: ProfileScoreUpdatedPayload) => {
    const current = candidateIdRef.current;
    if (!current || payload.candidateId !== current) return;
    setState((prev) => ({ ...prev, latestProfileScore: payload }));
  }, []);

  useRealtimeChannel(RealtimeEvent.MatchPreviewCreated, onMatchPreview);
  useRealtimeChannel(RealtimeEvent.ProfileScoreUpdated, onProfileScore);

  return state;
}
