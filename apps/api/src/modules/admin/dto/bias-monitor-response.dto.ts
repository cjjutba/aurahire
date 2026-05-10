import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

// ---------------- KPIs ----------------

export class BiasMonitorKpisDto {
  @ApiProperty() totalFlags!: number;
  @ApiProperty() flagsPerJob!: number;
  @ApiProperty() flagsResolvedPct!: number;
  @ApiProperty() overrideRate!: number;
}

// ---------------- WIDGETS ----------------

export class FlagsByCategoryDto {
  @ApiProperty({
    enum: ["gendered", "age-coded", "ableist", "exclusionary", "other"],
  })
  category!: string;
  @ApiProperty() count!: number;
  @ApiProperty() pct!: number;
}

export class TopFlaggedTermDto {
  @ApiProperty() term!: string;
  @ApiProperty() count!: number;
  @ApiProperty({ type: [String] }) exampleJobIds!: string[];
}

export class ScoreBandSliceDto {
  @ApiProperty({ enum: ["strong", "partial", "limited"] }) band!: string;
  @ApiProperty() count!: number;
  @ApiProperty() pct!: number;
}

export class OverrideRecruiterDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
}

export class RecentOverrideDto {
  @ApiProperty() flagId!: string;
  @ApiProperty() term!: string;
  @ApiProperty() category!: string;
  @ApiProperty() jobId!: string;
  @ApiProperty() jobTitle!: string;
  @ApiPropertyOptional({ nullable: true, type: () => OverrideRecruiterDto })
  overriddenBy!: OverrideRecruiterDto | null;
  @ApiProperty() overrideReason!: string;
  @ApiProperty() overriddenAt!: string;
}

// ---------------- SCORING QUALITY ----------------

export class ScoringQualityReasonDto {
  @ApiProperty() reason!: string;
  @ApiProperty() count!: number;
}

export class ScoringQualityComponentDto {
  @ApiProperty() componentName!: string;
  @ApiProperty() count!: number;
}

export class ScoringQualityRecentDto {
  @ApiProperty() auditLogId!: string;
  @ApiProperty() componentName!: string;
  @ApiProperty() reason!: string;
  @ApiProperty() promptVersion!: string;
  @ApiProperty() createdAt!: string;
}

export class ScoringQualityDto {
  @ApiProperty() totalWarnings!: number;
  @ApiProperty({ type: [ScoringQualityReasonDto] })
  byReason!: ScoringQualityReasonDto[];
  @ApiProperty({ type: [ScoringQualityComponentDto] })
  byComponent!: ScoringQualityComponentDto[];
  @ApiProperty({ type: [ScoringQualityRecentDto] })
  recent!: ScoringQualityRecentDto[];
}

// ---------------- BUNDLE ----------------

export class BiasMonitorRangeDto {
  @ApiProperty() from!: string;
  @ApiProperty() to!: string;
}

export class BiasMonitorSampleSizeDto {
  @ApiProperty() flags!: number;
  @ApiProperty() scores!: number;
  @ApiProperty() jobs!: number;
}

export class BiasMonitorBundleDto {
  @ApiProperty({ type: () => BiasMonitorRangeDto }) range!: BiasMonitorRangeDto;
  @ApiProperty({ type: () => BiasMonitorKpisDto }) kpis!: BiasMonitorKpisDto;
  @ApiProperty({ type: [FlagsByCategoryDto] })
  flagsByCategory!: FlagsByCategoryDto[];
  @ApiProperty({ type: [TopFlaggedTermDto] })
  topFlaggedTerms!: TopFlaggedTermDto[];
  @ApiProperty({ type: [ScoreBandSliceDto] })
  scoreDistributionByBand!: ScoreBandSliceDto[];
  @ApiProperty({ type: [RecentOverrideDto] })
  recentOverrides!: RecentOverrideDto[];
  @ApiProperty({ type: () => BiasMonitorSampleSizeDto })
  sampleSize!: BiasMonitorSampleSizeDto;
  @ApiProperty({ type: () => ScoringQualityDto })
  scoringQuality!: ScoringQualityDto;
}

export class BiasMonitorBundleEnvelopeDto {
  @ApiProperty({ type: () => BiasMonitorBundleDto })
  data!: BiasMonitorBundleDto;
}
