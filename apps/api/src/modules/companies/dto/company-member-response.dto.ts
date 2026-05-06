import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CompanyMemberUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
  @ApiPropertyOptional({ nullable: true }) avatarUrl!: string | null;
}

export class CompanyMemberResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() companyId!: string;
  @ApiPropertyOptional({ nullable: true }) userId!: string | null;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: ["owner", "admin", "recruiter"] }) role!: string;
  @ApiProperty({ enum: ["invited", "active", "suspended", "left"] }) status!: string;
  @ApiPropertyOptional({ nullable: true }) invitationToken!: string | null;
  @ApiPropertyOptional({ nullable: true }) invitationExpiresAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) invitedBy!: string | null;
  @ApiPropertyOptional({ nullable: true }) inviterName!: string | null;
  @ApiProperty() invitedAt!: string;
  @ApiPropertyOptional({ nullable: true }) joinedAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) removedAt!: string | null;
  @ApiPropertyOptional({ type: () => CompanyMemberUserDto, nullable: true })
  user!: CompanyMemberUserDto | null;
}

export class CompanyMemberEnvelopeDto {
  @ApiProperty({ type: () => CompanyMemberResponseDto })
  data!: CompanyMemberResponseDto;
}

export class CompanyMembersListEnvelopeDto {
  @ApiProperty({ type: [CompanyMemberResponseDto] })
  data!: CompanyMemberResponseDto[];
}
