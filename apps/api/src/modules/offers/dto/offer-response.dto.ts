import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class OfferDto {
  @ApiProperty() id!: string;
  @ApiProperty() applicationId!: string;
  @ApiProperty() sentBy!: string;
  @ApiProperty() title!: string;
  @ApiProperty() salary!: number;
  @ApiProperty() salaryCurrency!: string;
  @ApiProperty() startDate!: string;
  @ApiPropertyOptional({ nullable: true }) managerName!: string | null;
  @ApiPropertyOptional({ nullable: true }) benefitsSummary!: string | null;
  @ApiPropertyOptional({ nullable: true }) customMessage!: string | null;
  @ApiProperty({
    enum: ["pending", "accepted", "declined", "expired", "withdrawn"],
  })
  status!: string;
  @ApiProperty() sentAt!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) respondedAt!:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true, type: String }) expiresAt!:
    | string
    | null;
}

export class OfferEnvelopeDto {
  @ApiProperty({ type: () => OfferDto })
  data!: OfferDto;
}

export class OfferListEnvelopeDto {
  @ApiProperty({ type: [OfferDto] })
  data!: OfferDto[];
}
