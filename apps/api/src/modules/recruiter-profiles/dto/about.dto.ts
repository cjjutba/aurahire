import { createZodDto } from "nestjs-zod";
import { recruiterAboutSchema } from "@aurahire/shared";

export class UpdateRecruiterAboutDto extends createZodDto(recruiterAboutSchema) {}
