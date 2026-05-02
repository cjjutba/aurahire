import { createZodDto } from "nestjs-zod";
import { updateJobSchema } from "@aurahire/shared";

export class UpdateJobDto extends createZodDto(updateJobSchema) {}
