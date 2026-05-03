import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

// ---------------- KPIS ----------------

export class AnalyticsKpisDto {
  @ApiProperty() totalUsers!: number;
  @ApiProperty() newUsersThisPeriod!: number;
  @ApiProperty() growthPct!: number;
  @ApiProperty() activeJobs!: number;
  @ApiProperty() avgApplicationsPerDay!: number;
  @ApiPropertyOptional({ nullable: true, type: Number })
  avgTimeToHireDays!: number | null;
}

// ---------------- CHART POINTS ----------------

export class UserGrowthPointDto {
  @ApiProperty() date!: string;
  @ApiProperty() candidate!: number;
  @ApiProperty() recruiter!: number;
  @ApiProperty() admin!: number;
}

export class JobsOverTimePointDto {
  @ApiProperty() date!: string;
  @ApiProperty() draft!: number;
  @ApiProperty() published!: number;
  @ApiProperty() archived!: number;
}

export class ApplicationsByStatusPointDto {
  @ApiProperty() date!: string;
  @ApiProperty() applied!: number;
  @ApiProperty() screening!: number;
  @ApiProperty() interview!: number;
  @ApiProperty() offer!: number;
  @ApiProperty() hired!: number;
  @ApiProperty() rejected!: number;
  @ApiProperty() withdrawn!: number;
}

export class ScoreBucketDto {
  @ApiProperty() bucket!: string;
  @ApiProperty() count!: number;
}

export class AiProcessingPointDto {
  @ApiProperty() date!: string;
  @ApiProperty() avgParseMs!: number;
  @ApiProperty() avgScoreMs!: number;
}

export class TopRecruiterDto {
  @ApiProperty() recruiterId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() jobCount!: number;
  @ApiProperty() applicationCount!: number;
}

// ---------------- BUNDLE ----------------

export class AnalyticsRangeDto {
  @ApiProperty() from!: string;
  @ApiProperty() to!: string;
}

export class AnalyticsChartsDto {
  @ApiProperty({ type: [UserGrowthPointDto] }) userGrowth!: UserGrowthPointDto[];
  @ApiProperty({ type: [JobsOverTimePointDto] }) jobsOverTime!: JobsOverTimePointDto[];
  @ApiProperty({ type: [ApplicationsByStatusPointDto] })
  applicationsByStatus!: ApplicationsByStatusPointDto[];
  @ApiProperty({ type: [ScoreBucketDto] }) scoreDistribution!: ScoreBucketDto[];
  @ApiProperty({ type: [AiProcessingPointDto] }) aiProcessingTime!: AiProcessingPointDto[];
  @ApiProperty({ type: [TopRecruiterDto] }) topRecruiters!: TopRecruiterDto[];
}

export class AnalyticsBundleDto {
  @ApiProperty({ type: () => AnalyticsRangeDto }) range!: AnalyticsRangeDto;
  @ApiProperty({ type: () => AnalyticsKpisDto }) kpis!: AnalyticsKpisDto;
  @ApiProperty({ type: () => AnalyticsChartsDto }) charts!: AnalyticsChartsDto;
}

export class AnalyticsBundleEnvelopeDto {
  @ApiProperty({ type: () => AnalyticsBundleDto })
  data!: AnalyticsBundleDto;
}
