import { z } from "zod";

export const checkBiasInputSchema = z.object({
  text: z.string().min(1).max(20_000),
  customFlaggedTermsOverride: z.array(z.string()).max(50).optional(),
});

export type CheckBiasInput = z.infer<typeof checkBiasInputSchema>;

export const overrideBiasFlagInputSchema = z.object({
  reason: z
    .string()
    .min(10, "Override reason must be at least 10 characters")
    .max(500, "Override reason cannot exceed 500 characters"),
});

export type OverrideBiasFlagInput = z.infer<typeof overrideBiasFlagInputSchema>;
