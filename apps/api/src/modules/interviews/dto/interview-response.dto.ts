import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class InterviewCandidateRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
}

export class InterviewJobRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
}

export class InterviewCompanyRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) logoUrl!: string | null;
}

export class InterviewDto {
  @ApiProperty() id!: string;
  @ApiProperty() applicationId!: string;
  @ApiProperty() scheduledBy!: string;
  @ApiProperty() scheduledAt!: string;
  @ApiProperty() durationMinutes!: number;
  @ApiProperty({ enum: ["phone", "video", "in-person"] }) format!: string;
  @ApiPropertyOptional({ nullable: true }) locationOrLink!: string | null;
  @ApiProperty({
    enum: [
      "scheduled",
      "completed",
      "cancelled",
      "no-show",
      "rescheduled",
      "no-show",
    ],
  })
  status!: string;
  @ApiPropertyOptional({ nullable: true }) feedback!: string | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) rating!: number | null;
  @ApiPropertyOptional({
    nullable: true,
    enum: ["proceed", "hold", "reject"],
  })
  recommendation!: "proceed" | "hold" | "reject" | null;
  @ApiProperty({ type: String, nullable: true })
  candidateSummary!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "ISO timestamp of when feedback was shared with candidate",
  })
  sharedWithCandidateAt!: string | null;

  // Venue fields
  @ApiPropertyOptional({ nullable: true }) venueName?: string | null;
  @ApiPropertyOptional({ nullable: true }) addressLine?: string | null;
  @ApiPropertyOptional({ nullable: true }) roomOrFloor?: string | null;
  @ApiPropertyOptional({ nullable: true }) mapUrl?: string | null;
  @ApiPropertyOptional({ nullable: true }) reportingInstructions?:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true }) whatToBring?: string | null;
  @ApiPropertyOptional({ nullable: true }) interviewerName?: string | null;
  @ApiPropertyOptional({ nullable: true }) interviewerTitle?: string | null;

  // Reschedule chain
  @ApiPropertyOptional({ nullable: true }) rescheduledFromId?: string | null;
  @ApiPropertyOptional({ nullable: true }) rescheduledToId?: string | null;

  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiPropertyOptional({ type: () => InterviewCandidateRefDto, nullable: true })
  candidate?: InterviewCandidateRefDto | null;
  @ApiPropertyOptional({ type: () => InterviewJobRefDto, nullable: true })
  job?: InterviewJobRefDto | null;
  @ApiPropertyOptional({ type: () => InterviewCompanyRefDto, nullable: true })
  company?: InterviewCompanyRefDto | null;
}

export class InterviewEnvelopeDto {
  @ApiProperty({ type: () => InterviewDto })
  data!: InterviewDto;
}

export class InterviewListMetaDto {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}

export class InterviewListEnvelopeDto {
  @ApiProperty({ type: [InterviewDto] })
  data!: InterviewDto[];
  @ApiPropertyOptional({ type: () => InterviewListMetaDto })
  meta?: InterviewListMetaDto;
}
