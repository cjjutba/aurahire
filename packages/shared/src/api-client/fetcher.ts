/**
 * Custom fetcher for orval-generated API client.
 * Module-level access token is injected as Authorization: Bearer <jwt>.
 * apps/web's <AuthTokenProvider> calls setAccessToken() on session changes.
 *
 * Phase 3 (multi-tenancy): an optional active-company id resolver lets
 * apps/web wire the localStorage-backed singleton in `lib/active-company`
 * without creating a circular dep. The shared package stays UI-agnostic;
 * apps/web installs the resolver at startup.
 */

let accessToken: string | null = null;
let tokenGetter: (() => Promise<string | null>) | null = null;
let activeCompanyResolver: (() => string | null) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Install an async token getter. When set, the fetcher awaits it per request to
 * obtain a FRESH bearer token — required for Clerk, whose session tokens expire
 * in ~60s (a cached string would go stale). apps/web wires this to Clerk's
 * `window.Clerk.session.getToken()` at startup.
 */
export function setTokenGetter(
  getter: (() => Promise<string | null>) | null,
): void {
  tokenGetter = getter;
}

/** Resolve the current bearer token: prefer the async getter, else the stored string. */
export async function resolveAccessToken(): Promise<string | null> {
  return tokenGetter ? await tokenGetter() : accessToken;
}

/**
 * Install a resolver that returns the caller's currently active company id
 * (or null if none). When set, the fetcher injects `X-Active-Company-Id` on
 * every request.
 */
export function setActiveCompanyResolver(
  resolver: (() => string | null) | null,
): void {
  activeCompanyResolver = resolver;
}

const RESOLVED_API_URL = (): string => {
  const g = globalThis as { __AURAHIRE_API_URL__?: string };
  if (g.__AURAHIRE_API_URL__) return g.__AURAHIRE_API_URL__;
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return "http://localhost:3333";
};

export type FetcherOptions = RequestInit;

export const fetcher = async <T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> => {
  const apiUrl = RESOLVED_API_URL();
  const fullUrl = url.startsWith("http")
    ? url
    : `${apiUrl}${url.startsWith("/") ? url : `/${url}`}`;

  const headers = new Headers(options.headers);
  if (
    !headers.has("Content-Type") &&
    options.body &&
    typeof options.body === "string"
  ) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("Authorization")) {
    const token = await resolveAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  if (!headers.has("X-Active-Company-Id") && activeCompanyResolver) {
    const companyId = activeCompanyResolver();
    if (companyId) {
      headers.set("X-Active-Company-Id", companyId);
    }
  }

  const res = await fetch(fullUrl, {
    ...options,
    headers,
    credentials: options.credentials ?? "include",
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw Object.assign(new Error(`API ${res.status}`), {
      response: res,
      body: errBody,
      status: res.status,
    });
  }

  if (res.status === 204) return undefined as T;

  return (await res.json()) as T;
};

export type Fetcher = typeof fetcher;
