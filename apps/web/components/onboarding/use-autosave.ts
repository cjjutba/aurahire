"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveStatus } from "./save-status-indicator";

interface Options<TPayload> {
  save: (payload: TPayload) => Promise<void>;
  debounceMs?: number;
}

export function useAutosave<TPayload>({ save, debounceMs = 500 }: Options<TPayload>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<TPayload | null>(null);
  const inFlight = useRef(false);
  const saveRef = useRef(save);

  // Keep latest save fn without causing the flush callback to churn.
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!pending.current) return;
    if (inFlight.current) return;

    const payload = pending.current;
    pending.current = null;
    inFlight.current = true;
    setStatus("saving");

    try {
      await saveRef.current(payload);
      setStatus("idle");
    } catch {
      // Silent retry once.
      try {
        await saveRef.current(payload);
        setStatus("idle");
      } catch {
        setStatus("error");
      }
    } finally {
      inFlight.current = false;
      // If more changes arrived while in-flight, flush again.
      if (pending.current) flush();
    }
  }, []);

  const schedule = useCallback(
    (payload: TPayload) => {
      pending.current = payload;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, debounceMs);
    },
    [flush, debounceMs],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { status, schedule, flushNow: flush, retry: flush };
}
