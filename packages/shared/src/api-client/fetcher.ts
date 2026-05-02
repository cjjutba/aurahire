/**
 * Custom fetcher for orval-generated API client.
 * Module-level access token is injected as Authorization: Bearer <jwt>.
 * apps/web's <AuthTokenProvider> calls setAccessToken() on session changes.
 */

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
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
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
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
