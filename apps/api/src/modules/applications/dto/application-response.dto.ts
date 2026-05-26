import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class MatchEvidenceDto {
  @ApiProperty() excerpt!: string;
  @ApiProperty() source!: string;
  @ApiProperty({ enum: ["positive", "negative", "neutral"] })
  relevance!: string;
  @ApiPropertyOptional({ nullable: true, type: Number })
  contributionPoints!: number | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  reasoning!: string | null;
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

export class CalibrationWarningDto {
  @ApiProperty() componentName!: string;
  @ApiProperty({
    enum: ["ceiling_with_thin_evidence", "deduction_without_negative_evidence"],
  })
  reason!: "ceiling_with_thin_evidence" | "deduction_without_negative_evidence";
}

export class MatchScoreDto {
  @ApiProperty() id!: string;
  @ApiProperty() overallScore!: number;
  @ApiProperty({ enum: ["strong", "partial", "limited"] })
  band!: "strong" | "partial" | "limited";
  @ApiProperty({ type: [MatchComponentDto] }) components!: MatchComponentDto[];
  @ApiProperty() summary!: string;
  @ApiProperty({ nullable: true, type: [String] }) redFlags!: string[] | null;
  @ApiProperty({ nullable: true, type: [String] }) greenFlags!: string[] | null;
  @ApiProperty({ type: [String] }) redactedFields!: string[];
  @ApiProperty() promptVersion!: string;
  @ApiProperty() modelUsed!: string;
  @ApiProperty() latencyMs!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ type: [CalibrationWarningDto] })
  calibrationWarnings!: CalibrationWarningDto[];
}

export class ApplicationCandidateDto {
  @ApiProperty() id!: string;
  // Per thesis panel revision (May 2026), PII fields are nullable so the
  // recruiter-side redaction can null them out before interview completion.
  // Candidates / admins always receive the full values. When redacted, the
  // recruiter sees a stable anonymized handle in `fullName`
  // ("Candidate #ab12cd"), and `email` / `phone` / `headline` come back as
  // null.
  @ApiProperty() fullName!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  email!: string | null;
  @ApiPropertyOptional({ nullable: true }) phone!: string | null;
  @ApiPropertyOptional({ nullable: true }) headline!: string | null;
}

export class ApplicationCompanyDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) logoUrl!: string | null;
}

export class ApplicationJobDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true }) department!: string | null;
  @ApiProperty() employmentType!: string;
  @ApiProperty() workMode!: string;
  @ApiProperty({ type: () => ApplicationCompanyDto })
  company!: ApplicationCompanyDto;
}

export class ApplicationDto {
  @ApiProperty() id!: string;
  @ApiProperty() jobId!: string;
  @ApiProperty() candidateId!: string;
  @ApiProperty() resumeId!: string;
  @ApiPropertyOptional({ nullable: true }) coverLetter!: string | null;
  @ApiProperty({
    enum: [
      "applied",
      "interview",
      "offer",
      "offer_accepted",
      "offer_declined",
      "hired",
      "rejected",
      "withdrawn",
    ],
  })
  status!: string;
  @ApiProperty({
    enum: ["computing", "completed", "failed"],
    description:
      "Lifecycle of the AI match-score: 'computing' while the worker runs, 'completed' once the score row is persisted, 'failed' after retries exhausted.",
  })
  scoreStatus!: "computing" | "completed" | "failed";
  @ApiPropertyOptional({ nullable: true }) recruiterNotes!: string | null;
  @ApiProperty() appliedAt!: string;
  @ApiProperty() statusUpdatedAt!: string;
  @ApiPropertyOptional({ nullable: true }) shortlistedAt!: string | null;
  @ApiPropertyOptional({ type: () => MatchScoreDto, nullable: true })
  matchScore!: MatchScoreDto | null;
  @ApiPropertyOptional({ type: () => ApplicationCandidateDto, nullable: true })
  candidate!: ApplicationCandidateDto | null;
  @ApiPropertyOptional({ type: () => ApplicationJobDto, nullable: true })
  job!: ApplicationJobDto | null;
  @ApiProperty({
    description:
      "Count of other in-flight applications on the same job (not yet hired/rejected/withdrawn/offer_declined). Used by the Hire confirmation modal to surface cascade impact.",
  })
  inflightSiblingsCount!: number;
  /**
   * Per thesis panel revision (May 2026): candidate PII (name, email, phone)
   * is hidden from recruiters until an interview has been completed. This
   * flag tells the UI whether the candidate fields are real or anonymized.
   *  - false (default for recruiter on `applied` / pre-completion):
   *    `candidate.fullName` is `Candidate #ab12cd`, contact fields are
   *    null, and the UI surfaces the fairness banner + disables the
   *    resume download.
   *  - true (recruiter post-completion, plus all candidate / admin views):
   *    full PII and resume-download access.
   * Always `true` on candidate-self and admin endpoints regardless of
   * interview state.
   */
  @ApiProperty({
    description:
      "Whether the viewer is authorized to see candidate identity (name, contact, raw evidence) and download the resume. Becomes true for recruiters once any interview on this application is `completed`. Always true for candidate-self and admin views.",
  })
  identityRevealed!: boolean;
}

export class ApplicationEnvelopeDto {
  @ApiProperty({ type: () => ApplicationDto })
  data!: ApplicationDto;
}

export class ApplicationListEnvelopeDto {
  @ApiProperty({ type: [ApplicationDto] })
  data!: ApplicationDto[];
}

export class PaginationMetaDto {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}

export class ShortlistListEnvelopeDto {
  @ApiProperty({ type: [ApplicationDto] }) data!: ApplicationDto[];
  @ApiProperty({ type: () => PaginationMetaDto }) meta!: PaginationMetaDto;
}

// ─── Recruiter Stats envelope ──────────────────────────────────────────────

export class RecruiterStatsResultDto {
  @ApiProperty() activeJobs!: number;
  @ApiProperty({
    description:
      "Deprecated alias for totalApps. Will be removed in a future release.",
  })
  totalApplications!: number;
  @ApiProperty() totalApps!: number;
  @ApiProperty({
    description:
      "Deprecated alias for pendingReview. Will be removed in a future release.",
  })
  pendingReviews!: number;
  @ApiProperty() pendingReview!: number;
  @ApiProperty() inInterview!: number;
  @ApiProperty() offered!: number;
  @ApiProperty() hired!: number;
  @ApiProperty() avgMatchScore!: number;
  @ApiProperty() biasFlags!: number;
}

export class RecruiterStatsEnvelopeDto {
  @ApiProperty({ type: () => RecruiterStatsResultDto })
  data!: RecruiterStatsResultDto;
}

// ─── Recruiter Analytics envelope ─────────────────────────────────────────

export class RecruiterAnalyticsTopJobDto {
  @ApiProperty() jobId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() status!: string;
  @ApiProperty() applicationCount!: number;
  @ApiProperty() avgScore!: number;
}

export class RecruiterAnalyticsStatusBreakdownDto {
  @ApiProperty() status!: string;
  @ApiProperty() count!: number;
}

export class RecruiterAnalyticsKpisDto {
  @ApiProperty() activeJobs!: number;
  @ApiProperty() totalApplications!: number;
  @ApiProperty() pendingReviews!: number;
  @ApiProperty() avgMatchScore!: number;
}

export class RecruiterAnalyticsResultDto {
  @ApiProperty({ type: () => RecruiterAnalyticsKpisDto })
  kpis!: RecruiterAnalyticsKpisDto;
  @ApiProperty({ type: [RecruiterAnalyticsTopJobDto] })
  topJobs!: RecruiterAnalyticsTopJobDto[];
  @ApiProperty({ type: [RecruiterAnalyticsStatusBreakdownDto] })
  applicationsByStatus!: RecruiterAnalyticsStatusBreakdownDto[];
}

export class RecruiterAnalyticsEnvelopeDto {
  @ApiProperty({ type: () => RecruiterAnalyticsResultDto })
  data!: RecruiterAnalyticsResultDto;
}

// ─── Signed download ────────────────────────────────────────────────────────

export class SignedDownloadPayloadDto {
  @ApiProperty() signedUrl!: string;
  @ApiProperty() expiresAt!: string;
}

export class SignedDownloadEnvelopeDto {
  @ApiProperty({ type: () => SignedDownloadPayloadDto })
  data!: SignedDownloadPayloadDto;
}
