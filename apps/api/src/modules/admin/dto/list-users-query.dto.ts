import { createZodDto } from "nestjs-zod";
import { listAdminUsersQuerySchema } from "@aurahire/shared";

export class ListAdminUsersQueryDto extends createZodDto(listAdminUsersQuerySchema) {}
