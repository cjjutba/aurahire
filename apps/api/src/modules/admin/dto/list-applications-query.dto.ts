import { createZodDto } from "nestjs-zod";
import { listAdminApplicationsQuerySchema } from "@aurahire/shared";

export class ListAdminApplicationsQueryDto extends createZodDto(
  listAdminApplicationsQuerySchema,
) {}
