import { createZodDto } from "nestjs-zod";
import { scheduleInterviewSchema } from "@aurahire/shared";

export class ScheduleInterviewDto extends createZodDto(
  scheduleInterviewSchema,
) {}
