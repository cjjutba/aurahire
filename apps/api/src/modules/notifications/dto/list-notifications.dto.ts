import { createZodDto } from "nestjs-zod";
import { listNotificationsQuerySchema } from "@aurahire/shared";

export class ListNotificationsDto extends createZodDto(listNotificationsQuerySchema) {}
