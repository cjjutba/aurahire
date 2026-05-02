// AuraHire shared schemas, enums, constants, and types.
// Single import point for both apps/web and apps/api.

// Schemas
export * from "./schemas/shared.ts";
export * from "./schemas/auth.ts";
export * from "./schemas/onboarding.ts";

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
