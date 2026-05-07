import { createZodDto } from "nestjs-zod";
import { upsertPreferenceBodySchema } from "@aurahire/shared";

export class UpsertPreferenceDto extends createZodDto(upsertPreferenceBodySchema) {}
