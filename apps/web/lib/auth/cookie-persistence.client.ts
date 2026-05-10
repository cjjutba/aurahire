"use client";

import type { CookieOptions } from "@supabase/ssr";

import { SESSION_ONLY_MARKER } from "./cookie-persistence";

function parseCookieHeader(header: string): { name: string; value: string }[] {
  if (!header) return [];
  return header.split("; ").map((pair) => {
    const eq = pair.indexOf("=");
    if (eq === -1) return { name: pair, value: "" };
    return {
      name: pair.slice(0, eq),
      value: decodeURIComponent(pair.slice(eq + 1)),
    };
  });
}

function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions,
): string {
  const parts: string[] = [`${name}=${encodeURIComponent(value)}`];
  if (options.path) parts.push(`Path=${options.path}`);
  else parts.push("Path=/");
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.sameSite) {
    const ss =
      typeof options.sameSite === "string"
        ? options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1)
        : options.sameSite === true
          ? "Strict"
          : "Lax";
    parts.push(`SameSite=${ss}`);
  } else {
    parts.push("SameSite=Lax");
  }
  if (options.secure) parts.push("Secure");
  if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  return parts.join("; ");
}

export function getSessionOnlyMarkerFromDocument(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split("; ")
    .some(
      (c) =>
        c === `${SESSION_ONLY_MARKER}=1` ||
        c.startsWith(`${SESSION_ONLY_MARKER}=1;`),
    );
}

export function setSessionOnlyMarker(enabled: boolean): void {
  if (typeof document === "undefined") return;
  if (enabled) {
    document.cookie = `${SESSION_ONLY_MARKER}=1; Path=/; SameSite=Lax`;
  } else {
    document.cookie = `${SESSION_ONLY_MARKER}=; Path=/; SameSite=Lax; Max-Age=0`;
  }
}

export function readDocumentCookies(): { name: string; value: string }[] {
  if (typeof document === "undefined") return [];
  return parseCookieHeader(document.cookie);
}

export function writeDocumentCookie(
  name: string,
  value: string,
  options: CookieOptions,
): void {
  if (typeof document === "undefined") return;
  document.cookie = serializeCookie(name, value, options);
}
