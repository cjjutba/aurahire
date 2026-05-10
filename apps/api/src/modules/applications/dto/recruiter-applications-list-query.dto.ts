import { createZodDto } from "nestjs-zod";
import { recruiterApplicationsListQuerySchema } from "@aurahire/shared";

export class RecruiterApplicationsListQueryDto extends createZodDto(
  recruiterApplicationsListQuerySchema,
) {}
