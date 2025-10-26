import { Controller, Get, Post, Body, Query, UseGuards, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ARSnapshotCreateDto, ARSnapshotListDto } from '@shared/dto/ar.dto';
import { AuthGuard } from '../auth/auth.guard';
import { EVENTS } from '@shared/events';
import { BaseGatewayController } from '../base.controller';
import { ARSnapshotCreateResponse, PaginatedARSnapshotsResponse } from '@shared/types/ar.types';

/**
 * AR (Augmented Reality) Controller
 * Gateway endpoint cho AR features - forward requests đến ar-service
 *
 * AR snapshots: User chụp ảnh sản phẩm với AR view
 */
@Controller('ar')
export class ArController extends BaseGatewayController {
  constructor(@Inject('AR_SERVICE') protected readonly client: ClientProxy) {
    super(client);
  }

  /**
   * POST /ar/snapshots
   * Tạo AR snapshot mới (user chụp ảnh với AR)
   * Requires authentication
   */
  @Post('snapshots')
  @UseGuards(AuthGuard)
  createSnapshot(@Body() dto: ARSnapshotCreateDto): Promise<ARSnapshotCreateResponse> {
    return this.send<ARSnapshotCreateDto, ARSnapshotCreateResponse>(EVENTS.AR.SNAPSHOT_CREATE, dto);
  }

  /**
   * GET /ar/snapshots
   * Lấy danh sách AR snapshots với pagination
   * Public endpoint để xem snapshots của users khác (social feature)
   */
  @Get('snapshots')
  listSnapshots(@Query() query: ARSnapshotListDto): Promise<PaginatedARSnapshotsResponse> {
    return this.send<ARSnapshotListDto, PaginatedARSnapshotsResponse>(
      EVENTS.AR.SNAPSHOT_LIST,
      query,
    );
  }
}
