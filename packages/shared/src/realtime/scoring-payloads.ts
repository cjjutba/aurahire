import { z } from "zod";

export const matchPreviewCreatedPayloadSchema = z.object({
  candidateId: z.string().uuid(),
  jobId: z.string().uuid(),
  resumeId: z.string().uuid(),
  source: z.enum(["system", "candidate", "candidate_view"]),
  overallScore: z.number().min(0).max(100),
  band: z.enum(["strong", "partial", "limited"]),
  createdAt: z.string().datetime(),
});
export type MatchPreviewCreatedPayload = z.infer<typeof matchPreviewCreatedPayloadSchema>;

export const profileScoreUpdatedPayloadSchema = z.object({
  candidateId: z.string().uuid(),
  resumeId: z.string().uuid(),
  overallScore: z.number().min(0).max(100),
  band: z.enum(["strong", "partial", "limited"]),
  reason: z.enum([
    "onboarding",
    "resume_change",
    "preferences_change",
    "profile_change",
    "manual_recompute",
  ]),
  updatedAt: z.string().datetime(),
});
export type ProfileScoreUpdatedPayload = z.infer<typeof profileScoreUpdatedPayloadSchema>;
