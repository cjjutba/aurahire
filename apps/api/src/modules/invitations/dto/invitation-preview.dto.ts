import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class InvitationPreviewDto {
  @ApiProperty() companyId!: string;
  @ApiProperty() companyName!: string;
  @ApiPropertyOptional({ nullable: true }) companyLogoUrl!: string | null;
  @ApiPropertyOptional({ nullable: true }) inviterName!: string | null;
  @ApiProperty({ enum: ["owner", "admin", "recruiter"] }) role!: string;
  @ApiProperty() email!: string;
  @ApiProperty() invitedAt!: string;
  @ApiPropertyOptional({ nullable: true }) expiresAt!: string | null;
  @ApiProperty({ enum: ["invited", "active", "suspended", "left"] })
  status!: string;
  @ApiProperty() isExpired!: boolean;
}

export class InvitationPreviewEnvelopeDto {
  @ApiProperty({ type: () => InvitationPreviewDto })
  data!: InvitationPreviewDto;
}
