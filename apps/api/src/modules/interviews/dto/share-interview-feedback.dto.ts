import { createZodDto } from "nestjs-zod";
import { shareInterviewFeedbackSchema } from "@aurahire/shared";

export class ShareInterviewFeedbackDto extends createZodDto(shareInterviewFeedbackSchema) {}
