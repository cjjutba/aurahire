import { createZodDto } from "nestjs-zod";
import { verifyEmailSchema } from "@aurahire/shared";

export class VerifyEmailDto extends createZodDto(verifyEmailSchema) {}
