import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

// ---------------- LIST ROW ----------------

export class AdminApplicationCandidateSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
}

export class AdminApplicationJobSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() companyName!: string;
  @ApiProperty() recruiterName!: string;
}

export class AdminApplicationListRowDto {
  @ApiProperty() id!: string;
  @ApiProperty({
    enum: [
      "applied",
      "screening",
      "interview",
      "offer",
      "hired",
      "rejected",
      "withdrawn",
    ],
  })
  status!: string;
  @ApiProperty() appliedAt!: string;
  @ApiProperty({ type: () => AdminApplicationCandidateSummaryDto })
  candidate!: AdminApplicationCandidateSummaryDto;
  @ApiProperty({ type: () => AdminApplicationJobSummaryDto })
  job!: AdminApplicationJobSummaryDto;
  @ApiPropertyOptional({ nullable: true, type: Number })
  overallScore!: number | null;
  @ApiPropertyOptional({
    nullable: true,
    enum: ["strong", "partial", "limited"],
  })
  band!: string | null;
  @ApiProperty() hasRedactions!: boolean;
}

export class AdminApplicationListMetaDto {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}

export class AdminApplicationListEnvelopeDto {
  @ApiProperty({ type: [AdminApplicationListRowDto] })
  data!: AdminApplicationListRowDto[];
  @ApiProperty({ type: () => AdminApplicationListMetaDto })
  meta!: AdminApplicationListMetaDto;
}

// ---------------- DETAIL ----------------

export class AdminEvidenceDto {
  @ApiProperty() excerpt!: string;
  @ApiPropertyOptional({ nullable: true }) source!: string | null;
  @ApiProperty({ enum: ["positive", "negative", "neutral"] })
  relevance!: string;
  @ApiPropertyOptional({ nullable: true, type: Number })
  contributionPoints!: number | null;
}

export class AdminScoreComponentDto {
  @ApiProperty() name!: string;
  @ApiProperty() score!: number;
  @ApiProperty() max!: number;
  @ApiProperty() weight!: number;
  @ApiProperty() explanation!: string;
  @ApiProperty({ type: [AdminEvidenceDto] }) evidence!: AdminEvidenceDto[];
}

export class AdminMatchScoreDto {
  @ApiProperty() id!: string;
  @ApiProperty() overallScore!: number;
  @ApiProperty({ enum: ["strong", "partial", "limited"] }) band!: string;
  @ApiProperty({ type: [AdminScoreComponentDto] })
  components!: AdminScoreComponentDto[];
  @ApiProperty() summary!: string;
  @ApiProperty({ nullable: true, type: [String] })
  redFlags!: string[] | null;
  @ApiProperty({ nullable: true, type: [String] })
  greenFlags!: string[] | null;
  @ApiProperty({ type: [String] }) redactedFields!: string[];
  @ApiProperty({ type: () => Object }) weightsUsed!: Record<string, unknown>;
  @ApiProperty() promptVersion!: string;
  @ApiProperty() modelUsed!: string;
  @ApiPropertyOptional({ nullable: true, type: Number })
  latencyMs!: number | null;
  @ApiProperty({ type: () => Object }) rawOutput!: Record<string, unknown>;
  @ApiProperty() createdAt!: string;
}

export class AdminApplicationCandidateDetailDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
  @ApiPropertyOptional({ nullable: true }) phone!: string | null;
  @ApiPropertyOptional({ nullable: true }) headline!: string | null;
}

export class AdminApplicationJobRecruiterDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
}

export class AdminApplicationJobCompanyDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

export class AdminApplicationJobDetailDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() descriptionPlain!: string;
  @ApiProperty({ type: [String] }) requiredSkills!: string[];
  @ApiProperty() experienceLevel!: string;
  @ApiPropertyOptional({ nullable: true }) educationRequirement!: string | null;
  @ApiProperty({ type: () => AdminApplicationJobRecruiterDto })
  recruiter!: AdminApplicationJobRecruiterDto;
  @ApiProperty({ type: () => AdminApplicationJobCompanyDto })
  company!: AdminApplicationJobCompanyDto;
}

export class AdminApplicationResumeDto {
  @ApiProperty() id!: string;
  @ApiProperty() filename!: string;
  @ApiProperty({ enum: ["pending", "parsed", "failed"] })
  parseStatus!: string;
  @ApiPropertyOptional({ nullable: true, type: () => Object })
  parsedData!: Record<string, unknown> | null;
  @ApiProperty() uploadedAt!: string;
}

export class AdminAuditEntryDto {
  @ApiProperty() id!: string;
  @ApiProperty() action!: string;
  @ApiProperty({ enum: ["user", "ai", "system"] }) actorType!: string;
  @ApiPropertyOptional({ nullable: true }) actorId!: string | null;
  @ApiProperty() entityType!: string;
  @ApiProperty() entityId!: string;
  @ApiPropertyOptional({ nullable: true, type: () => Object })
  details!: Record<string, unknown> | null;
  @ApiProperty() createdAt!: string;
}

export class AdminApplicationDetailDto {
  @ApiProperty() id!: string;
  @ApiProperty({
    enum: [
      "applied",
      "screening",
      "interview",
      "offer",
      "hired",
      "rejected",
      "withdrawn",
    ],
  })
  status!: string;
  @ApiPropertyOptional({ nullable: true }) coverLetter!: string | null;
  @ApiPropertyOptional({ nullable: true }) recruiterNotes!: string | null;
  @ApiProperty() appliedAt!: string;
  @ApiProperty() statusUpdatedAt!: string;
  @ApiProperty({ type: () => AdminApplicationCandidateDetailDto })
  candidate!: AdminApplicationCandidateDetailDto;
  @ApiProperty({ type: () => AdminApplicationJobDetailDto })
  job!: AdminApplicationJobDetailDto;
  @ApiPropertyOptional({ nullable: true, type: () => AdminMatchScoreDto })
  matchScore!: AdminMatchScoreDto | null;
  @ApiProperty({ type: () => AdminApplicationResumeDto })
  resume!: AdminApplicationResumeDto;
  @ApiProperty({ type: [AdminAuditEntryDto] })
  auditTrail!: AdminAuditEntryDto[];
}

export class AdminApplicationDetailEnvelopeDto {
  @ApiProperty({ type: () => AdminApplicationDetailDto })
  data!: AdminApplicationDetailDto;
}
