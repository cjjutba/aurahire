import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class MatchWeightsDto {
  @ApiProperty() skills!: number;
  @ApiProperty() experience!: number;
  @ApiProperty() education!: number;
  @ApiProperty() cultural_fit!: number;
}

export class ProfileWeightsDto {
  @ApiProperty() completeness!: number;
  @ApiProperty() skill_depth!: number;
  @ApiProperty() experience_clarity!: number;
  @ApiProperty() education_quality!: number;
}

export class BandThresholdsDto {
  @ApiProperty() strong!: number;
  @ApiProperty() partial!: number;
}

export class ScoringConfigUpdatedByDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
}

export class ScoringConfigDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: () => MatchWeightsDto }) matchWeights!: MatchWeightsDto;
  @ApiProperty({ type: () => ProfileWeightsDto }) profileWeights!: ProfileWeightsDto;
  @ApiProperty({ type: () => BandThresholdsDto }) bandThresholds!: BandThresholdsDto;
  @ApiProperty({ type: [String] }) biasCategoriesEnabled!: string[];
  @ApiProperty({ type: [String] }) customFlaggedTerms!: string[];
  @ApiProperty() piiRedactionEnabled!: boolean;
  @ApiProperty({ type: [String] }) piiFieldsRedacted!: string[];
  @ApiPropertyOptional({ type: () => ScoringConfigUpdatedByDto, nullable: true })
  updatedBy!: ScoringConfigUpdatedByDto | null;
  @ApiProperty() updatedAt!: string;
}

export class ScoringConfigEnvelopeDto {
  @ApiProperty({ type: () => ScoringConfigDto })
  data!: ScoringConfigDto;
}

// ---------------- PREVIEW IMPACT RESPONSE ----------------

export class BandDistributionDto {
  @ApiProperty() strong!: number;
  @ApiProperty() partial!: number;
  @ApiProperty() limited!: number;
  @ApiProperty() avgScore!: number;
}

export class TopMoverDto {
  @ApiProperty() applicationId!: string;
  @ApiProperty() candidateName!: string;
  @ApiProperty() jobTitle!: string;
  @ApiProperty() currentScore!: number;
  @ApiProperty() proposedScore!: number;
  @ApiProperty() currentBand!: string;
  @ApiProperty() proposedBand!: string;
}

export class PreviewImpactDataDto {
  @ApiProperty() sampledCount!: number;
  @ApiProperty({ type: () => BandDistributionDto }) current!: BandDistributionDto;
  @ApiProperty({ type: () => BandDistributionDto }) proposed!: BandDistributionDto;
  @ApiProperty({ type: () => BandDistributionDto }) delta!: BandDistributionDto;
  @ApiProperty({ type: [TopMoverDto] }) examples!: TopMoverDto[];
}

export class PreviewImpactEnvelopeDto {
  @ApiProperty({ type: () => PreviewImpactDataDto })
  data!: PreviewImpactDataDto;
}
