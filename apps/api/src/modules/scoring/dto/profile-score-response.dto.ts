import { ApiProperty } from "@nestjs/swagger";

export class ScoreEvidenceDto {
  @ApiProperty() excerpt!: string;
  @ApiProperty() source!: string;
  @ApiProperty({ enum: ["positive", "negative", "neutral"] }) relevance!: string;
}

export class ProfileComponentDto {
  @ApiProperty({
    enum: ["completeness", "skill_depth", "experience_clarity", "education_quality"],
  })
  name!: string;
  @ApiProperty() score!: number;
  @ApiProperty() max!: number;
  @ApiProperty() weight!: number;
  @ApiProperty() explanation!: string;
  @ApiProperty({ type: [ScoreEvidenceDto] }) evidence!: ScoreEvidenceDto[];
}

export class ImprovementSuggestionDto {
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty() estimatedImpact!: number;
}

export class ProfileScoreDto {
  @ApiProperty() id!: string;
  @ApiProperty() overallScore!: number;
  @ApiProperty({ enum: ["strong", "partial", "limited"] }) band!: string;
  @ApiProperty({ type: [ProfileComponentDto] }) components!: ProfileComponentDto[];
  @ApiProperty({ type: [ImprovementSuggestionDto] })
  improvementSuggestions!: ImprovementSuggestionDto[];
  @ApiProperty({ type: [String] }) redactedFields!: string[];
  @ApiProperty() promptVersion!: string;
  @ApiProperty() modelUsed!: string;
  @ApiProperty() latencyMs!: number;
  @ApiProperty() createdAt!: string;
}

export class ProfileScoreEnvelopeDto {
  @ApiProperty({ type: () => ProfileScoreDto, nullable: true })
  data!: ProfileScoreDto | null;
}
