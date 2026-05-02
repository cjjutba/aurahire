import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "@aurahire/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

@ApiTags("auth")
@ApiBearerAuth()
@Controller("auth")
export class AuthController {
  @Get("me-test")
  @ApiOperation({
    summary: "Diagnostic: returns the authenticated user attached by SupabaseAuthGuard",
  })
  @ApiResponse({ status: 200, description: "Returns the authenticated user" })
  @ApiResponse({ status: 401, description: "Missing or invalid token" })
  meTest(@CurrentUser() user: AuthUser): { data: AuthUser } {
    return { data: user };
  }
}
