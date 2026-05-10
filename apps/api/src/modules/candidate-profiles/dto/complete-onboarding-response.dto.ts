import { ApiProperty } from "@nestjs/swagger";

import { ProfileScoreDto } from "../../scoring/dto/profile-score-response.dto";
import { CandidateProfileMeDto } from "./candidate-profile-response.dto";

/**
 * Reasons the inline Profile Score compute may have produced no score.
 *  - `transient`       — AI call threw; a recompute job has been enqueued
 *                        for retry. UI should show a retry-soon nudge.
 *  - `missing_resume`  — candidate has no default resume. Frontend
 *                        validation should normally prevent this; a
 *                        defense-in-depth signal so the UI can route the
 *                        candidate back to the upload step.
 */
export type ProfileScoreError = "transient" | "missing_resume";

export class CompleteOnboardingErrorsDto {
  @ApiProperty({
    enum: ["transient", "missing_resume"],
    required: false,
  })
  profileScore?: ProfileScoreError;
}

export class CompleteOnboardingDto {
  @ApiProperty({ type: () => CandidateProfileMeDto })
  profile!: CandidateProfileMeDto;

  @ApiProperty()
  profileCompleted!: boolean;

  @ApiProperty({ type: () => ProfileScoreDto, nullable: true })
  profileScore!: ProfileScoreDto | null;

  @ApiProperty({
    type: String,
    description:
      "BullMQ job id of the match-preview precompute job kicked off for the candidate's default resume. Empty string when no precompute was enqueued (e.g. missing_resume).",
  })
  precomputeJobId!: string;

  @ApiProperty({
    type: () => CompleteOnboardingErrorsDto,
    required: false,
    description:
      "Optional per-subsystem error map. Present only when one or more best-effort steps (e.g. inline Profile Score compute) declined to populate.",
  })
  errors?: CompleteOnboardingErrorsDto;
}

export class CompleteOnboardingEnvelopeDto {
  @ApiProperty({ type: () => CompleteOnboardingDto })
  data!: CompleteOnboardingDto;
}
