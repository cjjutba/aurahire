import { createZodDto } from "nestjs-zod";
import { withdrawApplicationSchema } from "@aurahire/shared";

export class WithdrawApplicationDto extends createZodDto(
  withdrawApplicationSchema,
) {}
