import { createZodDto } from "nestjs-zod";
import { listAdminAuditQuerySchema } from "@aurahire/shared";

export class ListAdminAuditQueryDto extends createZodDto(
  listAdminAuditQuerySchema,
) {}
