import { createZodDto } from "nestjs-zod";
import { enqueueRescoreBatchSchema } from "@aurahire/shared";

export class EnqueueRescoreBatchDto extends createZodDto(
  enqueueRescoreBatchSchema,
) {}
