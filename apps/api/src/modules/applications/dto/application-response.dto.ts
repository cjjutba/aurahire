import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class MatchEvidenceDto {
  @ApiProperty() excerpt!: string;
  @ApiProperty() source!: string;
  @ApiProperty({ enum: ["positive", "negative", "neutral"] }) relevance!: string;
  @ApiPropertyOptional({ nullable: true, type: Number })
  contributionPoints!: number | null;
}

export class MatchComponentDto {
  @ApiProperty({ enum: ["skills", "experience", "education", "cultural_fit"] })
  name!: string;
  @ApiProperty() score!: number;
  @ApiProperty() max!: number;
  @ApiProperty() weight!: number;
  @ApiProperty() explanation!: string;
  @ApiProperty({ type: [MatchEvidenceDto] }) evidence!: MatchEvidenceDto[];
}

export class MatchScoreDto {
  @ApiProperty() id!: string;
  @ApiProperty() overallScore!: number;
  @ApiProperty({ enum: ["strong", "partial", "limited"] }) band!: string;
  @ApiProperty({ type: [MatchComponentDto] }) components!: MatchComponentDto[];
  @ApiProperty() summary!: string;
  @ApiProperty({ nullable: true, type: [String] }) redFlags!: string[] | null;
  @ApiProperty({ nullable: true, type: [String] }) greenFlags!: string[] | null;
  @ApiProperty({ type: [String] }) redactedFields!: string[];
  @ApiProperty() promptVersion!: string;
  @ApiProperty() modelUsed!: string;
  @ApiProperty() latencyMs!: number;
  @ApiProperty() createdAt!: string;
}

export class ApplicationCandidateDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
  @ApiPropertyOptional({ nullable: true }) phone!: string | null;
  @ApiPropertyOptional({ nullable: true }) headline!: string | null;
}

export class ApplicationCompanyDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

export class ApplicationJobDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true }) department!: string | null;
  @ApiProperty() employmentType!: string;
  @ApiProperty() workMode!: string;
  @ApiProperty({ type: () => ApplicationCompanyDto }) company!: ApplicationCompanyDto;
}

export class ApplicationDto {
  @ApiProperty() id!: string;
  @ApiProperty() jobId!: string;
  @ApiProperty() candidateId!: string;
  @ApiProperty() resumeId!: string;
  @ApiPropertyOptional({ nullable: true }) coverLetter!: string | null;
  @ApiProperty({
    enum: ["applied", "screening", "interview", "offer", "hired", "rejected", "withdrawn"],
  })
  status!: string;
  @ApiPropertyOptional({ nullable: true }) recruiterNotes!: string | null;
  @ApiProperty() appliedAt!: string;
  @ApiProperty() statusUpdatedAt!: string;
  @ApiPropertyOptional({ type: () => MatchScoreDto, nullable: true })
  matchScore!: MatchScoreDto | null;
  @ApiPropertyOptional({ type: () => ApplicationCandidateDto, nullable: true })
  candidate!: ApplicationCandidateDto | null;
  @ApiPropertyOptional({ type: () => ApplicationJobDto, nullable: true })
  job!: ApplicationJobDto | null;
}

export class ApplicationEnvelopeDto {
  @ApiProperty({ type: () => ApplicationDto })
  data!: ApplicationDto;
}

export class ApplicationListEnvelopeDto {
  @ApiProperty({ type: [ApplicationDto] })
  data!: ApplicationDto[];
}

export class SignedDownloadPayloadDto {
  @ApiProperty() signedUrl!: string;
  @ApiProperty() expiresAt!: string;
}

export class SignedDownloadEnvelopeDto {
  @ApiProperty({ type: () => SignedDownloadPayloadDto })
  data!: SignedDownloadPayloadDto;
}
