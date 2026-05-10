import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AuditActorDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
  @ApiPropertyOptional({ nullable: true }) role!: string | null;
}

export class AuditCompanyDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) logoUrl!: string | null;
}

export class AuditEntryRowDto {
  @ApiProperty() id!: string;
  @ApiProperty() action!: string;
  @ApiProperty({ enum: ["user", "ai", "system"] }) actorType!: string;
  @ApiPropertyOptional({ nullable: true, type: () => AuditActorDto })
  actor!: AuditActorDto | null;
  @ApiPropertyOptional({ nullable: true, type: () => AuditCompanyDto })
  company!: AuditCompanyDto | null;
  @ApiProperty() entityType!: string;
  @ApiProperty() entityId!: string;
  @ApiProperty() detailsSnippet!: string;
  @ApiProperty() createdAt!: string;
}

export class AuditEntryDetailDto extends AuditEntryRowDto {
  @ApiProperty({ type: () => Object }) details!: Record<string, unknown>;
  @ApiPropertyOptional({ nullable: true }) ipAddress!: string | null;
  @ApiPropertyOptional({ nullable: true }) userAgent!: string | null;
}

export class AuditListMetaDto {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}

export class AuditListEnvelopeDto {
  @ApiProperty({ type: [AuditEntryRowDto] })
  data!: AuditEntryRowDto[];
  @ApiProperty({ type: () => AuditListMetaDto })
  meta!: AuditListMetaDto;
}

export class AuditEntryEnvelopeDto {
  @ApiProperty({ type: () => AuditEntryDetailDto })
  data!: AuditEntryDetailDto;
}
