"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { setTokenGetter, setActiveCompanyResolver } from "@aurahire/shared";
import { getActiveCompanyId } from "@/lib/active-company";

/**
 * Wires the shared API client to Clerk: installs an async token getter that
 * returns a FRESH Clerk session token per request (Clerk tokens expire in ~60s,
 * so a cached string would go stale), plus the active-company resolver.
 * Must render inside <ClerkProvider> (uses useAuth).
 */
export function AuthTokenProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();

  useEffect(() => {
    setActiveCompanyResolver(() => getActiveCompanyId());
    setTokenGetter(async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    });
    return () => {
      setTokenGetter(null);
    };
  }, [getToken]);

  return <>{children}</>;
}
