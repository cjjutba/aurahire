import "server-only";

import { auth } from "@clerk/nextjs/server";

/**
 * Error thrown by serverApiFetch on non-2xx responses. Carries the HTTP status
 * so callers (or React Query's retry config) can branch on 401/403/404.
 */
export class ServerApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ServerApiError";
  }
}

interface ServerApiFetchInit {
  /** Optional query params merged into the URL. Skips undefined/null. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Override the HTTP method. Defaults to GET. */
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Optional JSON body; serialized + sent with `content-type: application/json`. */
  body?: unknown;
  /**
   * Optional Next.js fetch cache config. We pass `{ cache: "no-store" }` by
   * default, the backend cache is the source of truth, and Next's data cache
   * would shadow our Redis cache and lengthen the bust path.
   */
  cache?: RequestCache;
  /** Forwarded as `next.tags`. Defaults unset. */
  nextTags?: string[];
}

/**
 * Server-side typed fetch to the NestJS backend.
 *
 * Use ONLY in Server Components / Server Actions / Route Handlers. Reads the
 * Supabase session from cookies and attaches `Authorization: Bearer <jwt>`.
 * Returns parsed JSON typed as T. Throws `ServerApiError` on non-2xx.
 */
export async function serverApiFetch<T>(
  path: string,
  init: ServerApiFetchInit = {},
): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) throw new ServerApiError(401, null, "No active session");

  const url = new URL(path.startsWith("http") ? path : `${apiUrl}${path}`);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined
        ? { "content-type": "application/json" }
        : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: init.cache ?? "no-store",
    next: init.nextTags ? { tags: init.nextTags } : undefined,
  });

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // body may not be JSON; ignore.
    }
    throw new ServerApiError(
      res.status,
      body,
      `API ${res.status} for ${url.pathname}`,
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
