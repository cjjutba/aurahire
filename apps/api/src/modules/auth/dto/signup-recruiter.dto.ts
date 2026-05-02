import { createZodDto } from "nestjs-zod";
import { signupRecruiterSchema } from "@aurahire/shared";

export class SignupRecruiterDto extends createZodDto(signupRecruiterSchema) {}
