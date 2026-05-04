// AuraHire shared schemas, enums, constants, and types.
// Single import point for both apps/web and apps/api.

// Schemas
export * from "./schemas/shared.ts";
export * from "./schemas/auth.ts";
export * from "./schemas/onboarding.ts";
export * from "./schemas/jobs.ts";
export * from "./schemas/parsed-resume.ts";
export * from "./schemas/score.ts";
export * from "./schemas/bias.ts";
export * from "./schemas/bias-requests.ts";
export * from "./schemas/applications.ts";
export * from "./schemas/admin.ts";
export * from "./schemas/interviews.ts";
export * from "./schemas/offers.ts";

// Enums
export * from "./enums/index.ts";

// Constants
export * from "./constants/score-thresholds.ts";
export * from "./constants/ai-limits.ts";
export * from "./constants/pagination.ts";

// Types
export * from "./types/auth-user.ts";
export * from "./types/api-error.ts";

// API client (orval-generated TanStack Query hooks + fetcher)
export * from "./api-client/index.ts";

export const AURAHIRE_SHARED_VERSION = "0.4.0";
