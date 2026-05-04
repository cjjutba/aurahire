import { createZodDto } from "nestjs-zod";
import { createOfferSchema } from "@aurahire/shared";

export class CreateOfferDto extends createZodDto(createOfferSchema) {}
