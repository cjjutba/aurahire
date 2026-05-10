import { createZodDto } from "nestjs-zod";
import { listFeedbackQuerySchema } from "@aurahire/shared";

export class ListFeedbackQueryDto extends createZodDto(
  listFeedbackQuerySchema,
) {}
