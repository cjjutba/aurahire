export function sanitizeMapUrl(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 2048) {
    throw new Error("Invalid map URL: too long (max 2048 chars)");
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("Invalid map URL: must start with http:// or https://");
  }
  return trimmed;
}
