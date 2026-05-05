import { createHash } from "node:crypto";

/**
 * Stable JSON stringify — sorts object keys recursively so two structurally-
 * equal objects with different insertion order produce identical strings.
 *
 * Preserves array order (arrays are positional). Treats `undefined` properties
 * as absent (matches JSON.stringify semantics).
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** Returns the lowercase hex sha256 of a stable JSON serialization of `input`. */
export function sha256OfStable(input: unknown): string {
  return createHash("sha256").update(stableStringify(input)).digest("hex");
}
