import { Module, forwardRef } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { ScoringModule } from "../scoring/scoring.module";
import { BiasController } from "./bias.controller";
import { BiasRepository } from "./bias.repository";
import { BiasService } from "./bias.service";

@Module({
  imports: [forwardRef(() => JobsModule), ScoringModule],
  controllers: [BiasController],
  providers: [BiasService, BiasRepository],
  exports: [BiasService, BiasRepository],
})
export class BiasModule {}
