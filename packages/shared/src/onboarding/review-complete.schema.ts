import { z } from "zod";

/**
 * Minimum requirement to leave the Review step:
 * at least one experience, OR one education entry, OR three skills.
 * (Otherwise the candidate has nothing to be matched against.)
 */
export const reviewCompleteSchema = z
  .object({
    experienceCount: z.number().int().nonnegative(),
    educationCount: z.number().int().nonnegative(),
    skillsCount: z.number().int().nonnegative(),
  })
  .refine(
    (v) => v.experienceCount >= 1 || v.educationCount >= 1 || v.skillsCount >= 3,
    {
      message: "Add at least one experience, one school, or three skills",
      path: ["root"],
    },
  );

export type ReviewComplete = z.infer<typeof reviewCompleteSchema>;
