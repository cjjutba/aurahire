import { z } from "zod";

const httpOrHttpsUrl = z
  .string()
  .trim()
  .max(2048)
  .regex(/^https?:\/\//i)
  .optional()
  .nullable();

export const interviewVenueInputSchema = z.object({
  label: z.string().trim().min(1).max(100),
  venueName: z.string().trim().min(1).max(200),
  addressLine: z.string().trim().min(1).max(500),
  roomOrFloor: z.string().trim().max(200).nullable().optional(),
  mapUrl: httpOrHttpsUrl,
  reportingInstructions: z.string().max(2000).nullable().optional(),
  whatToBring: z.string().max(2000).nullable().optional(),
  interviewerName: z.string().trim().max(200).nullable().optional(),
  interviewerTitle: z.string().trim().max(200).nullable().optional(),
  isDefault: z.boolean().optional().default(false),
});
export type InterviewVenueInput = z.infer<typeof interviewVenueInputSchema>;

export const interviewVenuePartialSchema = interviewVenueInputSchema.partial();
export type InterviewVenuePartialInput = z.infer<
  typeof interviewVenuePartialSchema
>;
