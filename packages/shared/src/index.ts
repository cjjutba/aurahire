// AuraHire shared schemas, enums, constants, and types.
// Single import point for both apps/web and apps/api.

// Schemas
export * from "./schemas/shared";
export * from "./schemas/auth";
export * from "./schemas/onboarding";
export * from "./schemas/jobs";
export * from "./schemas/parsed-resume";
export * from "./schemas/score";
export * from "./schemas/bias";
export * from "./schemas/bias-requests";
export * from "./schemas/applications";
export * from "./schemas/admin";
export * from "./schemas/interviews";
export * from "./schemas/interview-venues";
export * from "./schemas/offers";
export * from "./schemas/companies";
export * from "./schemas/notifications";
export * from "./onboarding/index";

// Enums
export * from "./enums/index";

// Constants
export * from "./constants/score-thresholds";
export * from "./constants/ai-limits";
export * from "./constants/pagination";
export * from "./skills-taxonomy";

// Types
export * from "./types/auth-user";
export * from "./types/api-error";

// Realtime
export * from "./realtime";

// API client (orval-generated TanStack Query hooks + fetcher)
export * from "./api-client/index";

export const AURAHIRE_SHARED_VERSION = "0.4.0";
