import { createZodDto } from "nestjs-zod";
import { suspendUserSchema } from "@aurahire/shared";

export class SuspendUserDto extends createZodDto(suspendUserSchema) {}
