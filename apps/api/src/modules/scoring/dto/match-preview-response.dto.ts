import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import {
  MatchComponentDto,
  CalibrationWarningDto,
} from "../../applications/dto/application-response.dto";

export class MatchScorePreviewDto {
  @ApiProperty() id!: string;
  @ApiProperty() jobId!: string;
  @ApiProperty() resumeId!: string;
  @ApiProperty() overallScore!: number;
  @ApiProperty({ enum: ["strong", "partial", "limited"] }) band!: string;
  @ApiProperty({ type: [MatchComponentDto] }) components!: MatchComponentDto[];
  @ApiProperty({ type: [String] }) redactedFields!: string[];
  @ApiProperty() promptVersion!: string;
  @ApiProperty() modelUsed!: string;
  @ApiProperty() latencyMs!: number;
  @ApiProperty({ enum: ["system", "candidate"] }) source!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ type: [CalibrationWarningDto] })
  calibrationWarnings!: CalibrationWarningDto[];
  @ApiPropertyOptional({ nullable: true }) job?: {
    id: string;
    title: string;
    company: { id: string; name: string; logoUrl: string | null } | null;
  } | null;
}

export class MatchScorePreviewEnvelopeDto {
  @ApiProperty({ type: () => MatchScorePreviewDto, nullable: true })
  data!: MatchScorePreviewDto | null;
}

export class MatchScorePreviewListEnvelopeDto {
  @ApiProperty({ type: [MatchScorePreviewDto] })
  data!: MatchScorePreviewDto[];
}
