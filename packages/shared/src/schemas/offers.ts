import { z } from "zod";

export const createOfferSchema = z.object({
  title: z.string().min(1).max(200),
  salary: z.number().positive().max(10_000_000),
  salaryCurrency: z.string().length(3).default("USD"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  managerName: z.string().max(200).nullable().optional(),
  benefitsSummary: z.string().max(2000).nullable().optional(),
  customMessage: z.string().max(2000).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});
export type CreateOfferInput = z.infer<typeof createOfferSchema>;

export const declineOfferSchema = z.object({
  reason: z.string().max(1000).nullable().optional(),
});
export type DeclineOfferInput = z.infer<typeof declineOfferSchema>;
