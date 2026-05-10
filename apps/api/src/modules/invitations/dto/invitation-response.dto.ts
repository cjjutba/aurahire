import { ApiProperty } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { invitationTokenSchema } from "@aurahire/shared";

export class InvitationTokenDto extends createZodDto(invitationTokenSchema) {}

export class InvitationAcceptResultDto {
  @ApiProperty() companyId!: string;
  @ApiProperty() companyName!: string;
  @ApiProperty({ enum: ["owner", "admin", "recruiter"] }) role!: string;
}

export class InvitationAcceptEnvelopeDto {
  @ApiProperty({ type: () => InvitationAcceptResultDto })
  data!: InvitationAcceptResultDto;
}

export class InvitationDeclineResultDto {
  @ApiProperty() declined!: boolean;
}

export class InvitationDeclineEnvelopeDto {
  @ApiProperty({ type: () => InvitationDeclineResultDto })
  data!: InvitationDeclineResultDto;
}
