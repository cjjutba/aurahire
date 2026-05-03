import { createZodDto } from "nestjs-zod";
import { analyticsQuerySchema } from "@aurahire/shared";

export class AnalyticsQueryDto extends createZodDto(analyticsQuerySchema) {}
