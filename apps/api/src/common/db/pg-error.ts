// Postgres SQLSTATE codes we care about. Postgres-js attaches `.code` directly
// on thrown errors; Drizzle re-throws the underlying error unchanged.
export const PG_UNIQUE_VIOLATION = "23505";

export function isPgError(
  err: unknown,
): err is { code: string; constraint_name?: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    typeof (err as { code?: unknown }).code === "string"
  );
}

export function isUniqueViolation(err: unknown): boolean {
  return isPgError(err) && err.code === PG_UNIQUE_VIOLATION;
}
