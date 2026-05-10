import { createZodDto } from "nestjs-zod";
import {
  interviewVenueInputSchema,
  interviewVenuePartialSchema,
} from "@aurahire/shared";

export class InterviewVenueInputDto extends createZodDto(
  interviewVenueInputSchema,
) {}
export class InterviewVenuePartialDto extends createZodDto(
  interviewVenuePartialSchema,
) {}
