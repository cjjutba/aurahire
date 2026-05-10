import { createZodDto } from "nestjs-zod";
import { updateFeedbackSchema } from "@aurahire/shared";

export class UpdateFeedbackDto extends createZodDto(updateFeedbackSchema) {}
