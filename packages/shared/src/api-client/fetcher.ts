/**
 * Custom fetcher for orval-generated API client.
 *
 * Orval calls `fetcher(url, requestInit)` for each generated operation.
 * The caller (a TanStack Query hook on the frontend) is responsible for
 * threading the Supabase JWT into requestInit.headers["Authorization"]
 * before invocation. We do not auto-resolve the token here because the
 * api-client lives in `@aurahire/shared` and must not depend on the auth client.
 */

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
  const fullUrl = url.startsWith("http") ? url : `${apiUrl}${url}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };

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
    });
  }

  return (await res.json()) as T;
};
