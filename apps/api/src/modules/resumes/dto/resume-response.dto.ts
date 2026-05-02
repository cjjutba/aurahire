import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ResumeResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() candidateId!: string;
  @ApiProperty() filename!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty() storagePath!: string;
  @ApiPropertyOptional({ nullable: true }) rawText!: string | null;
  @ApiProperty({ type: "object", additionalProperties: true })
  parsedData!: unknown;
  @ApiProperty({ enum: ["pending", "parsing", "parsed", "failed"] })
  parseStatus!: string;
  @ApiPropertyOptional({ nullable: true }) parseError!: string | null;
  @ApiProperty() isDefault!: boolean;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class ResumeResponseEnvelopeDto {
  @ApiProperty({ type: () => ResumeResponseDto })
  data!: ResumeResponseDto;
}

export class ResumeListResponseDto {
  @ApiProperty({ type: [ResumeResponseDto] })
  data!: ResumeResponseDto[];
}

export class SignedUrlPayloadDto {
  @ApiProperty() signedUrl!: string;
  @ApiProperty() expiresAt!: string;
}

export class SignedUrlResponseDto {
  @ApiProperty({ type: () => SignedUrlPayloadDto })
  data!: SignedUrlPayloadDto;
}
