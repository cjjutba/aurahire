import { createZodDto } from "nestjs-zod";
import { updateApplicationNotesSchema } from "@aurahire/shared";

export class UpdateApplicationNotesDto extends createZodDto(
  updateApplicationNotesSchema,
) {}
