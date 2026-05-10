import { z } from "zod";

/**
 * Minimum requirement to leave the Preferences step:
 * at least one desired role. Open-to / salary / start date are optional —
 * a candidate without a target role has nothing to be matched against.
 */
export const preferencesCompleteSchema = z.object({
  desiredRoles: z
    .array(z.string().min(1))
    .min(1, "Add at least one desired role"),
});

export type PreferencesComplete = z.infer<typeof preferencesCompleteSchema>;
