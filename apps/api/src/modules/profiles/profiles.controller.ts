import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "@aurahire/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ProfileResponseEnvelopeDto } from "./dto/profile-response.dto";
import { ProfilesService } from "./profiles.service";

@ApiTags("profiles")
@ApiBearerAuth()
@Controller("profiles")
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get("me")
  @ApiOperation({ summary: "Get the current user's profile + role-specific subprofile" })
  @ApiResponse({ status: 200, type: ProfileResponseEnvelopeDto })
  @ApiResponse({ status: 401, description: "Missing or invalid token" })
  @ApiResponse({ status: 404, description: "Profile not yet initialized" })
  async getMe(@CurrentUser() user: AuthUser): Promise<ProfileResponseEnvelopeDto> {
    const data = await this.profilesService.getMe(user);
    return { data };
  }
}
