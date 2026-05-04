import { createZodDto } from "nestjs-zod";
import { updateInterviewFeedbackSchema } from "@aurahire/shared";

export class UpdateInterviewFeedbackDto extends createZodDto(updateInterviewFeedbackSchema) {}
