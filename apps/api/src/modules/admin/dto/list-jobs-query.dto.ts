import { createZodDto } from "nestjs-zod";
import { listAdminJobsQuerySchema } from "@aurahire/shared";

export class ListAdminJobsQueryDto extends createZodDto(listAdminJobsQuerySchema) {}
