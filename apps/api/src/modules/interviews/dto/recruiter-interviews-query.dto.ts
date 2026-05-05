import { createZodDto } from "nestjs-zod";
import { recruiterInterviewsQuerySchema } from "@aurahire/shared";

export class RecruiterInterviewsQueryDto extends createZodDto(
  recruiterInterviewsQuerySchema,
) {}
