import { z } from "zod";

/** Minimum requirement to leave the Personal step. */
export const personalCompleteSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
});

export type PersonalComplete = z.infer<typeof personalCompleteSchema>;
