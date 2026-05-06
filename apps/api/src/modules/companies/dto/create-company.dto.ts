import { createZodDto } from "nestjs-zod";
import { createCompanySchema } from "@aurahire/shared";

export class CreateCompanyDto extends createZodDto(createCompanySchema) {}
