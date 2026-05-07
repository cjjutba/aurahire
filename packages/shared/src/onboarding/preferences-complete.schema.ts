import { z } from "zod";

/** Minimum requirement to leave the Preferences step. */
export const preferencesCompleteSchema = z.object({
  desiredRoles: z.array(z.string()).min(1, "Pick at least one role"),
  openTo: z.array(z.string()).min(1, "Select at least one work mode"),
});

export type PreferencesComplete = z.infer<typeof preferencesCompleteSchema>;
