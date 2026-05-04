import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class InterviewDto {
  @ApiProperty() id!: string;
  @ApiProperty() applicationId!: string;
  @ApiProperty() scheduledBy!: string;
  @ApiProperty() scheduledAt!: string;
  @ApiProperty() durationMinutes!: number;
  @ApiProperty({ enum: ["phone", "video", "in-person"] }) format!: string;
  @ApiPropertyOptional({ nullable: true }) locationOrLink!: string | null;
  @ApiProperty({
    enum: ["scheduled", "completed", "cancelled", "no-show"],
  })
  status!: string;
  @ApiPropertyOptional({ nullable: true }) feedback!: string | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) rating!: number | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class InterviewEnvelopeDto {
  @ApiProperty({ type: () => InterviewDto })
  data!: InterviewDto;
}

export class InterviewListEnvelopeDto {
  @ApiProperty({ type: [InterviewDto] })
  data!: InterviewDto[];
}
