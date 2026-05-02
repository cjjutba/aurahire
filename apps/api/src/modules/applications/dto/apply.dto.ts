import { createZodDto } from "nestjs-zod";
import { applyToJobSchema } from "@aurahire/shared";

export class ApplyToJobDto extends createZodDto(applyToJobSchema) {}
