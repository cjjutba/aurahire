import { Controller, Get, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { Roles } from "../../../common/decorators/roles.decorator";

import { AnalyticsQueryDto } from "../dto/analytics-query.dto";
import { AnalyticsBundleEnvelopeDto } from "../dto/analytics-response.dto";
import { AdminAnalyticsService } from "../services/admin-analytics.service";

@ApiTags("admin-analytics")
@ApiBearerAuth()
@Controller("admin/analytics")
export class AdminAnalyticsController {
  constructor(private readonly service: AdminAnalyticsService) {}

  @Get()
  @Roles("admin")
  @ApiOperation({
    summary: "Cached 5-min analytics bundle (KPIs + 6 chart series)",
  })
  @ApiResponse({ status: 200, type: AnalyticsBundleEnvelopeDto })
  async overview(
    @Query() query: AnalyticsQueryDto,
  ): Promise<AnalyticsBundleEnvelopeDto> {
    const data = await this.service.overview(query);
    return { data };
  }
}
