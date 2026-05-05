import { createZodDto } from "nestjs-zod";
import { shortlistQuerySchema } from "@aurahire/shared";

export class ShortlistQueryDto extends createZodDto(shortlistQuerySchema) {}
