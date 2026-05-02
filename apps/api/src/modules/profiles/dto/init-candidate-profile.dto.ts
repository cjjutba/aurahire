import { createZodDto } from "nestjs-zod";
import { initCandidateProfileSchema } from "@aurahire/shared";

export class InitCandidateProfileDto extends createZodDto(initCandidateProfileSchema) {}
