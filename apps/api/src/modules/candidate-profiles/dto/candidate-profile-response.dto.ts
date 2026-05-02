import { ApiProperty } from "@nestjs/swagger";

export class CandidateProfileMeDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ nullable: true }) phone!: string | null;
  @ApiProperty({ nullable: true }) headline!: string | null;
  @ApiProperty({ nullable: true }) summary!: string | null;
  @ApiProperty({ nullable: true }) locationCity!: string | null;
  @ApiProperty({ nullable: true }) locationRegion!: string | null;
  @ApiProperty({ nullable: true }) locationCountry!: string | null;
  @ApiProperty({ type: [String] }) desiredRoles!: string[];
  @ApiProperty({ nullable: true }) desiredSeniority!: string | null;
  @ApiProperty({ type: [String] }) openTo!: string[];
  @ApiProperty({ nullable: true, type: Number }) desiredSalaryMin!: number | null;
  @ApiProperty({ nullable: true, type: Number }) desiredSalaryMax!: number | null;
  @ApiProperty() desiredCurrency!: string;
  @ApiProperty({ nullable: true }) availableStartDate!: string | null;
  @ApiProperty() profileCompleted!: boolean;
}

export class CandidateProfileEnvelopeDto {
  @ApiProperty({ type: () => CandidateProfileMeDto })
  data!: CandidateProfileMeDto;
}
