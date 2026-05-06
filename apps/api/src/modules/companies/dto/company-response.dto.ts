import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CompanyResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) industry!: string | null;
  @ApiPropertyOptional({ nullable: true }) size!: string | null;
  @ApiPropertyOptional({ nullable: true }) website!: string | null;
  @ApiPropertyOptional({ nullable: true }) logoUrl!: string | null;
  @ApiPropertyOptional({ nullable: true }) headquartersLocation!: string | null;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty() createdBy!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class CompanyEnvelopeDto {
  @ApiProperty({ type: () => CompanyResponseDto })
  data!: CompanyResponseDto;
}
