import { createZodDto } from "nestjs-zod";
import { updateApplicationStatusSchema } from "@aurahire/shared";

export class UpdateApplicationStatusDto extends createZodDto(
  updateApplicationStatusSchema,
) {}
