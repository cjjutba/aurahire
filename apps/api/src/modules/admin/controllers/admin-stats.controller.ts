import { Controller, Get } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { Roles } from "../../../common/decorators/roles.decorator";
import { AdminStatsService } from "../services/admin-stats.service";
import { AdminStatsOverviewEnvelopeDto } from "../dto/admin-stats-response.dto";

@ApiTags("admin-stats")
@ApiBearerAuth()
@Controller("admin/stats")
export class AdminStatsController {
  constructor(private readonly service: AdminStatsService) {}

  @Get("overview")
  @Roles("admin")
  @ApiOperation({ summary: "Command Center KPIs in one fetch (cached 60s)" })
  @ApiResponse({ status: 200, type: AdminStatsOverviewEnvelopeDto })
  async overview(): Promise<AdminStatsOverviewEnvelopeDto> {
    const data = await this.service.overview();
    return { data };
  }
}
