import { getAccessToken } from "@aurahire/shared";
import { getActiveCompanyId } from "@/lib/active-company";

export class ClientApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ClientApiError";
  }
}

export async function clientApiFetch<T>(
  path: string,
  init: {
    query?: Record<string, string | number | boolean | undefined | null>;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const token = getAccessToken();
  const activeCompanyId = getActiveCompanyId();
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
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(activeCompanyId
        ? { "X-Active-Company-Id": activeCompanyId }
        : {}),
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "include",
    signal: init.signal,
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {}
    const err = new ClientApiError(res.status, body, `API ${res.status} for ${url.pathname}`);
    (err as { response?: unknown }).response = { status: res.status, body };
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
