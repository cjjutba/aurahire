import { ApiProperty } from "@nestjs/swagger";

export class RecruiterCompanyDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) industry!: string | null;
  @ApiProperty({ nullable: true }) size!: string | null;
  @ApiProperty({ nullable: true }) website!: string | null;
  @ApiProperty({ nullable: true }) headquartersLocation!: string | null;
  @ApiProperty({ nullable: true }) description!: string | null;
}

export class RecruiterProfileMeDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ nullable: true }) phone!: string | null;
  @ApiProperty({ nullable: true }) jobTitle!: string | null;
  @ApiProperty({ nullable: true }) department!: string | null;
  @ApiProperty({ type: [String] }) rolesHiringFor!: string[];
  @ApiProperty({ nullable: true }) hiringVolumePerQuarter!: string | null;
  @ApiProperty() profileCompleted!: boolean;
  @ApiProperty({ type: () => RecruiterCompanyDto })
  company!: RecruiterCompanyDto;
}

export class RecruiterProfileEnvelopeDto {
  @ApiProperty({ type: () => RecruiterProfileMeDto })
  data!: RecruiterProfileMeDto;
}
