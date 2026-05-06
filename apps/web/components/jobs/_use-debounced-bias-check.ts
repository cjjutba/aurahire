"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { getActiveCompanyId } from "@/lib/active-company";

const MIN_LENGTH = 100;
const DEBOUNCE_MS = 1500;

export interface BiasFlagPreview {
  term: string;
  category: string;
  severity: "high" | "medium" | "low";
  explanation: string;
  suggestion: string;
  positionStart: number | null;
  positionEnd: number | null;
}

export function useDebouncedBiasCheck(descriptionPlain: string): {
  flags: BiasFlagPreview[];
  scanning: boolean;
} {
  const [flags, setFlags] = useState<BiasFlagPreview[]>([]);
  const [scanning, setScanning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!descriptionPlain || descriptionPlain.length < MIN_LENGTH) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset when input drops below threshold
      setFlags([]);
      setScanning(false);
      return;
    }

    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setScanning(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
        const activeCompanyId = getActiveCompanyId();
        const res = await fetch(`${apiUrl}/api/v1/bias/check`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            ...(activeCompanyId
              ? { "X-Active-Company-Id": activeCompanyId }
              : {}),
          },
          body: JSON.stringify({ text: descriptionPlain }),
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (res.status === 429) return;
        if (!res.ok) return;

        const body = (await res.json()) as { data: { flags: BiasFlagPreview[] } };
        setFlags(body.data.flags);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) setScanning(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(handle);
      abortRef.current?.abort();
    };
  }, [descriptionPlain]);

  return { flags, scanning };
}
