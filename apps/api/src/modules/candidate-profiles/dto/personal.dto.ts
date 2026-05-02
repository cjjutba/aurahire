import { createZodDto } from "nestjs-zod";
import { candidatePersonalInfoSchema } from "@aurahire/shared";

export class UpdateCandidatePersonalDto extends createZodDto(candidatePersonalInfoSchema) {}
