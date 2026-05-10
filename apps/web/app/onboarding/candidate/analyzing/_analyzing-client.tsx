"use client";

import { useEffect, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";

import {
  ANALYZING_SCREEN_WALLCLOCK_MS,
  setAccessToken,
} from "@aurahire/shared";

import { AiShimmer } from "@/components/ai/ai-shimmer";
import { ScoreRing } from "@/components/score/score-ring";
import { ClientApiError, clientApiFetch } from "@/hooks/_client-fetch";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { useCandidateRealtime } from "@/lib/realtime/use-candidate-realtime";

/**
 * Backend codes that mean "the candidate hasn't completed enough of the
 * wizard yet." Each one maps to a step the candidate can return to in
 * order to fix the problem. We treat these as recoverable user errors
 * rather than transient failures — a "Try again" reload doesn't help
 * because the validation will keep failing.
 */
const ONBOARDING_VALIDATION_CODES: Record<
  string,
  {
    step:
      | "/onboarding/candidate/personal"
      | "/onboarding/candidate/review"
      | "/onboarding/candidate/preferences";
    label: string;
  }
> = {
  INCOMPLETE_PERSONAL: {
    step: "/onboarding/candidate/personal",
    label: "Go back to Personal",
  },
  INCOMPLETE_REVIEW: {
    step: "/onboarding/candidate/review",
    label: "Go back to Review",
  },
  INCOMPLETE_PREFERENCES: {
    step: "/onboarding/candidate/preferences",
    label: "Go back to Preferences",
  },
};

/**
 * Score band the analyzing screen needs to render the Score Ring. Mirrors
 * `ProfileScoreDtoBand` from the generated client; we pin it locally so this
 * file does not need to plumb the full DTO through.
 */
type ScoreBand = "strong" | "partial" | "limited";

/**
 * Just-enough shape of the Profile Score for this screen — the full DTO
 * (improvement suggestions, redacted fields, prompt version, …) is not used
 * here. Capturing only what the UI renders keeps the reducer pure and the
 * tests small.
 */
export interface AnalyzingProfileScore {
  overallScore: number;
  band: ScoreBand;
}

/**
 * State machine driving the screen. Each `kind` maps 1:1 to a UI variant; the
 * reducer is the only place transitions happen so they can be unit tested.
 */
export type AnalyzingState =
  | { kind: "computingProfileScore" }
  | { kind: "profileScoreReady"; score: AnalyzingProfileScore; readyAt: number }
  | {
      kind: "streamingPreviews";
      score: AnalyzingProfileScore;
      readyAt: number;
      previewCount: number;
    }
  | { kind: "profileScoreDegraded" }
  | { kind: "error"; message: string }
  | {
      kind: "validationError";
      message: string;
      backToStep: string;
      backLabel: string;
    }
  | { kind: "redirecting" };

export type AnalyzingAction =
  | { type: "PROFILE_SCORE_OK"; score: AnalyzingProfileScore; now: number }
  | { type: "PROFILE_SCORE_DEGRADED" }
  | { type: "PROFILE_SCORE_ERROR"; message: string }
  | {
      type: "PROFILE_SCORE_VALIDATION";
      message: string;
      backToStep: string;
      backLabel: string;
    }
  | { type: "PREVIEW_TICK" }
  | { type: "REDIRECT" };

/**
 * Reducer. Pure — receives `now` from the dispatcher rather than calling
 * `Date.now()` inside, so the wall-clock cap is testable without faking time.
 */
export function analyzingReducer(
  state: AnalyzingState,
  action: AnalyzingAction,
): AnalyzingState {
  switch (action.type) {
    case "PROFILE_SCORE_OK":
      // Only honour the success transition from the initial "computing" state;
      // late-arriving responses after a degraded/error fork would otherwise
      // resurrect the happy path on top of an already-rendered failure UI.
      if (state.kind !== "computingProfileScore") return state;
      return {
        kind: "profileScoreReady",
        score: action.score,
        readyAt: action.now,
      };
    case "PROFILE_SCORE_DEGRADED":
      if (state.kind !== "computingProfileScore") return state;
      return { kind: "profileScoreDegraded" };
    case "PROFILE_SCORE_ERROR":
      if (state.kind !== "computingProfileScore") return state;
      return { kind: "error", message: action.message };
    case "PROFILE_SCORE_VALIDATION":
      if (state.kind !== "computingProfileScore") return state;
      return {
        kind: "validationError",
        message: action.message,
        backToStep: action.backToStep,
        backLabel: action.backLabel,
      };
    case "PREVIEW_TICK":
      if (state.kind === "profileScoreReady") {
        return {
          kind: "streamingPreviews",
          score: state.score,
          readyAt: state.readyAt,
          previewCount: 1,
        };
      }
      if (state.kind === "streamingPreviews") {
        return { ...state, previewCount: state.previewCount + 1 };
      }
      // Match-preview events that arrive before the score is ready are
      // silently dropped — the wall-clock cap will still fire when the
      // score arrives.
      return state;
    case "REDIRECT":
      return { kind: "redirecting" };
    default:
      return state;
  }
}

/**
 * Pure derivation: should the manual "Skip to dashboard" link be visible
 * for this reducer state?
 *
 *  - Hidden during `computingProfileScore` because the `complete-onboarding`
 *    PATCH may not have committed `profileCompleted=true` yet; bailing now
 *    risks a layout-guard bounce on the dashboard side.
 *  - Hidden during `error` and `validationError` because those have their
 *    own remediation surfaces (Try again / Go back to step).
 *  - Hidden during `redirecting` so a fast double-click can't fire two
 *    navigations or two telemetry calls.
 */
export function canSkip(state: AnalyzingState): boolean {
  return (
    state.kind === "profileScoreReady" ||
    state.kind === "streamingPreviews" ||
    state.kind === "profileScoreDegraded"
  );
}

/**
 * Wire shape of `PATCH /candidate-profiles/me/complete-onboarding`. The
 * backend returns the full Profile Score DTO; we keep our local view narrow
 * to avoid coupling the screen to fields it does not display.
 */
interface CompleteOnboardingResponseData {
  profileCompleted: boolean;
  profileScore: { overallScore: number; band: ScoreBand } | null;
  precomputeJobId: string;
  errors?: { profileScore?: "transient" | "missing_resume" };
}

interface AnalyzingClientProps {
  candidateId: string;
}

/**
 * Client owner of the analyzing screen. Responsibilities:
 *
 *  1. Fire the inline-score API call exactly once on mount.
 *  2. Subscribe to `match-preview.created` events for this candidate via
 *     `useCandidateRealtime`, ticking the reducer for each new event.
 *  3. Cap the streaming state at the lower of (5 previews | wall-clock) so
 *     onboarding never blocks indefinitely.
 *  4. Honour the degraded path (score is null) and the network-error path
 *     with distinct UI affordances.
 */
export function AnalyzingClient({ candidateId }: AnalyzingClientProps) {
  const [state, dispatch] = useReducer(analyzingReducer, {
    kind: "computingProfileScore",
  });
  const router = useRouter();
  const { matchPreviewCount } = useCandidateRealtime(candidateId);

  // React 18+ Strict Mode double-invokes effects; the API call must only fire
  // once. A ref outside React state survives the second mount cleanly.
  const fired = useRef(false);
  // Tracks how many match-preview events we've already counted into the
  // reducer so a re-render doesn't double-tick.
  const lastSeenCount = useRef(0);

  // 1. Kick off the API call once on mount.
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    void (async () => {
      try {
        // The root <AuthTokenProvider> hydrates the module-level access
        // token asynchronously via supabase.auth.getSession() inside its
        // own useEffect. This component's effect can fire BEFORE that
        // hydration finishes — at which point clientApiFetch sees a null
        // token and ships the request with no Authorization header,
        // producing a 401. Read the session here directly so the call
        // is always authenticated regardless of provider ordering, and
        // backfill the global token cache so subsequent calls in this
        // session are also covered.
        const supabase = createSupabaseBrowserClient();
        const sessionResult = await supabase.auth.getSession();
        const token = sessionResult.data.session?.access_token ?? null;
        if (token) setAccessToken(token);

        const envelope = await clientApiFetch<{
          data: CompleteOnboardingResponseData;
        }>("/api/v1/candidate-profiles/me/complete-onboarding", {
          method: "PATCH",
        });
        const data = envelope.data;
        if (data.profileScore) {
          dispatch({
            type: "PROFILE_SCORE_OK",
            score: {
              overallScore: data.profileScore.overallScore,
              band: data.profileScore.band,
            },
            now: Date.now(),
          });
        } else {
          dispatch({ type: "PROFILE_SCORE_DEGRADED" });
        }
      } catch (err) {
        // Recognise the wizard-validation 400s and route the candidate
        // back to the failing step with an actionable message rather
        // than the generic "API 400 — Try again" loop.
        if (err instanceof ClientApiError && err.status === 400) {
          const body = err.body as { code?: string; message?: string } | null;
          const code = body?.code;
          if (code && ONBOARDING_VALIDATION_CODES[code]) {
            const target = ONBOARDING_VALIDATION_CODES[code];
            dispatch({
              type: "PROFILE_SCORE_VALIDATION",
              message: body?.message ?? "Please complete the previous step.",
              backToStep: target.step,
              backLabel: target.label,
            });
            return;
          }
        }
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        dispatch({ type: "PROFILE_SCORE_ERROR", message });
      }
    })();
  }, []);

  // 2. Tick the reducer whenever a new match-preview event arrives.
  useEffect(() => {
    if (matchPreviewCount > lastSeenCount.current) {
      lastSeenCount.current = matchPreviewCount;
      dispatch({ type: "PREVIEW_TICK" });
    }
  }, [matchPreviewCount]);

  // 3. Wall-clock cap on the streaming/ready states. We schedule a single
  //    timer; the cleanup tears it down if the state changes (e.g. another
  //    preview arrives) so we don't pile up redirect timers.
  useEffect(() => {
    if (
      state.kind !== "profileScoreReady" &&
      state.kind !== "streamingPreviews"
    ) {
      return;
    }
    if (state.kind === "streamingPreviews" && state.previewCount >= 5) {
      dispatch({ type: "REDIRECT" });
      return;
    }
    const remaining =
      ANALYZING_SCREEN_WALLCLOCK_MS - (Date.now() - state.readyAt);
    if (remaining <= 0) {
      dispatch({ type: "REDIRECT" });
      return;
    }
    const t = setTimeout(() => dispatch({ type: "REDIRECT" }), remaining);
    return () => clearTimeout(t);
  }, [state]);

  // 4. Degraded path — short pause so the candidate registers the message,
  //    then redirect with a query param the dashboard can pick up to nudge
  //    a retry.
  useEffect(() => {
    if (state.kind !== "profileScoreDegraded") return;
    const t = setTimeout(
      () => router.push("/candidate?profileScoreRetry=1"),
      2000,
    );
    return () => clearTimeout(t);
  }, [state, router]);

  // 5. Final redirect. Kept as a dedicated effect so the "redirecting" frame
  //    is briefly visible — the transition feels intentional rather than
  //    abrupt.
  useEffect(() => {
    if (state.kind === "redirecting") router.replace("/candidate");
  }, [state, router]);

  const onSkipClick = (): void => {
    // Fire-and-forget telemetry. We deliberately do not await — a failing
    // POST must never block the navigation. The endpoint returns 204 on
    // success and is rate-unlimited; backend swallowing the row would
    // simply mean one missing audit log.
    const previewsReady =
      state.kind === "streamingPreviews" ? state.previewCount : 0;
    const scoreReady =
      state.kind === "profileScoreReady" || state.kind === "streamingPreviews"; // both states imply score landed
    void clientApiFetch(
      "/api/v1/candidate-profiles/me/onboarding/skipped-analyzing",
      {
        method: "POST",
        body: { scoreReady, previewsReady },
      },
    ).catch(() => {
      // Intentional swallow — telemetry must not block UX.
    });
    dispatch({ type: "REDIRECT" });
    router.replace("/candidate");
  };

  return (
    <section className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-[var(--radius-xl)] border border-[var(--color-hairline-soft)] bg-[var(--color-canvas)] p-8 text-center">
        {state.kind === "computingProfileScore" && (
          <div aria-live="polite" className="space-y-4">
            <AiShimmer caption="Computing your Profile Score…" height={120} />
          </div>
        )}

        {state.kind === "profileScoreReady" && (
          <div aria-live="polite" className="flex flex-col items-center gap-4">
            <ScoreRing
              score={state.score.overallScore}
              band={state.score.band}
              size="md"
            />
            <p className="text-sm text-[var(--color-body)]">
              <span aria-hidden="true">✓ </span>
              Profile Score ready. Finding your top matches…
            </p>
          </div>
        )}

        {state.kind === "streamingPreviews" && (
          <div aria-live="polite" className="flex flex-col items-center gap-4">
            <ScoreRing
              score={state.score.overallScore}
              band={state.score.band}
              size="md"
            />
            <p className="text-sm text-[var(--color-body)]">
              <span style={{ fontFamily: "var(--font-mono)" }}>
                {state.previewCount}
              </span>{" "}
              of <span style={{ fontFamily: "var(--font-mono)" }}>5</span>{" "}
              matches ready
            </p>
          </div>
        )}

        {state.kind === "profileScoreDegraded" && (
          <p aria-live="polite" className="text-sm text-[var(--color-body)]">
            We&rsquo;re still working on your score — taking you to your
            dashboard now.
          </p>
        )}

        {state.kind === "redirecting" && (
          <p aria-live="polite" className="text-sm text-[var(--color-muted)]">
            Taking you to your dashboard…
          </p>
        )}

        {state.kind === "error" && (
          <div role="alert" className="space-y-4">
            <p className="text-sm text-[var(--color-status-danger)]">
              {state.message}
            </p>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") window.location.reload();
              }}
              className="inline-flex items-center justify-center rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
            >
              Try again
            </button>
          </div>
        )}

        {state.kind === "validationError" && (
          <div role="alert" className="space-y-4">
            <p className="text-sm text-[var(--color-status-danger)]">
              {state.message}
            </p>
            <button
              type="button"
              onClick={() => router.push(state.backToStep)}
              className="inline-flex items-center justify-center rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
            >
              {state.backLabel}
            </button>
          </div>
        )}
      </div>

      {canSkip(state) && (
        <button
          type="button"
          onClick={onSkipClick}
          className="mt-6 inline-flex items-center gap-1 text-sm text-[var(--color-body)] transition hover:text-[var(--color-ink)]"
        >
          Skip to dashboard
          <span aria-hidden="true">→</span>
        </button>
      )}
    </section>
  );
}
