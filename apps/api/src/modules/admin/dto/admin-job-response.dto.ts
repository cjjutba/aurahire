import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AdminJobRecruiterDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
}

export class AdminJobCompanyDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

export class AdminJobBiasFlagDto {
  @ApiProperty() id!: string;
  @ApiProperty() term!: string;
  @ApiProperty() category!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  severity!: string | null;
  @ApiProperty({ enum: ["flagged", "overridden", "resolved"] })
  status!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  overrideReason!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  overriddenAt!: string | null;
  @ApiProperty() createdAt!: string;
}

export class AdminJobDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  department!: string | null;
  @ApiProperty({ enum: ["draft", "published", "archived", "closed"] })
  status!: string;
  @ApiProperty() employmentType!: string;
  @ApiProperty() workMode!: string;
  @ApiProperty() experienceLevel!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  publishedAt!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ type: () => AdminJobRecruiterDto })
  recruiter!: AdminJobRecruiterDto;
  @ApiProperty({ type: () => AdminJobCompanyDto })
  company!: AdminJobCompanyDto;
  @ApiProperty() biasFlagsCount!: number;
  @ApiProperty() applicationsCount!: number;
}

export class AdminJobDetailDto extends AdminJobDto {
  @ApiProperty() description!: string;
  @ApiProperty() descriptionPlain!: string;
  @ApiProperty({ type: [String] })
  requiredSkills!: string[];
  @ApiProperty({ type: [AdminJobBiasFlagDto] })
  biasFlags!: AdminJobBiasFlagDto[];
}

export class AdminJobListMetaDto {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}

export class AdminJobListEnvelopeDto {
  @ApiProperty({ type: [AdminJobDto] })
  data!: AdminJobDto[];
  @ApiProperty({ type: () => AdminJobListMetaDto })
  meta!: AdminJobListMetaDto;
}

export class AdminJobEnvelopeDto {
  @ApiProperty({ type: () => AdminJobDetailDto })
  data!: AdminJobDetailDto;
}
