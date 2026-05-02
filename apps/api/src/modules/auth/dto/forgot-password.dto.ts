import { createZodDto } from "nestjs-zod";
import { forgotPasswordSchema } from "@aurahire/shared";

export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
