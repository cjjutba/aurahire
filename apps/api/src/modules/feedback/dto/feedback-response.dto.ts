import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  FeedbackType,
  FeedbackSeverity,
  FeedbackStatus,
  UserRole,
} from "@aurahire/shared";

export class FeedbackSubmitterDto {
  @ApiPropertyOptional({ nullable: true })
  id!: string | null;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({
    description: "Snapshot of the submitter's role at submission time",
    enum: ["candidate", "recruiter", "admin"],
  })
  role!: UserRole;
}

export class FeedbackCompanyDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  logoUrl!: string | null;
}

export class FeedbackDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  submitter!: FeedbackSubmitterDto;

  @ApiPropertyOptional({ nullable: true, type: FeedbackCompanyDto })
  company!: FeedbackCompanyDto | null;

  @ApiProperty({ enum: ["bug", "suggestion", "praise", "question", "other"] })
  type!: FeedbackType;

  @ApiPropertyOptional({
    nullable: true,
    enum: ["low", "normal", "high"],
    description: "Set only when type === 'bug'",
  })
  severity!: FeedbackSeverity | null;

  @ApiProperty()
  subject!: string;

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional({ nullable: true })
  pageUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  userAgent!: string | null;

  @ApiPropertyOptional({ nullable: true })
  appVersion!: string | null;

  @ApiProperty({ enum: ["new", "reviewing", "resolved", "dismissed"] })
  status!: FeedbackStatus;

  @ApiPropertyOptional({ nullable: true })
  adminNote!: string | null;

  @ApiPropertyOptional({ nullable: true })
  resolvedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  resolvedBy!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class FeedbackEnvelopeDto {
  @ApiProperty()
  data!: FeedbackDto;
}

export class FeedbackListMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class FeedbackListEnvelopeDto {
  @ApiProperty({ type: [FeedbackDto] })
  data!: FeedbackDto[];

  @ApiProperty({ type: FeedbackListMetaDto })
  meta!: FeedbackListMetaDto;
}
