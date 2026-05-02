import { createZodDto } from "nestjs-zod";
import { recruiterFocusSchema } from "@aurahire/shared";

export class UpdateRecruiterFocusDto extends createZodDto(recruiterFocusSchema) {}
