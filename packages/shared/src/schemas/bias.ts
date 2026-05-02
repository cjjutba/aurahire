import { z } from "zod";

export const biasFlagSchema = z.object({
  term: z.string(), // exact text flagged
  category: z.enum([
    "gendered",
    "age-coded",
    "ableist",
    "exclusionary",
    "other",
  ]),
  severity: z.enum(["high", "medium", "low"]),
  explanation: z.string(), // 1-sentence why
  suggestion: z.string(), // recommended replacement
  position_start: z.number().int().nullable(),
  position_end: z.number().int().nullable(),
});

export const biasFlagListSchema = z.object({
  flags: z.array(biasFlagSchema),
});

export type BiasFlag = z.infer<typeof biasFlagSchema>;
export type BiasFlagList = z.infer<typeof biasFlagListSchema>;
