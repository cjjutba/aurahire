import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class MembershipDto {
  @ApiProperty() companyId!: string;
  @ApiProperty() companyName!: string;
  @ApiPropertyOptional({ nullable: true }) companyLogoUrl!: string | null;
  @ApiProperty({ enum: ["owner", "admin", "recruiter"] }) role!: string;
  @ApiProperty({ enum: ["invited", "active", "suspended", "left"] })
  status!: string;
  @ApiPropertyOptional({ nullable: true }) joinedAt!: string | null;
}

export class MembershipsListEnvelopeDto {
  @ApiProperty({ type: [MembershipDto] })
  data!: MembershipDto[];
}
