import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class BiasFlagDto {
  @ApiProperty() id!: string;
  @ApiProperty() jobId!: string;
  @ApiProperty() term!: string;
  @ApiProperty({
    enum: ["gendered", "age-coded", "ableist", "exclusionary", "other"],
  })
  category!: string;
  @ApiPropertyOptional({ nullable: true, enum: ["high", "medium", "low"] })
  severity!: string | null;
  @ApiPropertyOptional({ nullable: true }) suggestion!: string | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  positionStart!: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  positionEnd!: number | null;
  @ApiProperty({ enum: ["flagged", "overridden", "resolved"] })
  status!: string;
  @ApiPropertyOptional({ nullable: true }) overrideReason!: string | null;
  @ApiPropertyOptional({ nullable: true }) overriddenBy!: string | null;
  @ApiPropertyOptional({ nullable: true }) overriddenAt!: string | null;
  @ApiProperty() promptVersion!: string;
  @ApiProperty() modelUsed!: string;
  @ApiProperty() createdAt!: string;
  @ApiPropertyOptional({ nullable: true }) explanation!: string | null;
}

export class CheckBiasFlagPreviewDto {
  @ApiProperty() term!: string;
  @ApiProperty() category!: string;
  @ApiProperty({ enum: ["high", "medium", "low"] }) severity!: string;
  @ApiProperty() explanation!: string;
  @ApiProperty() suggestion!: string;
  @ApiPropertyOptional({ nullable: true, type: Number })
  positionStart!: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  positionEnd!: number | null;
}

export class CheckBiasResponseBodyDto {
  @ApiProperty({ type: [CheckBiasFlagPreviewDto] })
  flags!: CheckBiasFlagPreviewDto[];
  @ApiProperty() latencyMs!: number;
  @ApiProperty() promptVersion!: string;
  @ApiProperty() modelUsed!: string;
}

export class CheckBiasResponseDto {
  @ApiProperty({ type: () => CheckBiasResponseBodyDto })
  data!: CheckBiasResponseBodyDto;
}

export class BiasFlagsListEnvelopeDto {
  @ApiProperty({ type: [BiasFlagDto] })
  data!: BiasFlagDto[];
}

export class BiasFlagEnvelopeDto {
  @ApiProperty({ type: () => BiasFlagDto })
  data!: BiasFlagDto;
}

export class ScanJobBiasEnvelopeDto {
  @ApiProperty({ type: [BiasFlagDto] })
  data!: BiasFlagDto[];
}
