import { createZodDto } from "nestjs-zod";
import { declineOfferSchema } from "@aurahire/shared";

export class DeclineOfferDto extends createZodDto(declineOfferSchema) {}
