import { createZodDto } from "nestjs-zod";
import { checkBiasInputSchema } from "@aurahire/shared";

export class CheckBiasDto extends createZodDto(checkBiasInputSchema) {}
