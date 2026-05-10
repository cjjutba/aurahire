import { createZodDto } from "nestjs-zod";
import { updateCompanySchema, deleteCompanySchema } from "@aurahire/shared";

export class UpdateCompanyDto extends createZodDto(updateCompanySchema) {}

export class DeleteCompanyDto extends createZodDto(deleteCompanySchema) {}
