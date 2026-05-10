import { createZodDto } from "nestjs-zod";
import { updateMyProfileSchema } from "@aurahire/shared";

export class UpdateMyProfileDto extends createZodDto(updateMyProfileSchema) {}
