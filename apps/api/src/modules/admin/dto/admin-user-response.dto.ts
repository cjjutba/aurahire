import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AdminUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: ["candidate", "recruiter", "admin"] }) role!: string;
  @ApiProperty({ enum: ["active", "suspended", "deleted"] }) status!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  phone!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  avatarUrl!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  lastLoginAt!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class AdminUserDetailDto extends AdminUserDto {
  @ApiProperty() auditEntryCount!: number;
}

export class AdminUserListMetaDto {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}

export class AdminUserListEnvelopeDto {
  @ApiProperty({ type: [AdminUserDto] })
  data!: AdminUserDto[];
  @ApiProperty({ type: () => AdminUserListMetaDto })
  meta!: AdminUserListMetaDto;
}

export class AdminUserEnvelopeDto {
  @ApiProperty({ type: () => AdminUserDetailDto })
  data!: AdminUserDetailDto;
}

export class ForcePasswordResetDataDto {
  @ApiProperty() resetUrl!: string;
  @ApiProperty() expiresAt!: string;
  @ApiProperty() emailSent!: boolean;
}

export class ForcePasswordResetResponseDto {
  @ApiProperty({ type: () => ForcePasswordResetDataDto })
  data!: ForcePasswordResetDataDto;
}
