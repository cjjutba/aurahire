import { ApiProperty } from "@nestjs/swagger";
import { JobResponseDto } from "./job-response.dto";

export class PaginationMetaDto {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}

export class JobListResponseDto {
  @ApiProperty({ type: [JobResponseDto] })
  data!: JobResponseDto[];
  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
