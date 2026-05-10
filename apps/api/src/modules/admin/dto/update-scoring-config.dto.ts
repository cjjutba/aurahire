import { createZodDto } from "nestjs-zod";
import { updateScoringConfigSchema } from "@aurahire/shared";

export class UpdateScoringConfigDto extends createZodDto(
  updateScoringConfigSchema,
) {}
