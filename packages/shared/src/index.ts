// AuraHire shared schemas, enums, constants, and types.
// Single import point for both apps/web and apps/api.

// Schemas
export * from "./schemas/shared";
export * from "./schemas/auth";
export * from "./schemas/onboarding";

// Enums
export * from "./enums";

// Constants
export * from "./constants/score-thresholds";
export * from "./constants/ai-limits";
export * from "./constants/pagination";

// Types
export * from "./types/auth-user";
export * from "./types/api-error";

// API client (orval-generated TanStack Query hooks + fetcher)
export * from "./api-client";

export const AURAHIRE_SHARED_VERSION = "0.4.0";
