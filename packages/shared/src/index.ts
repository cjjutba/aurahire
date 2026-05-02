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

export const AURAHIRE_SHARED_VERSION = "0.3.0";
