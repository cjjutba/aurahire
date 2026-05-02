import { createZodDto } from "nestjs-zod";
import { initRecruiterProfileSchema } from "@aurahire/shared";

export class InitRecruiterProfileDto extends createZodDto(initRecruiterProfileSchema) {}
