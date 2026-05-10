import { createZodDto } from "nestjs-zod";
import { onboardingSkippedAnalyzingSchema } from "@aurahire/shared";

export class OnboardingSkippedAnalyzingDto extends createZodDto(
  onboardingSkippedAnalyzingSchema,
) {}
