import { ApiProperty } from "@nestjs/swagger";

export class CompanySummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) industry!: string | null;
  @ApiProperty({ nullable: true }) logoUrl!: string | null;
}

export class JobResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true }) department!: string | null;
  @ApiProperty() employmentType!: string;
  @ApiProperty() workMode!: string;
  @ApiProperty({ nullable: true }) locationCity!: string | null;
  @ApiProperty({ nullable: true }) locationRegion!: string | null;
  @ApiProperty({ nullable: true }) locationCountry!: string | null;
  @ApiProperty({ nullable: true, type: Number }) salaryMin!: number | null;
  @ApiProperty({ nullable: true, type: Number }) salaryMax!: number | null;
  @ApiProperty() salaryCurrency!: string;
  @ApiProperty() description!: string;
  @ApiProperty() descriptionPlain!: string;
  @ApiProperty({ type: [String] }) requiredSkills!: string[];
  @ApiProperty() experienceLevel!: string;
  @ApiProperty({ nullable: true }) educationRequirement!: string | null;
  @ApiProperty({ nullable: true }) applicationDeadline!: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() viewCount!: number;
  @ApiProperty({ nullable: true }) publishedAt!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiProperty({ type: () => CompanySummaryDto })
  company!: CompanySummaryDto;
}

export class JobResponseEnvelopeDto {
  @ApiProperty({ type: () => JobResponseDto })
  data!: JobResponseDto;
}
