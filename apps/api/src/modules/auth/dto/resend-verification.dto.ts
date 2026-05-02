import { createZodDto } from "nestjs-zod";
import { resendVerificationSchema } from "@aurahire/shared";

export class ResendVerificationDto extends createZodDto(resendVerificationSchema) {}
