import { createZodDto } from "nestjs-zod";
import { updateInterviewStatusSchema } from "@aurahire/shared";

export class UpdateInterviewStatusDto extends createZodDto(
  updateInterviewStatusSchema,
) {}
