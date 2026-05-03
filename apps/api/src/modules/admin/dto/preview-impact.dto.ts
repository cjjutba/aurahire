import { createZodDto } from "nestjs-zod";
import { previewImpactRequestSchema } from "@aurahire/shared";

export class PreviewImpactDto extends createZodDto(previewImpactRequestSchema) {}
