import { createZodDto } from "nestjs-zod";
import { resetPasswordRequestSchema } from "@aurahire/shared";

export class ResetPasswordDto extends createZodDto(resetPasswordRequestSchema) {}
