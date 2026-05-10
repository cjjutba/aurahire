import { ApiProperty } from "@nestjs/swagger";

export class AdminStatBlockDto {
  @ApiProperty() label!: string;
  @ApiProperty() value!: number;
  @ApiProperty({ nullable: true, type: String }) trend!: string | null;
}

export class ScoreBandHistogramEntryDto {
  @ApiProperty({ enum: ["strong", "partial", "limited"] }) band!: string;
  @ApiProperty() count!: number;
}

export class BiasCategoryBreakdownDto {
  @ApiProperty({
    enum: ["gendered", "age-coded", "ableist", "exclusionary", "other"],
  })
  category!: string;
  @ApiProperty() count!: number;
}

export class RecentAuditEntryDto {
  @ApiProperty() action!: string;
  @ApiProperty() actorType!: string;
  @ApiProperty() entityType!: string;
  @ApiProperty() createdAt!: string;
}

export class AdminStatsOverviewDto {
  @ApiProperty({ type: () => AdminStatBlockDto })
  totalUsers!: AdminStatBlockDto;
  @ApiProperty({ type: () => AdminStatBlockDto })
  activeJobs!: AdminStatBlockDto;
  @ApiProperty({ type: () => AdminStatBlockDto })
  applicationsToday!: AdminStatBlockDto;
  @ApiProperty({ type: () => AdminStatBlockDto })
  applicationsThisWeek!: AdminStatBlockDto;
  @ApiProperty({ type: () => AdminStatBlockDto })
  avgProfileScore!: AdminStatBlockDto;
  @ApiProperty({ type: () => AdminStatBlockDto })
  avgMatchScore!: AdminStatBlockDto;
  @ApiProperty({ type: [ScoreBandHistogramEntryDto] })
  scoreBandHistogram!: ScoreBandHistogramEntryDto[];
  @ApiProperty({ type: [BiasCategoryBreakdownDto] })
  biasFlagsThisWeek!: BiasCategoryBreakdownDto[];
  @ApiProperty({ type: [RecentAuditEntryDto] })
  recentAuditEvents!: RecentAuditEntryDto[];
}

export class AdminStatsOverviewEnvelopeDto {
  @ApiProperty({ type: () => AdminStatsOverviewDto })
  data!: AdminStatsOverviewDto;
}
