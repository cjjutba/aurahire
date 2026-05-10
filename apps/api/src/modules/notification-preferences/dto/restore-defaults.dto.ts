import { createZodDto } from "nestjs-zod";
import { restoreDefaultsBodySchema } from "@aurahire/shared";

export class RestoreDefaultsDto extends createZodDto(
  restoreDefaultsBodySchema,
) {}
