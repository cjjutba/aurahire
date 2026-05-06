import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

// ----- Query -----------------------------------------------------------

export const listAdminCompaniesQuerySchema = z.object({
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListAdminCompaniesQuery = z.infer<
  typeof listAdminCompaniesQuerySchema
>;

export class ListAdminCompaniesQueryDto extends createZodDto(
  listAdminCompaniesQuerySchema,
) {}

// ----- Response --------------------------------------------------------

export class AdminCompanyOwnerDto {
  @ApiPropertyOptional({ nullable: true }) name!: string | null;
  @ApiPropertyOptional({ nullable: true }) email!: string | null;
}

export class AdminCompanyRowDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) industry!: string | null;
  @ApiPropertyOptional({ nullable: true }) size!: string | null;
  @ApiPropertyOptional({ nullable: true }) website!: string | null;
  @ApiPropertyOptional({ nullable: true }) logoUrl!: string | null;
  @ApiPropertyOptional({ nullable: true }) headquartersLocation!: string | null;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty({ type: () => AdminCompanyOwnerDto })
  owner!: AdminCompanyOwnerDto;
  @ApiProperty() memberCount!: number;
  @ApiProperty() jobCount!: number;
  /**
   * Suspension flag — currently always 'active'. Schema migration to add
   * a `suspended_at` column is deferred to a follow-up; the suspend/restore
   * endpoints are not yet wired and the UI shows the action as a stub.
   */
  @ApiProperty({ enum: ["active", "suspended"] })
  status!: "active" | "suspended";
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class AdminCompanyListMetaDto {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}

export class AdminCompanyListEnvelopeDto {
  @ApiProperty({ type: [AdminCompanyRowDto] })
  data!: AdminCompanyRowDto[];
  @ApiProperty({ type: () => AdminCompanyListMetaDto })
  meta!: AdminCompanyListMetaDto;
}

// ----- Lightweight filter dropdown -------------------------------------

export class AdminCompanyOptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) logoUrl!: string | null;
}

export class AdminCompanyOptionsEnvelopeDto {
  @ApiProperty({ type: [AdminCompanyOptionDto] })
  data!: AdminCompanyOptionDto[];
}
