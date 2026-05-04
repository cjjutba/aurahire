import { toast } from "sonner";
import type { ApiErrorResponse } from "@aurahire/shared";

/**
 * Fire a success toast. Title is required; description is optional.
 * Use for any user-initiated successful mutation. Do not use for background
 * jobs, polling that completed without user intent, or actions taken by other
 * users.
 */
export function toastSuccess(title: string, description?: string) {
  toast.success(title, description ? { description } : undefined);
}

/**
 * Fire an error toast. Pass the raw error from a catch block or onError
 * callback. The helper extracts the API error message from the standard
 * `ApiErrorResponse` shape, falling back to the error's own `message`, and
 * finally to the provided `fallbackDescription` when no usable message is
 * available.
 *
 * For client-side validation toasts (no real error), pass `null` and an
 * explicit description: `toastApiError(null, "Check your input", zodMessages)`.
 */
export function toastApiError(
  err: unknown,
  fallbackTitle: string,
  fallbackDescription = "Please try again.",
) {
  const description = extractApiErrorMessage(err) ?? fallbackDescription;
  toast.error(fallbackTitle, { description });
}

function extractApiErrorMessage(err: unknown): string | null {
  if (err && typeof err === "object" && "body" in err) {
    const body = (err as { body?: ApiErrorResponse }).body;
    if (body?.message) return body.message;
  }
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string" && msg.length > 0 && msg !== "Failed to fetch") {
      return msg;
    }
  }
  return null;
}
