"use client";

import { useEffect, useRef } from "react";

/**
 * Triggers the browser's "you have unsaved changes" prompt when the user
 * tries to close the tab while the consumer reports `isDirty=true` for > 750ms.
 * The 750ms grace prevents the prompt from firing during normal typing.
 */
export function useTabCloseProtection(isDirty: boolean) {
  const dirtyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const protectActive = useRef(false);

  useEffect(() => {
    if (isDirty) {
      if (!dirtyTimer.current) {
        dirtyTimer.current = setTimeout(() => {
          protectActive.current = true;
        }, 750);
      }
    } else {
      if (dirtyTimer.current) clearTimeout(dirtyTimer.current);
      dirtyTimer.current = null;
      protectActive.current = false;
    }
  }, [isDirty]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!protectActive.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
}
