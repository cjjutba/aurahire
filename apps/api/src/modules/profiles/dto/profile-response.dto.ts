import { ApiProperty } from "@nestjs/swagger";
import type { UserRole, UserStatus } from "@aurahire/shared";

export class CandidateSubprofileDto {
  @ApiProperty({ nullable: true }) headline!: string | null;
  @ApiProperty({ nullable: true }) summary!: string | null;
  @ApiProperty({ nullable: true }) locationCity!: string | null;
  @ApiProperty({ nullable: true }) locationCountry!: string | null;
  @ApiProperty() profileCompleted!: boolean;
}

export class RecruiterSubprofileDto {
  @ApiProperty() companyId!: string;
  @ApiProperty({ nullable: true }) jobTitle!: string | null;
  @ApiProperty({ nullable: true }) department!: string | null;
  @ApiProperty() profileCompleted!: boolean;
}

export class CompanySummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) industry!: string | null;
  @ApiProperty({ nullable: true }) size!: string | null;
  @ApiProperty({ nullable: true }) website!: string | null;
}

export class ProfileResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ enum: ["candidate", "recruiter", "admin"] }) role!: UserRole;
  @ApiProperty({ enum: ["active", "suspended", "deleted"] }) status!: UserStatus;
  @ApiProperty({ nullable: true }) phone!: string | null;
  @ApiProperty({ nullable: true }) avatarUrl!: string | null;
  @ApiProperty() profileCompleted!: boolean;
  @ApiProperty({ type: () => CandidateSubprofileDto, nullable: true })
  candidateProfile!: CandidateSubprofileDto | null;
  @ApiProperty({ type: () => RecruiterSubprofileDto, nullable: true })
  recruiterProfile!: RecruiterSubprofileDto | null;
  @ApiProperty({ type: () => CompanySummaryDto, nullable: true })
  company!: CompanySummaryDto | null;
}

export class ProfileResponseEnvelopeDto {
  @ApiProperty({ type: () => ProfileResponseDto })
  data!: ProfileResponseDto;
}
