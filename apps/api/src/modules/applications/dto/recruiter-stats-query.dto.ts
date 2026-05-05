import { createZodDto } from "nestjs-zod";
import { recruiterStatsQuerySchema } from "@aurahire/shared";

export class RecruiterStatsQueryDto extends createZodDto(recruiterStatsQuerySchema) {}
