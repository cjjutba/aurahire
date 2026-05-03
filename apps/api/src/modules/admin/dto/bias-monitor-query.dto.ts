import { createZodDto } from "nestjs-zod";
import { biasMonitorQuerySchema } from "@aurahire/shared";

export class BiasMonitorQueryDto extends createZodDto(biasMonitorQuerySchema) {}
