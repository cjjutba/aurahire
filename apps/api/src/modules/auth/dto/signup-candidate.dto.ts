import { createZodDto } from "nestjs-zod";
import { signupCandidateSchema } from "@aurahire/shared";

export class SignupCandidateDto extends createZodDto(signupCandidateSchema) {}
