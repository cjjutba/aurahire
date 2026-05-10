import { createZodDto } from "nestjs-zod";
import { recruiterCompanySchema } from "@aurahire/shared";

export class UpdateRecruiterCompanyDto extends createZodDto(
  recruiterCompanySchema,
) {}
