import { Global, Module } from "@nestjs/common";
import { OpenAIService } from "./openai.service";
import { RedactPiiService } from "./redact-pii.service";
import { ParseResumeService } from "./parse-resume.service";
import { ScoreProfileService } from "./score-profile.service";
import { ScoreMatchService } from "./score-match.service";
import { DetectBiasService } from "./detect-bias.service";

@Global()
@Module({
  providers: [
    OpenAIService,
    RedactPiiService,
    ParseResumeService,
    ScoreProfileService,
    ScoreMatchService,
    DetectBiasService,
  ],
  exports: [
    OpenAIService,
    RedactPiiService,
    ParseResumeService,
    ScoreProfileService,
    ScoreMatchService,
    DetectBiasService,
  ],
})
export class AiModule {}
