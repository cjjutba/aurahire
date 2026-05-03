import { createZodDto } from "nestjs-zod";
import { changeUserRoleSchema } from "@aurahire/shared";

export class ChangeUserRoleDto extends createZodDto(changeUserRoleSchema) {}
