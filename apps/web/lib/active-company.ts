"use client";

/**
 * Module-level singleton for the user's currently active company id.
 *
 * Why a singleton instead of just localStorage: the value is read on every
 * client-side fetch (to inject the X-Active-Company-Id header). Going through
 * `localStorage` for every fetch incurs a synchronous IPC hop per call;
 * caching the value in module state keeps the hot path in memory.
 *
 * Persisted to localStorage so a hard refresh boots with the same active
 * company. Server-rendered pages independently use
 * `profiles.last_active_company_id` (the backend's fallback path), so the two
 * sources stay in sync via PATCH /profiles/me on every switch.
 */
const STORAGE_KEY = "aurahire:active-company-id";
let cached: string | null = null;
let initialized = false;

export function getActiveCompanyId(): string | null {
  if (initialized) return cached;
  if (typeof window === "undefined") return null;
  cached = window.localStorage.getItem(STORAGE_KEY);
  initialized = true;
  return cached;
}

export function setActiveCompanyId(id: string | null): void {
  cached = id;
  initialized = true;
  if (typeof window === "undefined") return;
  if (id === null) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, id);
  }
}
