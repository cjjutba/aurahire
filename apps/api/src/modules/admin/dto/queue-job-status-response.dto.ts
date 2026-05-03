import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class EnqueueRescoreBatchResponseDto {
  @ApiProperty()
  data!: {
    queueJobId: string;
    queueName: string;
    sampleSize: number;
    enqueuedAt: string;
  };
}

export class RescoreBatchResultDto {
  @ApiProperty() processedCount!: number;
  @ApiProperty() skippedCount!: number;
  @ApiProperty() failedCount!: number;
  @ApiProperty() durationMs!: number;
}

export class QueueJobStatusDataDto {
  @ApiProperty() queueJobId!: string;
  @ApiProperty({
    enum: ["waiting", "active", "completed", "failed", "delayed", "paused", "unknown"],
  })
  state!: string;
  @ApiProperty() progress!: number;
  @ApiPropertyOptional({ nullable: true, type: String }) processedOn!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) finishedOn!: string | null;
  @ApiPropertyOptional({ nullable: true, type: () => RescoreBatchResultDto })
  result!: RescoreBatchResultDto | null;
  @ApiPropertyOptional({ nullable: true, type: String }) failedReason!: string | null;
}

export class QueueJobStatusResponseDto {
  @ApiProperty({ type: () => QueueJobStatusDataDto })
  data!: QueueJobStatusDataDto;
}
