/**
 * Standard error envelope returned by the backend.
 * Matches the format defined in technical-specifications.md § "Standard Response Envelope".
 */
export interface ApiErrorResponse {
  statusCode: number;
  code: string; // e.g., "VALIDATION_FAILED", "UNAUTHORIZED", "NOT_FOUND"
  message: string;
  errors?: Array<{ path: string; message: string }>;
  timestamp: string;
  path: string;
  requestId: string;
}
