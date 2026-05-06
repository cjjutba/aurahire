"use client";

import { useEffect, useMemo, useRef } from "react";
import { setAccessToken, setActiveCompanyResolver } from "@aurahire/shared";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { getActiveCompanyId } from "@/lib/active-company";

export function AuthTokenProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

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
  }, [supabase]);

  return <>{children}</>;
}
