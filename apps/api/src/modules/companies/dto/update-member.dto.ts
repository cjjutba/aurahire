import { createZodDto } from "nestjs-zod";
import { updateMemberSchema, transferOwnershipSchema } from "@aurahire/shared";

export class UpdateMemberDto extends createZodDto(updateMemberSchema) {}

export class TransferOwnershipDto extends createZodDto(
  transferOwnershipSchema,
) {}
