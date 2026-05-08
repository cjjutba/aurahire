import { ApiProperty } from "@nestjs/swagger";

export class InterviewVenueDto {
  @ApiProperty() id!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty() createdBy!: string;
  @ApiProperty() label!: string;
  @ApiProperty() venueName!: string;
  @ApiProperty() addressLine!: string;
  @ApiProperty({ type: String, nullable: true }) roomOrFloor!: string | null;
  @ApiProperty({ type: String, nullable: true }) mapUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) reportingInstructions!: string | null;
  @ApiProperty({ type: String, nullable: true }) whatToBring!: string | null;
  @ApiProperty({ type: String, nullable: true }) interviewerName!: string | null;
  @ApiProperty({ type: String, nullable: true }) interviewerTitle!: string | null;
  @ApiProperty() isDefault!: boolean;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class InterviewVenueListEnvelopeDto {
  @ApiProperty({ type: [InterviewVenueDto] })
  data!: InterviewVenueDto[];
}

export class InterviewVenueEnvelopeDto {
  @ApiProperty({ type: InterviewVenueDto })
  data!: InterviewVenueDto;
}
