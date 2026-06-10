"use client";

import { useEffect, useRef } from "react";
import { setAccessToken, setActiveCompanyResolver } from "@aurahire/shared";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { getActiveCompanyId } from "@/lib/active-company";

export function AuthTokenProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);

  // The Supabase browser client is constructed inside the effect (browser
  // only) rather than via `useMemo` at render time. Next.js 16's static
  // pre-render still runs this component on the server, and the Supabase
  // factory throws synchronously when NEXT_PUBLIC_SUPABASE_URL/KEY are
  // missing - which is the case during the Vercel build where build-time
  // env strips NEXT_PUBLIC_* for static optimization. Deferring to the
  // effect keeps the construction client-side, where env vars are real.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const supabase = createSupabaseBrowserClient();

    // Phase 3: install the resolver once, before any orval-client call. The
    // resolver reads the localStorage-backed singleton in lib/active-company.
    setActiveCompanyResolver(() => getActiveCompanyId());

    void supabase.auth.getSession().then(({ data: { session } }) => {
      setAccessToken(session?.access_token ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return <>{children}</>;
}
