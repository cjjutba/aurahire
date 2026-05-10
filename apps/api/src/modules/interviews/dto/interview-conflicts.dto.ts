import { createZodDto } from "nestjs-zod";
import { z } from "zod";

// Server-side variant: candidateId is resolved from the application path param,
// so only the time window + optional excludeInterviewId are accepted from the body.
const dtoSchema = z.object({
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(240),
  excludeInterviewId: z.string().uuid().optional(),
});

export class InterviewConflictsDto extends createZodDto(dtoSchema) {}
