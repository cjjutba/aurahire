import { createZodDto } from "nestjs-zod";
import { candidatePreferencesSchema } from "@aurahire/shared";

export class UpdateCandidatePreferencesDto extends createZodDto(candidatePreferencesSchema) {}
