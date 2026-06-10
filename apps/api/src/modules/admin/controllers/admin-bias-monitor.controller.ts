import { Controller, Get, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { Roles } from "../../../common/decorators/roles.decorator";

import { BiasMonitorQueryDto } from "../dto/bias-monitor-query.dto";
import { BiasMonitorBundleEnvelopeDto } from "../dto/bias-monitor-response.dto";
import { AdminBiasMonitorService } from "../services/admin-bias-monitor.service";

@ApiTags("admin-bias-monitor")
@ApiBearerAuth()
@Controller("admin/bias-monitor")
export class AdminBiasMonitorController {
  constructor(private readonly service: AdminBiasMonitorService) {}

  @Get()
  @Roles("admin")
  @ApiOperation({
    summary:
      "Aggregate fairness metrics - KPIs, breakdowns, top flagged terms, recent overrides. Cached 5 min.",
  })
  @ApiResponse({ status: 200, type: BiasMonitorBundleEnvelopeDto })
  async overview(
    @Query() query: BiasMonitorQueryDto,
  ): Promise<BiasMonitorBundleEnvelopeDto> {
    const data = await this.service.overview(query);
    return { data };
  }
}
