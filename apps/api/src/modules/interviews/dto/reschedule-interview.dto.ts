import { createZodDto } from "nestjs-zod";
import { rescheduleInterviewSchema } from "@aurahire/shared";

export class RescheduleInterviewDto extends createZodDto(rescheduleInterviewSchema) {}
