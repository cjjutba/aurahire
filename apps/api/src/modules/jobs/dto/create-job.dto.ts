import { createZodDto } from "nestjs-zod";
import { createJobSchema } from "@aurahire/shared";

export class CreateJobDto extends createZodDto(createJobSchema) {}
