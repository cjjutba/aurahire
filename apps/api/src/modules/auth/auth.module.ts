import { Module } from "@nestjs/common";
import { ProfilesModule } from "../profiles/profiles.module";
import { AuthController } from "./auth.controller";

@Module({
  imports: [ProfilesModule],
  controllers: [AuthController],
})
export class AuthModule {}
