import { createZodDto } from "nestjs-zod";
import { listJobsQuerySchema } from "@aurahire/shared";

export class ListJobsQueryDto extends createZodDto(listJobsQuerySchema) {}
