import { createZodDto } from "nestjs-zod";
import { inviteMemberSchema } from "@aurahire/shared";

export class InviteMemberDto extends createZodDto(inviteMemberSchema) {}
