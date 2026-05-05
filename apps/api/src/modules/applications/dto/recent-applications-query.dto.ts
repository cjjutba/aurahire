import { createZodDto } from "nestjs-zod";
import { recentApplicationsQuerySchema } from "@aurahire/shared";

export class RecentApplicationsQueryDto extends createZodDto(recentApplicationsQuerySchema) {}
