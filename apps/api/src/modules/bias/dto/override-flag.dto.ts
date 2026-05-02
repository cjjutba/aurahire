import { createZodDto } from "nestjs-zod";
import { overrideBiasFlagInputSchema } from "@aurahire/shared";

export class OverrideBiasFlagDto extends createZodDto(overrideBiasFlagInputSchema) {}
