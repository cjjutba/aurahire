import { createZodDto } from "nestjs-zod";
import { createFeedbackSchema } from "@aurahire/shared";

export class CreateFeedbackDto extends createZodDto(createFeedbackSchema) {}
